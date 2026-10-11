import { PreferencesForm } from "../../../components/preferences-form";
import { getMe } from "../../../lib/api-server";

export default async function PreferencesSettingsPage() {
  const account = await getMe();
  return (
    <>
      <header className="settings-heading">
        <p className="eyebrow">Preferences</p>
        <h1>Language, time and interface</h1>
        <p>Timezone is explicit for accurate reminders, calendars and due dates.</p>
      </header>
      <PreferencesForm preferences={account.preferences} />
    </>
  );
}
