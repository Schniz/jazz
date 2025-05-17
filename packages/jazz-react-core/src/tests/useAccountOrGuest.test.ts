// @vitest-environment happy-dom

import {
  Account,
  CoMap,
  Loaded,
  RefsToResolve,
  co,
  coField,
  z,
  zodSchemaToCoSchema,
} from "jazz-tools";
import { describe, expect, it } from "vitest";
import { useAccountOrGuest } from "../index.js";
import { createJazzTestAccount, createJazzTestGuest } from "../testing.js";
import { renderHook } from "./testUtils.js";

describe("useAccountOrGuest", () => {
  it("should return the correct me value", async () => {
    const account = await createJazzTestAccount();

    const { result } = renderHook(() => useAccountOrGuest(), {
      account,
    });

    expect(result.current?.me).toEqual(account);
  });

  it("should return the guest agent if the account is a guest", async () => {
    const account = await createJazzTestGuest();

    const { result } = renderHook(() => useAccountOrGuest(), {
      account,
    });

    expect(result.current?.me).toBe(account.guest);
  });

  it("should load nested values if requested", async () => {
    const AccountRoot = co.map({
      value: z.string(),
    });

    const AccountSchema = co
      .account({
        root: AccountRoot,
        profile: co.map({ name: z.string() }),
      })
      .withMigration((account, creationProps) => {
        if (!account._refs.root) {
          account.root = AccountRoot.create(
            { value: "123" },
            { owner: account },
          );
        }
      });

    const account = await createJazzTestAccount({
      AccountSchema: zodSchemaToCoSchema(AccountSchema),
    });

    const { result } = renderHook(
      () =>
        useAccountOrGuest<
          Loaded<typeof AccountSchema>,
          RefsToResolve<{ root: true }>
        >({
          resolve: {
            root: true,
          },
        }),
      {
        account,
      },
    );

    // @ts-expect-error
    expect(result.current.me?.root?.value).toBe("123");
  });

  it("should not load nested values if the account is a guest", async () => {
    const account = await createJazzTestGuest();

    const { result } = renderHook(
      () =>
        useAccountOrGuest({
          resolve: {
            root: true,
          },
        }),
      {
        account,
      },
    );

    expect(result.current.me).toBe(account.guest);
  });
});
