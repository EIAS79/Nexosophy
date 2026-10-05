import { ProfileForm } from "../../../components/profile-form";
import { getMe } from "../../../lib/api-server";
import { isClerkWebConfigured } from "../../../lib/clerk-config";

export default async function ProfileSettingsPage() {
  if (!isClerkWebConfigured()) {
    return (
      <section className="settings-panel">
        <h1>Profile settings require authentication.</h1>
        <p>Connect the Clerk development instance to test account settings.</p>
      </section>
    );
  }

  const account = await getMe();

  return (
    <>
      <header className="settings-heading">
        <p className="eyebrow">Profile</p>
        <h1>How you appear in Nexosophy</h1>
        <p>
          These fields belong to your Nexosophy profile. Authentication
          identifiers remain managed separately by Clerk.
        </p>
      </header>
      <ProfileForm profile={account.profile} />
    </>
  );
}
