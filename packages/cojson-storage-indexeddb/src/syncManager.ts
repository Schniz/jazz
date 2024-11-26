import {
  CojsonInternalTypes,
  MAX_RECOMMENDED_TX_SIZE,
  OutgoingSyncQueue,
  RawAccountID,
  SessionID,
  SyncMessage,
  cojsonInternals,
  emptyKnownState,
} from "cojson";
import { IDBClient, MakeRequestFunction } from "./idbClient";
import { SyncPromise } from "./syncPromises.js";
import NewContentMessage = CojsonInternalTypes.NewContentMessage;
import KnownStateMessage = CojsonInternalTypes.KnownStateMessage;
import RawCoID = CojsonInternalTypes.RawCoID;

type CoValueRow = {
  id: CojsonInternalTypes.RawCoID;
  header: CojsonInternalTypes.CoValueHeader;
};

type StoredCoValueRow = CoValueRow & { rowID: number };

type SessionRow = {
  coValue: number;
  sessionID: SessionID;
  lastIdx: number;
  lastSignature: CojsonInternalTypes.Signature;
  bytesSinceLastSignature?: number;
};

type StoredSessionRow = SessionRow & { rowID: number };

type TransactionRow = {
  ses: number;
  idx: number;
  tx: CojsonInternalTypes.Transaction;
};

type SignatureAfterRow = {
  ses: number;
  idx: number;
  signature: CojsonInternalTypes.Signature;
};

export class SyncManager {
  private readonly makeRequest: MakeRequestFunction;
  private readonly toLocalNode: OutgoingSyncQueue;

  constructor(dbClient: IDBClient, toLocalNode: OutgoingSyncQueue) {
    this.makeRequest = dbClient.makeRequest.bind(dbClient);
    this.toLocalNode = toLocalNode;
  }

  async handleSyncMessage(msg: SyncMessage) {
    // console.log("--->>> IN", msg);
    switch (msg.action) {
      case "load":
        await this.handleLoad(msg);
        break;
      case "content":
        await this.handleContent(msg);
        break;
      case "known":
        await this.handleKnown(msg);
        break;
      case "done":
        await this.handleDone(msg);
        break;
    }
  }

  async handleSessionUpdate(
    sessionRow: StoredSessionRow,
    theirKnown: CojsonInternalTypes.CoValueKnownState,
    ourKnown: CojsonInternalTypes.CoValueKnownState,
    newContentPieces: CojsonInternalTypes.NewContentMessage[],
  ) {
    ourKnown.sessions[sessionRow.sessionID] = sessionRow.lastIdx;

    if (sessionRow.lastIdx <= (theirKnown.sessions[sessionRow.sessionID] || 0))
      return;

    const firstNewTxIdx = theirKnown.sessions[sessionRow.sessionID] || 0;

    const signaturesAndIdxs = await this.makeRequest<SignatureAfterRow[]>(
      ({ signatureAfter }: { signatureAfter: IDBObjectStore }) =>
        signatureAfter.getAll(
          IDBKeyRange.bound(
            [sessionRow.rowID, firstNewTxIdx],
            [sessionRow.rowID, Infinity],
          ),
        ),
    );

    const newTxsInSession = await this.makeRequest<TransactionRow[]>(
      ({ transactions }) =>
        transactions.getAll(
          IDBKeyRange.bound(
            [sessionRow.rowID, firstNewTxIdx],
            [sessionRow.rowID, Infinity],
          ),
        ),
    );

    collectNewTxs(
      newTxsInSession,
      newContentPieces,
      sessionRow,
      signaturesAndIdxs,
      theirKnown,
      firstNewTxIdx,
    );
  }
  async sendNewContent(
    coValueKnownState: CojsonInternalTypes.CoValueKnownState,
  ): Promise<void> {
    const { contentMessageMap, knownMessageMap } =
      await this.collectCoValueData(coValueKnownState);

    // reverse it to send the top level id the last in the order (hacky - check it explicitly instead or cover well by tests)
    const collectedIds = Object.keys(knownMessageMap).reverse();
    collectedIds.forEach((coId) => {
      this.sendStateMessage(knownMessageMap[coId as RawCoID]);

      const contentMessages = contentMessageMap[coId as RawCoID] || [];
      contentMessages.forEach(this.sendStateMessage.bind(this));
    });
  }

