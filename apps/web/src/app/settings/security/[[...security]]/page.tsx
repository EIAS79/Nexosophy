import { OwnedSecurityPanel } from "../../../../components/owned-security-panel";

export default function SecuritySettingsPage() {
  return (
    <>
      <header className="settings-heading">
        <p className="eyebrow">Security</p>
        <h1>Sign-in methods and sessions</h1>
        <p>
          Nexosophy manages your accounts, sessions, devices, passkeys and MFA on its own
          infrastructure.
        </p>
      </header>
      <OwnedSecurityPanel />
    </>
  );
}
