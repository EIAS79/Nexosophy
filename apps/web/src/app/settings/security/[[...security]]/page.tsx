import { UserProfile } from "@clerk/nextjs";

import {
  assertClerkConfiguredForProtectedEnvironment,
  isClerkWebConfigured,
} from "../../../../lib/clerk-config";

export default function SecuritySettingsPage() {
  assertClerkConfiguredForProtectedEnvironment();

  if (!isClerkWebConfigured()) {
    return (
      <section className="settings-panel">
        <h1>Security settings are unavailable.</h1>
        <p>Connect Clerk to manage sign-in methods, sessions, MFA and passkeys.</p>
      </section>
    );
  }

  return (
    <>
      <header className="settings-heading">
        <p className="eyebrow">Security</p>
        <h1>Sign-in methods and sessions</h1>
        <p>
          This surface is provider-owned. Nexosophy never stores passwords,
          OAuth refresh credentials, passkey private material or MFA secrets.
        </p>
      </header>
      <div className="provider-settings">
        <UserProfile path="/settings/security" routing="path" />
      </div>
    </>
  );
}