  private async collectCoValueData(
    coValueKnownState: CojsonInternalTypes.CoValueKnownState,
    knownMessageMap: Record<RawCoID, KnownStateMessage> = {},
    contentMessageMap: Record<RawCoID, NewContentMessage[]> = {},
    asDependencyOf?: CojsonInternalTypes.RawCoID,
  ) {
    if (knownMessageMap[coValueKnownState.id]) {
      return { knownMessageMap, contentMessageMap };
    }

    const coValueRow = await this.makeRequest<StoredCoValueRow | undefined>(
      ({ coValues }) =>
        coValues.index("coValuesById").get(coValueKnownState.id),
    );

    if (!coValueRow) {
      const emptyKnownMessage: KnownStateMessage = {
        action: "known",
        ...emptyKnownState(coValueKnownState.id),
      };
      asDependencyOf && (emptyKnownMessage.asDependencyOf = asDependencyOf);
      knownMessageMap[coValueKnownState.id] = emptyKnownMessage;
      return { knownMessageMap, contentMessageMap };
    }

    const allCoValueSessions = await this.makeRequest<StoredSessionRow[]>(
      ({ sessions }) =>
        sessions.index("sessionsByCoValue").getAll(coValueRow.rowID),
    );

    const newCoValueKnownState: CojsonInternalTypes.CoValueKnownState = {
      id: coValueRow.id,
      header: true,
      sessions: {},
    };

    const contentMessages: CojsonInternalTypes.NewContentMessage[] = [
      {
        action: "content",
        id: coValueRow.id,
        header: coValueRow.header,
        new: {},
        priority: cojsonInternals.getPriorityFromHeader(coValueRow.header),
      },
    ];

    await Promise.all(
      allCoValueSessions.map((sessionRow) =>
        this.handleSessionUpdate(
          sessionRow,
          coValueKnownState,
          newCoValueKnownState,
          contentMessages,
        ),
      ),
    );

    const nonEmptyContentMessages = contentMessages.filter(
      (contentMessage) => Object.keys(contentMessage.new).length > 0,
    );

    const dependedOnCoValuesList = getDependedOnCoValues(
      coValueRow,
      nonEmptyContentMessages,
    );

    const knownMessage: KnownStateMessage = {
      action: "known",
      ...newCoValueKnownState,
    };
    asDependencyOf && (knownMessage.asDependencyOf = asDependencyOf);
    knownMessageMap[newCoValueKnownState.id] = knownMessage;
    contentMessageMap[newCoValueKnownState.id] = nonEmptyContentMessages;

    await Promise.all(
      dependedOnCoValuesList.map((dependedOnCoValue) =>
        this.collectCoValueData(
          {
            id: dependedOnCoValue,
            header: false,
            sessions: {},
          },
          knownMessageMap,
          contentMessageMap,
          asDependencyOf || coValueRow.id,
        ),
      ),
    );

    return {
      knownMessageMap,
      contentMessageMap,
    };
  }

  handleLoad(msg: CojsonInternalTypes.LoadMessage) {
    return this.sendNewContent(msg);
  }

