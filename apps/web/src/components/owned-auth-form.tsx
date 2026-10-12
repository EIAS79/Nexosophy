"use client";

import { useEffect, useState, type FormEvent } from "react";
import { authClient } from "../lib/auth-client";

type AuthMode = "login" | "signup";
type SocialProvider = "google" | "github" | "facebook" | "apple";

type Capabilities = { emailSignupAvailable: boolean; socialProviders: SocialProvider[] };

const providers: { id: SocialProvider; label: string }[] = [
  { id: "google", label: "Google" },
  { id: "github", label: "GitHub" },
  { id: "facebook", label: "Facebook" },
  { id: "apple", label: "Apple" },
];

export function OwnedAuthForm({ mode }: { mode: AuthMode }) {
  const [capabilities, setCapabilities] = useState<Capabilities>({
    emailSignupAvailable: false,
    socialProviders: [],
  });
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/auth/capabilities", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Auth capabilities unavailable");
        return (await response.json()) as Capabilities;
      })
      .then((value) => {
        if (!controller.signal.aborted) {
          setCapabilities({
            emailSignupAvailable: value.emailSignupAvailable === true,
            socialProviders: Array.isArray(value.socialProviders)
              ? value.socialProviders.filter((provider) =>
                  ["google", "github", "facebook", "apple"].includes(provider),
                )
              : [],
          });
        }
      })
      .catch(() => {
        // Failed capability discovery never enables a sign-up method.
      });
    return () => controller.abort();
  }, []);
  const availableSocialProviders = providers.filter(({ id }) =>
    capabilities.socialProviders.includes(id),
  );

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [secondFactor, setSecondFactor] = useState(false);
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [recover, setRecover] = useState(false);
  const emailActionUnavailable =
    (mode === "signup" || recover) && !capabilities.emailSignupAvailable;
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWorking(true);
    setError("");
    try {
      if (secondFactor) {
        const result = useBackupCode
          ? await authClient.twoFactor.verifyBackupCode({ code: code.trim() })
          : await authClient.twoFactor.verifyTotp({ code: code.trim() });
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

  async function signInWithPasskey() {
    setWorking(true);
    setError("");
    try {
      if (!window.isSecureContext || !("PublicKeyCredential" in window)) {
        throw new Error("Passkey sign-in requires a secure, WebAuthn-capable browser.");
      }
      const result = await authClient.signIn.passkey();
      if (result.error) throw new Error(result.error.message || "Passkey sign-in failed.");
      window.location.assign("/app");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Passkey sign-in failed.");
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
            {useBackupCode ? "One-time recovery code" : "6-digit authenticator code"}{" "}
            <input
              name="code"
              inputMode={useBackupCode ? "text" : "numeric"}
              autoComplete={useBackupCode ? "off" : "one-time-code"}
              required
              maxLength={useBackupCode ? 128 : 6}
              minLength={useBackupCode ? 1 : 6}
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </label>
        )}
        <button type="submit" disabled={working || emailActionUnavailable}>
          {working
            ? "Please wait…"
            : secondFactor
              ? useBackupCode
                ? "Use recovery code"
                : "Verify and continue"
              : recover
                ? "Send recovery email"
                : mode === "signup"
                  ? "Create account"
                  : "Sign in"}
        </button>
      </form>
      {secondFactor && (
        <button
          type="button"
          disabled={working}
          onClick={() => {
            setUseBackupCode(!useBackupCode);
            setCode("");
            setError("");
          }}
        >
          {useBackupCode ? "Use authenticator app" : "Use a recovery code instead"}
        </button>
      )}
      {mode === "login" && !secondFactor && !recover && (
        <button type="button" disabled={working} onClick={() => void signInWithPasskey()}>
          Sign in with a passkey
        </button>
      )}
      {emailActionUnavailable && (
        <p role="status">
          Email registration and recovery are unavailable until Nexosophy's sending domain is
          verified. Existing accounts can still sign in.
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      {!secondFactor && !recover && availableSocialProviders.length > 0 && (
        <fieldset aria-label="Social sign-in methods">
          <p>Or continue with</p>
          {availableSocialProviders.map(({ id, label }) => (
            <button key={id} type="button" disabled={working} onClick={() => void social(id)}>
              {label}
            </button>
          ))}
        </fieldset>
      )}
      {mode === "login" && !secondFactor && capabilities.emailSignupAvailable && (
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
