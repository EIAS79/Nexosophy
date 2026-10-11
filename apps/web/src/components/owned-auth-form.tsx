"use client";

import { useState, type FormEvent } from "react";
import { authClient } from "../lib/auth-client";

type AuthMode = "login" | "signup";
type SocialProvider = "google" | "github" | "facebook" | "apple";

const providers: { id: SocialProvider; label: string }[] = [
  { id: "google", label: "Google" },
  { id: "github", label: "GitHub" },
  { id: "facebook", label: "Facebook" },
  { id: "apple", label: "Apple" },
];

export function OwnedAuthForm({ mode }: { mode: AuthMode }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [secondFactor, setSecondFactor] = useState(false);
  const [recover, setRecover] = useState(false);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWorking(true);
    setError("");
    try {
      if (secondFactor) {
        const result = await authClient.twoFactor.verifyTotp({ code });
        if (result.error) throw new Error(result.error.message);
        window.location.assign("/app");
        return;
      }

      if (recover) {
        await authClient.requestPasswordReset({
          email,
          redirectTo: `${window.location.origin}/reset-password`,
        });
        setMessage("If the account exists, a recovery email will arrive shortly.");
        return;
      }

      if (mode === "signup") {
        const result = await authClient.signUp.email({
          email,
          name,
          password,
          callbackURL: "/onboarding",
        });
        if (result.error) throw new Error(result.error.message);
        setMessage("Check your email to verify this account before signing in.");
        return;
      }

      const result = await authClient.signIn.email({
        email,
        password,
        callbackURL: "/app",
      });
      if (result.error) throw new Error(result.error.message);
      if (result.data && "twoFactorRedirect" in result.data && result.data.twoFactorRedirect) {
        setSecondFactor(true);
        return;
      }
      window.location.assign("/app");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Authentication failed. Please try again.");
    } finally {
      setWorking(false);
    }
  }

  async function social(provider: SocialProvider) {
    setWorking(true);
    setError("");
    const result = await authClient.signIn.social({ provider, callbackURL: "/app" });
    if (result.error) {
      setError(result.error.message || "This sign-in provider is not configured.");
      setWorking(false);
    }
  }

  return (
    <section className="route-state__card">
      <p className="eyebrow">Nexosophy identity</p>
      <h2>
        {secondFactor
          ? "Verify your authenticator"
          : recover
            ? "Recover your account"
            : mode === "signup"
              ? "Create your account"
              : "Sign in"}
      </h2>
      <form onSubmit={submit}>
        {!secondFactor && !recover && mode === "signup" && (
          <label>
            Full name{" "}
            <input
              name="name"
              autoComplete="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
        )}
        {!secondFactor && (
          <label>
            Email{" "}
            <input
              type="email"
              name="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
        )}
        {!secondFactor && !recover && (
          <label>
            Password{" "}
            <input
              type="password"
              name="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              minLength={mode === "signup" ? 12 : undefined}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
        )}
        {secondFactor && (
          <label>
            6-digit authenticator code{" "}
            <input
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </label>
        )}
        <button type="submit" disabled={working}>
          {working
            ? "Please wait…"
            : secondFactor
              ? "Verify and continue"
              : recover
                ? "Send recovery email"
                : mode === "signup"
                  ? "Create account"
                  : "Sign in"}
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      {!secondFactor && !recover && (
        <fieldset aria-label="Social sign-in methods">
          <p>Or continue with</p>
          {providers.map(({ id, label }) => (
            <button key={id} type="button" disabled={working} onClick={() => void social(id)}>
              {label}
            </button>
          ))}
        </fieldset>
      )}
      {mode === "login" && !secondFactor && (
        <button
          type="button"
          onClick={() => {
            setRecover(!recover);
            setMessage("");
          }}
          disabled={working}
        >
          {recover ? "Back to sign in" : "Forgot password?"}
        </button>
      )}
      <p>
        {mode === "login" ? (
          <a href="/signup">New to Nexosophy? Create an account</a>
        ) : (
          <a href="/login">Already have an account? Sign in</a>
        )}
      </p>
    </section>
  );
}