  async handleContent(
    msg: CojsonInternalTypes.NewContentMessage,
  ): Promise<void | unknown> {
    const coValueRow = await this.makeRequest<StoredCoValueRow | undefined>(
      ({ coValues }) => coValues.index("coValuesById").get(msg.id),
    );
    if (!msg.header && !coValueRow) {
      return this.sendStateMessage({
        action: "known",
        id: msg.id,
        header: false,
        sessions: {},
        isCorrection: true,
      });
    }

    const storedCoValueRowID: number = coValueRow?.rowID
      ? coValueRow.rowID
      : ((await this.makeRequest<IDBValidKey>(({ coValues }) =>
          coValues.put({
            id: msg.id,
            header: msg.header!,
          } satisfies CoValueRow),
        )) as number);

    const allOurSessionsEntries = await this.makeRequest<StoredSessionRow[]>(
      ({ sessions }) =>
        sessions.index("sessionsByCoValue").getAll(storedCoValueRowID),
    );

    const allOurSessions: {
      [sessionID: SessionID]: StoredSessionRow;
    } = Object.fromEntries(
      allOurSessionsEntries.map((row) => [row.sessionID, row]),
    );

    const ourKnown: CojsonInternalTypes.CoValueKnownState = {
      id: msg.id,
      header: true,
      sessions: {},
    };
    let invalidAssumptions = false;

    await Promise.all(
      (Object.keys(msg.new) as SessionID[]).map((sessionID) => {
        const sessionRow = allOurSessions[sessionID];
        if (sessionRow) {
          ourKnown.sessions[sessionRow.sessionID] = sessionRow.lastIdx;
        }

        if ((sessionRow?.lastIdx || 0) < (msg.new[sessionID]?.after || 0)) {
          invalidAssumptions = true;
        } else {
          return this.putNewTxs(msg, sessionID, sessionRow, storedCoValueRowID);
        }
      }),
    );

    if (invalidAssumptions) {
      this.sendStateMessage({
        action: "known",
        ...ourKnown,
        isCorrection: invalidAssumptions,
      });
    }
  }

  private async putNewTxs(
    msg: CojsonInternalTypes.NewContentMessage,
    sessionID: SessionID,
    sessionRow: StoredSessionRow | undefined,
    storedCoValueRowID: number,
  ) {
    const newTransactions = msg.new[sessionID]?.newTransactions || [];

    const actuallyNewOffset =
      (sessionRow?.lastIdx || 0) - (msg.new[sessionID]?.after || 0);

    const actuallyNewTransactions = newTransactions.slice(actuallyNewOffset);

    let newBytesSinceLastSignature =
      (sessionRow?.bytesSinceLastSignature || 0) +
      actuallyNewTransactions.reduce(
        (sum, tx) =>
          sum +
          (tx.privacy === "private"
            ? tx.encryptedChanges.length
            : tx.changes.length),
        0,
      );

    const newLastIdx =
      (sessionRow?.lastIdx || 0) + actuallyNewTransactions.length;

    let shouldWriteSignature = false;

    if (newBytesSinceLastSignature > MAX_RECOMMENDED_TX_SIZE) {
      shouldWriteSignature = true;
      newBytesSinceLastSignature = 0;
    }

    const nextIdx = sessionRow?.lastIdx || 0;

    const sessionUpdate = {
      coValue: storedCoValueRowID,
      sessionID: sessionID,
      lastIdx: newLastIdx,
      lastSignature: msg.new[sessionID]!.lastSignature,
      bytesSinceLastSignature: newBytesSinceLastSignature,
    };

    const sessionRowID = await this.makeRequest<number>(({ sessions }) =>
      sessions.put(
        sessionRow?.rowID
          ? {
              rowID: sessionRow.rowID,
              ...sessionUpdate,
            }
          : sessionUpdate,
      ),
    );

    let maybePutRequest;
    if (shouldWriteSignature) {
      maybePutRequest = this.makeRequest(({ signatureAfter }) =>
        signatureAfter.put({
          ses: sessionRowID,
          // TODO: newLastIdx is a misnomer, it's actually more like nextIdx or length
          idx: newLastIdx - 1,
          signature: msg.new[sessionID]!.lastSignature,
        } satisfies SignatureAfterRow),
      );
    } else {
      maybePutRequest = SyncPromise.resolve();
    }

    return maybePutRequest.then(() =>
      Promise.all(
        actuallyNewTransactions.map((newTransaction, i) => {
          return this.makeRequest(({ transactions }) =>
            transactions.add({
              ses: sessionRowID,
              idx: nextIdx + i,
              tx: newTransaction,
            } satisfies TransactionRow),
          );
        }),
      ),
    );
  }

