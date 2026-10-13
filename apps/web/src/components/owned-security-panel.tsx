"use client";

import { useCallback, useEffect, useState } from "react";
import { authClient } from "../lib/auth-client";

type SessionItem = {
  id: string;
  token: string;
  userAgent?: string | null | undefined;
  ipAddress?: string | null | undefined;
  createdAt: string | Date;
};

type PasskeyItem = {
  id: string;
  name?: string | null | undefined;
  createdAt?: string | Date | undefined;
};

export function OwnedSecurityPanel() {
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [passkeys, setPasskeys] = useState<PasskeyItem[]>([]);
  const [password, setPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [totpURI, setTotpURI] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    const [sessionResponse, passkeyResponse] = await Promise.all([
      authClient.listSessions(),
      authClient.passkey.listUserPasskeys(),
    ]);
    if (sessionResponse.data) setSessions(sessionResponse.data);
    if (passkeyResponse.data) setPasskeys(passkeyResponse.data);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function perform(operation: () => Promise<unknown>, success: string) {
    setBusy(true);
    setStatus("");
    try {
      const result = (await operation()) as { error?: { message?: string } | null };
      if (result.error) throw new Error(result.error.message || "The operation was denied.");
      setStatus(success);
      await reload();
    } catch (cause) {
      setStatus(cause instanceof Error ? cause.message : "The operation failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="settings-panel">
      <h2>Session and device security</h2>
      <p>Sessions are verified against Nexosophy's database and can be revoked independently.</p>
      <button
        type="button"
        disabled={busy}
        onClick={() =>
          void perform(
            () => authClient.revokeOtherSessions(),
            "Other devices have been signed out.",
          )
        }
      >
        Sign out other devices
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() =>
          void perform(
            () => authClient.revokeSessions(),
            "All sessions revoked. Please sign in again.",
          )
        }
      >
        Sign out everywhere
      </button>
      <ul>
        {sessions.map((session) => (
          <li key={session.id}>
            <strong>{session.userAgent || "Unknown device"}</strong>{" "}
            <small>
              {session.ipAddress || "Private address"} —{" "}
              {new Date(session.createdAt).toLocaleDateString()}
            </small>{" "}
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void perform(
                  () => authClient.revokeSession({ token: session.token }),
                  "Device signed out.",
                )
              }
            >
              Revoke
            </button>
          </li>
        ))}
      </ul>
      <h2>Passkeys</h2>
      <p>Add a phishing-resistant device passkey. The private key stays with your authenticator.</p>
      <button
        type="button"
        disabled={busy}
        onClick={() =>
          void perform(
            () => authClient.passkey.addPasskey({ name: "My passkey" }),
            "Passkey registered.",
          )
        }
      >
        Register a passkey
      </button>
      <ul>
        {passkeys.map((key) => (
          <li key={key.id}>
            {key.name || "Passkey"}{" "}
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void perform(
                  () => authClient.passkey.deletePasskey({ id: key.id }),
                  "Passkey deleted.",
                )
              }
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      <h2>Authenticator app (TOTP)</h2>
      <label>
        Current password
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      <button
        type="button"
        disabled={busy || !password}
        onClick={() => {
          setBusy(true);
          void authClient.twoFactor
            .enable({ password, method: "totp" })
            .then((response) => {
              if (response.error) setStatus(response.error.message || "2FA enrollment failed.");
              else if (response.data && "totpURI" in response.data) {
                setTotpURI(String(response.data.totpURI));
                setBackupCodes(
                  Array.isArray(response.data.backupCodes) ? response.data.backupCodes : [],
                );
              }
            })
            .finally(() => setBusy(false));
        }}
      >
        Set up two-factor authentication
      </button>
      {totpURI && (
        <div>
          <p>Import this TOTP provisioning URI into an authenticator app. Never share it.</p>
          <code>{totpURI}</code>
          <p>Store these one-time backup codes securely; they will not be shown again.</p>
          <ul>
            {backupCodes.map((code) => (
              <li key={code}>
                <code>{code}</code>
              </li>
            ))}
          </ul>
          <label>
            Authenticator code
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
            />
          </label>
          <button
            type="button"
            disabled={busy || verificationCode.length !== 6}
            onClick={() =>
              void perform(
                () => authClient.twoFactor.verifyTotp({ code: verificationCode }),
                "Authenticator verified.",
              )
            }
          >
            Verify authenticator
          </button>
        </div>
      )}
      {status && <p role="status">{status}</p>}
    </div>
  );
}
