import { DeletionRequestForm } from "../../../components/deletion-request-form";
import { getMe } from "../../../lib/api-server";
import { isClerkWebConfigured } from "../../../lib/clerk-config";

export default async function AccountSettingsPage() {
  if (!isClerkWebConfigured()) {
    return (
      <section className="settings-panel">
        <h1>Account settings require authentication.</h1>
        <p>Connect the Clerk development instance to test account lifecycle actions.</p>
      </section>
    );
  }

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