  handleKnown(msg: CojsonInternalTypes.KnownStateMessage) {
    // return this.sendNewContent(msg);
  }
  // count = 0;
  private sendStateMessage(msg: any): Promise<unknown> {
    // console.log("OUT", ++this.count, msg);
    return this.toLocalNode
      .push(msg)
      .catch((e) =>
        console.error(`Error sending ${msg.action} state, id ${msg.id}`, e),
      );
  }

  handleDone(_msg: CojsonInternalTypes.DoneMessage) {}
}

function collectNewTxs(
  newTxsInSession: TransactionRow[],
  newContentPieces: CojsonInternalTypes.NewContentMessage[],
  sessionRow: StoredSessionRow,
  signaturesAndIdxs: SignatureAfterRow[],
  theirKnown: CojsonInternalTypes.CoValueKnownState,
  firstNewTxIdx: number,
) {
  let idx = firstNewTxIdx;

  for (const tx of newTxsInSession) {
    let sessionEntry =
      newContentPieces[newContentPieces.length - 1]!.new[sessionRow.sessionID];
    if (!sessionEntry) {
      sessionEntry = {
        after: idx,
        lastSignature: "WILL_BE_REPLACED" as CojsonInternalTypes.Signature,
        newTransactions: [],
      };
      newContentPieces[newContentPieces.length - 1]!.new[sessionRow.sessionID] =
        sessionEntry;
    }

    sessionEntry.newTransactions.push(tx.tx);

    if (signaturesAndIdxs[0] && idx === signaturesAndIdxs[0].idx) {
      sessionEntry.lastSignature = signaturesAndIdxs[0].signature;
      signaturesAndIdxs.shift();
      newContentPieces.push({
        action: "content",
        id: theirKnown.id,
        new: {},
        priority: cojsonInternals.getPriorityFromHeader(undefined),
      });
    } else if (idx === firstNewTxIdx + newTxsInSession.length - 1) {
      sessionEntry.lastSignature = sessionRow.lastSignature;
    }
    idx += 1;
  }
}

function getDependedOnCoValues(
  coValueRow: StoredCoValueRow,
  newContentPieces: CojsonInternalTypes.NewContentMessage[],
) {
  return coValueRow.header.ruleset.type === "group"
    ? newContentPieces
        .flatMap((piece) => Object.values(piece.new))
        .flatMap((sessionEntry) =>
          sessionEntry.newTransactions.flatMap((tx) => {
            if (tx.privacy !== "trusting") return [];
            // TODO: avoid parse here?
            return cojsonInternals
              .parseJSON(tx.changes)
              .map(
                (change) =>
                  change &&
                  typeof change === "object" &&
                  "op" in change &&
                  change.op === "set" &&
                  "key" in change &&
                  change.key,
              )
              .filter(
                (key): key is CojsonInternalTypes.RawCoID =>
                  typeof key === "string" && key.startsWith("co_"),
              );
          }),
        )
    : coValueRow.header.ruleset.type === "ownedByGroup"
      ? [
          coValueRow.header.ruleset.group,
          ...new Set(
            newContentPieces.flatMap((piece) =>
              Object.keys(piece.new)
                .map((sessionID) =>
                  cojsonInternals.accountOrAgentIDfromSessionID(
                    sessionID as SessionID,
                  ),
                )
                .filter(
                  (accountID): accountID is RawAccountID =>
                    cojsonInternals.isAccountID(accountID) &&
                    accountID !== coValueRow.id,
                ),
            ),
          ),
        ]
      : [];
}
