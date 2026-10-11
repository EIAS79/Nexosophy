import { DeletionRequestForm } from "../../../components/deletion-request-form";
import { getMe } from "../../../lib/api-server";

export default async function AccountSettingsPage() {
  const account = await getMe();
  return (
    <>
      <header className="settings-heading">
        <p className="eyebrow">Account lifecycle</p>
        <h1>Account status and deletion</h1>
        <p>
          Current internal account state: <strong>{account.status}</strong>.
        </p>
      </header>
      <section className="settings-panel">
        <h2>Authentication account</h2>
        <p>Manage sessions, sign-in methods, MFA and passkeys in Security.</p>
        <a className="text-link" href="/settings/security">
          Open security settings →
        </a>
      </section>
      <section className="settings-panel">
        <h2>Danger zone</h2>
        <DeletionRequestForm />
      </section>
    </>
  );
}
