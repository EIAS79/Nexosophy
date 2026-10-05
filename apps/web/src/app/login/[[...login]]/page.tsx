import { SignIn } from "@clerk/nextjs";

import {
  assertClerkConfiguredForProtectedEnvironment,
  isClerkWebConfigured,
} from "../../../lib/clerk-config";

export default function LoginPage() {
  assertClerkConfiguredForProtectedEnvironment();

  if (!isClerkWebConfigured()) {
    return (
      <main className="auth-shell" id="main-content">
        <section className="route-state__card">
          <p className="eyebrow">Development configuration</p>
          <h1>Authentication is not configured.</h1>
          <p>Connect the Nexosophy Clerk development instance to use sign in locally.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="auth-shell" id="main-content">
      <div className="auth-shell__context">
        <a className="brand" href="/">
          <span className="brand__mark" aria-hidden="true">N</span>
          <span>Nexosophy</span>
        </a>
        <p className="eyebrow">Welcome back</p>
        <h1>Return to your connected workspace.</h1>
        <p>
          Authentication is handled by Clerk; workspace access is still enforced
          by Nexosophy.
        </p>
      </div>
      <div className="auth-shell__provider">
        <SignIn
          path="/login"
          routing="path"
          signUpUrl="/signup"
          fallbackRedirectUrl="/app"
          signUpFallbackRedirectUrl="/onboarding"
        />
      </div>
    </main>
  );
}
