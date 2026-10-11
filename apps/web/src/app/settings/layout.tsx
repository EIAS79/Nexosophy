import type { ReactNode } from "react";
import { requireOwnedSession } from "../../lib/auth-server";

const items = [
  ["/settings/profile", "Profile"],
  ["/settings/preferences", "Preferences"],
  ["/settings/security", "Security"],
  ["/settings/account", "Account"],
] as const;

export default async function SettingsLayout({ children }: { children: ReactNode }) {
  await requireOwnedSession();
  return (
    <div className="settings-shell">
      <header className="settings-shell__top">
        <a className="brand" href="/app">
          Nexosophy
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
