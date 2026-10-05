import { SignUp } from "@clerk/nextjs";

import {
  assertClerkConfiguredForProtectedEnvironment,
  isClerkWebConfigured,
} from "../../../lib/clerk-config";

export default function SignupPage() {
  assertClerkConfiguredForProtectedEnvironment();

  if (!isClerkWebConfigured()) {
    return (
      <main className="auth-shell" id="main-content">
        <section className="route-state__card">
          <p className="eyebrow">Development configuration</p>
          <h1>Authentication is not configured.</h1>
          <p>
            Connect the Nexosophy Clerk development instance to create test
            accounts locally.
          </p>
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
        <p className="eyebrow">Create your account</p>
        <h1>Start with one workspace. Grow from there.</h1>
        <p>
          After identity verification, Nexosophy creates its own internal account
          and onboarding state.
        </p>
      </div>
      <div className="auth-shell__provider">
        <SignUp
          path="/signup"
          routing="path"
          signInUrl="/login"
          fallbackRedirectUrl="/onboarding"
          signInFallbackRedirectUrl="/app"
        />
      </div>
    </main>
  );
}
