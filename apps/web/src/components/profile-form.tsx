"use client";

import { Button, Field } from "@nexosophy/ui";
import { useActionState } from "react";

import {
  updateProfileAction,
  type AccountActionState,
} from "../lib/account-actions";

const initialState: AccountActionState = { ok: false, message: "" };

export function ProfileForm({
  profile,
}: {
  profile: {
    version: number;
    displayName: string;
    preferredName: string | null;
    legalName: string | null;
    pronouns: string | null;
    institutionAffiliation: string | null;
    locale: string;
    timezone: string;
  };
}) {
  const [state, action, pending] = useActionState(updateProfileAction, initialState);

  return (
    <form className="settings-form" action={action}>
      <input type="hidden" name="expectedVersion" value={profile.version} />
      <Field name="displayName" label="Display name" defaultValue={profile.displayName} autoComplete="name" required />
      <Field name="preferredName" label="Preferred name" defaultValue={profile.preferredName ?? ""} autoComplete="nickname" />
      <Field name="legalName" label="Legal name" defaultValue={profile.legalName ?? ""} autoComplete="name" hint="Keep this empty unless a workflow genuinely needs it." />
      <Field name="pronouns" label="Pronouns" defaultValue={profile.pronouns ?? ""} />
      <Field name="institutionAffiliation" label="Institution or affiliation" defaultValue={profile.institutionAffiliation ?? ""} autoComplete="organization" />
      <div className="settings-form__split">
        <Field name="locale" label="Locale" defaultValue={profile.locale} placeholder="en" required />
        <Field name="timezone" label="Timezone" defaultValue={profile.timezone} placeholder="Europe/Warsaw" required />
      </div>
      {state.message ? (
        <p className={state.ok ? "form-status form-status--success" : "form-status form-status--error"} role="status">
          {state.message}
        </p>
      ) : null}
      <div className="settings-form__actions">
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save profile"}</Button>
      </div>
    </form>
  );
}
