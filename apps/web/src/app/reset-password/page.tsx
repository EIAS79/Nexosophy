"use client";

import { useState, type FormEvent } from "react";
import { authClient } from "../../lib/auth-client";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) {
      setMessage("The recovery link has expired or is invalid. Request a new link.");
      return;
    }
    setBusy(true);
    try {
      const result = await authClient.resetPassword({ token, newPassword: password });
      if (result.error) throw new Error(result.error.message);
      setMessage("Password changed. You can now sign in.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not change password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell" id="main-content">
      <section className="route-state__card">
        <h1>Reset your Nexosophy password</h1>
        <form onSubmit={submit}>
          <label>
            New password
            <input
              type="password"
              minLength={12}
              maxLength={128}
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button type="submit" disabled={busy}>
            {busy ? "Updating…" : "Set new password"}
          </button>
        </form>
        <p role="status">{message}</p>
        <a href="/login">Return to sign in</a>
      </section>
    </main>
  );
}
