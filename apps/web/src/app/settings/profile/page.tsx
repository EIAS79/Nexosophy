import { ProfileForm } from "../../../components/profile-form";
import { getMe } from "../../../lib/api-server";

export default async function ProfileSettingsPage() {
  const account = await getMe();
  return (
    <>
      <header className="settings-heading">
        <p className="eyebrow">Profile</p>
        <h1>How you appear in Nexosophy</h1>
        <p>Your profile and identity belong to Nexosophy, with separate workspace authorization.</p>
      </header>
      <ProfileForm profile={account.profile} />
    </>
  );
}
