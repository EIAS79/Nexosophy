"use client";

import { Button } from "@nexosophy/ui";
import { useActionState } from "react";

import {
  updatePreferencesAction,
  type AccountActionState,
} from "../lib/account-actions";

const initialState: AccountActionState = { ok: false, message: "" };

export function PreferencesForm({
  preferences,
}: {
  preferences: {
    version: number;
    locale: string;
    timezone: string;
    theme: string;
    density: string;
  };
}) {
  const [state, action, pending] = useActionState(updatePreferencesAction, initialState);

  return (
    <form className="settings-form" action={action}>
      <input type="hidden" name="expectedVersion" value={preferences.version} />
      <label className="settings-control">
        <span>Locale</span>
        <input name="locale" defaultValue={preferences.locale} required />
      </label>
      <label className="settings-control">
        <span>Timezone</span>
        <input name="timezone" defaultValue={preferences.timezone} required />
      </label>
      <label className="settings-control">
        <span>Theme</span>
        <select name="theme" defaultValue={preferences.theme}>
          <option value="system">System</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </label>
      <label className="settings-control">
        <span>Density</span>
        <select name="density" defaultValue={preferences.density}>
          <option value="comfortable">Comfortable</option>
          <option value="compact">Compact</option>
        </select>
      </label>
      {state.message ? (
        <p className={state.ok ? "form-status form-status--success" : "form-status form-status--error"} role="status">
          {state.message}
        </p>
      ) : null}
      <div className="settings-form__actions">
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save preferences"}</Button>
      </div>
    </form>
  );
}
