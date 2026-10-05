import { PreferencesForm } from "../../../components/preferences-form";
import { getMe } from "../../../lib/api-server";
import { isClerkWebConfigured } from "../../../lib/clerk-config";

export default async function PreferencesSettingsPage() {
  if (!isClerkWebConfigured()) {
    return (
      <section className="settings-panel">
        <h1>Preferences require authentication.</h1>
        <p>Connect the Clerk development instance to test account preferences.</p>
      </section>
    );
  }

  const account = await getMe();

  return (
    <>
      <header className="settings-heading">
        <p className="eyebrow">Preferences</p>
        <h1>Language, time and interface</h1>
        <p>
          Timezone is explicit because reminders, calendars and due dates must
          not depend on an ambiguous browser locale.
        </p>
      </header>
      <PreferencesForm preferences={account.preferences} />
    </>
  );
}
