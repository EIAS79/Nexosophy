import { auth } from "@clerk/nextjs/server";
import type { ReactNode } from "react";

import {
  assertClerkConfiguredForProtectedEnvironment,
  isClerkWebConfigured,
} from "../../lib/clerk-config";

const items = [
  ["/settings/profile", "Profile"],
  ["/settings/preferences", "Preferences"],
  ["/settings/security", "Security"],
  ["/settings/account", "Account"],
] as const;

export default async function SettingsLayout({
  children,
}: {
  children: ReactNode;
}) {
  assertClerkConfiguredForProtectedEnvironment();

  if (isClerkWebConfigured()) {
    await auth.protect({ unauthenticatedUrl: "/login" });
  }

  return (
    <div className="settings-shell">
      <header className="settings-shell__top">
        <a className="brand" href="/app">
          <span className="brand__mark" aria-hidden="true">N</span>
          <span>Nexosophy</span>
        </a>
        <a href="/app">Back to workspace</a>
      </header>
      <div className="settings-shell__body">
        <aside className="settings-nav">
          <p className="eyebrow">Settings</p>
          <nav aria-label="Settings">
            {items.map(([href, label]) => (
              <a key={href} href={href}>
                {label}
              </a>
            ))}
          </nav>
        </aside>
        <main className="settings-content" id="main-content">
          {children}
        </main>
      </div>
    </div>
  );
}
