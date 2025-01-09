import {
  AgentSecret,
  CryptoProvider,
  RawAccountID,
  cojsonInternals,
} from "cojson";
import { Account, AuthMethod, AuthResult, ID } from "jazz-tools";
import { BrowserOnboardingAuth } from "./OnboardingAuth.js";

type LocalStorageData = {
  accountID: ID<Account>;
  accountSecret: AgentSecret;
};

const localStorageKey = "jazz-logged-in-secret";

/**
 * `BrowserPasskeyAuth` provides a `JazzAuth` object for passkey authentication.
 *
 * ```ts
 * import { BrowserPasskeyAuth } from "jazz-browser";
 *
 * const auth = new BrowserPasskeyAuth(driver, appName);
 * ```
 *
 * @category Auth Providers
 */
export class BrowserPasskeyAuth implements AuthMethod {
  constructor(
    public driver: BrowserPasskeyAuth.Driver,
    public appName: string,
    // TODO: is this a safe default?
    public appHostname: string = window.location.hostname,
  ) {}

  /**
   * @returns A `JazzAuth` object
   */
  async start(crypto: CryptoProvider): Promise<AuthResult> {
    if (
      localStorage[localStorageKey] &&
      !BrowserOnboardingAuth.isUserOnboarding()
    ) {
      const localStorageData = JSON.parse(
        localStorage[localStorageKey],
      ) as LocalStorageData;

      const accountID = localStorageData.accountID as ID<Account>;
      const secret = localStorageData.accountSecret;

      return {
        type: "existing",
        credentials: { accountID, secret },
        onSuccess: () => {
          this.driver.onSignedIn({ logOut });
        },
        onError: (error: string | Error) => {
          this.driver.onError(error);
        },
        logOut: () => {
          delete localStorage[localStorageKey];
        },
      } satisfies AuthResult;
    } else {
      return new Promise<AuthResult>((resolve) => {
        this.driver.onReady({
          signUp: async (username) => {
            if (BrowserOnboardingAuth.isUserOnboarding()) {
              const onboardingUserData =
                BrowserOnboardingAuth.getUserOnboardingData();

              resolve({
                type: "existing",
                username,
                credentials: {
                  accountID: onboardingUserData.accountID,
                  secret: onboardingUserData.secret,
                },
                saveCredentials: async ({ accountID, secret }) => {
                  await this.saveCredentials({
                    accountID,
                    secret,
                    secretSeed: onboardingUserData.secretSeed,
                    username,
                  });
                },
                onSuccess: () => {
                  this.driver.onSignedIn({ logOut });
                },
                onError: (error: string | Error) => {
                  this.driver.onError(error);
                },
                logOut,
              });
              return;
            } else {
              const secretSeed = crypto.newRandomSecretSeed();

              resolve({
                type: "new",
                creationProps: { name: username },
                initialSecret: crypto.agentSecretFromSecretSeed(secretSeed),
                saveCredentials: async ({ accountID, secret }) => {
                  await this.saveCredentials({
                    accountID,
                    secret,
                    secretSeed,
                    username,
                  });
                },
                onSuccess: () => {
                  this.driver.onSignedIn({ logOut });
                },
                onError: (error: string | Error) => {
                  this.driver.onError(error);
                },
                logOut,
              });
            }
          },
          logIn: async () => {
            const webAuthNCredential = (await navigator.credentials.get({
              publicKey: {
                challenge: Uint8Array.from([0, 1, 2]),
                rpId: this.appHostname,
                allowCredentials: [],
                timeout: 60000,
              },
            })) as unknown as {
              response: { userHandle: ArrayBuffer };
            };
            if (!webAuthNCredential) {
              throw new Error("Couldn't log in");
            }

            const webAuthNCredentialPayload = new Uint8Array(
              webAuthNCredential.response.userHandle,
            );
            const accountSecretSeed = webAuthNCredentialPayload.slice(
              0,
              cojsonInternals.secretSeedLength,
            );

            const secret = crypto.agentSecretFromSecretSeed(accountSecretSeed);

            const accountID = cojsonInternals.rawCoIDfromBytes(
              webAuthNCredentialPayload.slice(
                cojsonInternals.secretSeedLength,
                cojsonInternals.secretSeedLength +
                  cojsonInternals.shortHashLength,
              ),
            ) as ID<Account>;

            resolve({
              type: "existing",
              credentials: { accountID, secret },
              saveCredentials: async ({ accountID, secret }) => {
                localStorage[localStorageKey] = JSON.stringify({
                  accountID,
                  accountSecret: secret,
                } satisfies LocalStorageData);
              },
              onSuccess: () => {
                this.driver.onSignedIn({ logOut });
              },
              onError: (error: string | Error) => {
                this.driver.onError(error);
              },
              logOut,
            });
          },
        });
      });
    }
  }

  private async saveCredentials({
    accountID,
    secret,
    secretSeed,
    username,
  }: {
    accountID: ID<Account>;
    secret: AgentSecret;
    secretSeed: Uint8Array;
    username: string;
  }) {
    const webAuthNCredentialPayload = new Uint8Array(
      cojsonInternals.secretSeedLength + cojsonInternals.shortHashLength,
    );

    webAuthNCredentialPayload.set(secretSeed);
    webAuthNCredentialPayload.set(
      cojsonInternals.rawCoIDtoBytes(accountID as unknown as RawAccountID),
      cojsonInternals.secretSeedLength,
    );

    await navigator.credentials.create({
      publicKey: {
        challenge: Uint8Array.from([0, 1, 2]),
        rp: {
          name: this.appName,
          id: this.appHostname,
        },
        user: {
          id: webAuthNCredentialPayload,
          name: username + ` (${new Date().toLocaleString()})`,
          displayName: username,
        },
        pubKeyCredParams: [{ alg: -7, type: "public-key" }],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          requireResidentKey: true,
          residentKey: "required",
        },
        timeout: 60000,
        attestation: "direct",
      },
    });

    localStorage[localStorageKey] = JSON.stringify({
      accountID,
      accountSecret: secret,
    } satisfies LocalStorageData);
  }
}

/** @internal */
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace BrowserPasskeyAuth {
  export interface Driver {
    onReady: (next: {
      signUp: (username: string) => Promise<void>;
      logIn: () => Promise<void>;
    }) => void;
    onSignedIn: (next: { logOut: () => void }) => void;
    onError: (error: string | Error) => void;
  }
}

function logOut() {
  delete localStorage[localStorageKey];
}
