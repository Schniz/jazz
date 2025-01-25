import { base64URLtoBytes, bytesToBase64url } from "./base64url.js";
import { type RawCoValue } from "./coValue.js";
import {
  CoValueCore,
  type CoValueUniqueness,
  MAX_RECOMMENDED_TX_SIZE,
  idforHeader,
} from "./coValueCore.js";
import {
  ControlledAgent,
  RawAccount,
  RawControlledAccount,
  RawProfile,
  accountHeaderForInitialAgentSecret,
} from "./coValues/account.js";
import { OpID, RawCoList } from "./coValues/coList.js";
import { RawCoMap } from "./coValues/coMap.js";
import { RawCoPlainText, stringifyOpID } from "./coValues/coPlainText.js";
import {
  BinaryStreamItem,
  BinaryStreamStart,
  CoStreamItem,
  RawBinaryCoStream,
  RawCoStream,
} from "./coValues/coStream.js";
import { EVERYONE, RawGroup } from "./coValues/group.js";
import type { Everyone } from "./coValues/group.js";
import {
  CryptoProvider,
  StreamingHash,
  secretSeedLength,
  shortHashLength,
} from "./crypto/crypto.js";
import {
  getGroupDependentKey,
  getGroupDependentKeyList,
  isRawCoID,
  rawCoIDfromBytes,
  rawCoIDtoBytes,
} from "./ids.js";
import { Stringified, parseJSON, stableStringify } from "./jsonStringify.js";
import { LocalNode } from "./localNode.js";
import type { AccountRole, Role } from "./permissions.js";
import { Channel, connectedPeers } from "./streamUtils.js";
import { accountOrAgentIDfromSessionID } from "./typeUtils/accountOrAgentIDfromSessionID.js";
import { expectGroup } from "./typeUtils/expectGroup.js";
import { isAccountID } from "./typeUtils/isAccountID.js";

import type { AnyRawCoValue, CoID } from "./coValue.js";
import type {
  AccountMeta,
  RawAccountID,
  RawAccountMigration,
} from "./coValues/account.js";
import type {
  BinaryCoStreamMeta,
  BinaryStreamInfo,
} from "./coValues/coStream.js";
import type { InviteSecret } from "./coValues/group.js";
import type { AgentSecret } from "./crypto/crypto.js";
import type { AgentID, RawCoID, SessionID } from "./ids.js";
import type { JsonObject, JsonValue } from "./jsonValue.js";
import type * as Media from "./media.js";
import { disablePermissionErrors } from "./permissions.js";
import type {
  IncomingSyncStream,
  OutgoingSyncQueue,
  Peer,
  SyncMessage,
} from "./sync.js";
import {
  DisconnectedError,
  PingTimeoutError,
  emptyKnownState,
} from "./sync.js";

type Value = JsonValue | AnyRawCoValue;

import { logger } from "./logger.js";
import { getPriorityFromHeader } from "./priority.js";
import { FileSystem } from "./storage/FileSystem.js";
import { BlockFilename, LSMStorage, WalFilename } from "./storage/index.js";

/** @hidden */
export const cojsonInternals = {
  connectedPeers,
  rawCoIDtoBytes,
  rawCoIDfromBytes,
  secretSeedLength,
  shortHashLength,
  expectGroup,
  base64URLtoBytes,
  bytesToBase64url,
  parseJSON,
  stableStringify,
  accountOrAgentIDfromSessionID,
  isAccountID,
  accountHeaderForInitialAgentSecret,
  idforHeader,
  StreamingHash,
  Channel,
  getPriorityFromHeader,
  getGroupDependentKeyList,
  getGroupDependentKey,
  disablePermissionErrors,
};

export {
  LocalNode,
  RawGroup,
  Role,
  EVERYONE,
  Everyone,
  RawCoMap,
  RawCoList,
  RawCoStream,
  RawBinaryCoStream,
  RawCoValue,
  RawCoID,
  CoID,
  AnyRawCoValue,
  RawAccount,
  RawAccountID,
  AccountMeta,
  RawAccountMigration,
  RawProfile as Profile,
  SessionID,
  Media,
  CoValueCore,
  ControlledAgent,
  RawControlledAccount,
  MAX_RECOMMENDED_TX_SIZE,
  JsonObject,
  JsonValue,
  Peer,
  BinaryStreamInfo,
  BinaryCoStreamMeta,
  AgentID,
  AgentSecret,
  InviteSecret,
  CryptoProvider,
  SyncMessage,
  isRawCoID,
  LSMStorage,
  emptyKnownState,
  RawCoPlainText,
  stringifyOpID,
  logger,
  base64URLtoBytes,
  bytesToBase64url,
};

export type {
  Value,
  FileSystem,
  BlockFilename,
  WalFilename,
  IncomingSyncStream,
  OutgoingSyncQueue,
  DisconnectedError,
  PingTimeoutError,
  CoValueUniqueness,
  Stringified,
  CoStreamItem,
  BinaryStreamItem,
  BinaryStreamStart,
  OpID,
  AccountRole,
};

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace CojsonInternalTypes {
  export type CoValueKnownState = import("./sync.js").CoValueKnownState;
  export type DoneMessage = import("./sync.js").DoneMessage;
  export type KnownStateMessage = import("./sync.js").KnownStateMessage;
  export type LoadMessage = import("./sync.js").LoadMessage;
  export type NewContentMessage = import("./sync.js").NewContentMessage;
  export type SessionNewContent = import("./sync.js").SessionNewContent;
  export type CoValueHeader = import("./coValueCore.js").CoValueHeader;
  export type Transaction = import("./coValueCore.js").Transaction;
  export type TransactionID = import("./ids.js").TransactionID;
  export type Signature = import("./crypto/crypto.js").Signature;
  export type RawCoID = import("./ids.js").RawCoID;
  export type ProfileShape = import("./coValues/account.js").ProfileShape;
  export type SealerSecret = import("./crypto/crypto.js").SealerSecret;
  export type SignerID = import("./crypto/crypto.js").SignerID;
  export type SignerSecret = import("./crypto/crypto.js").SignerSecret;
  export type JsonObject = import("./jsonValue.js").JsonObject;
}
