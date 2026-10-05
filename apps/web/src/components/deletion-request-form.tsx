"use client";

import { Button, Field } from "@nexosophy/ui";
import { useActionState } from "react";

import {
  requestDeletionAction,
  type AccountActionState,
} from "../lib/account-actions";

const initialState: AccountActionState = { ok: false, message: "" };

export function DeletionRequestForm() {
  const [state, action, pending] = useActionState(
    requestDeletionAction,
    initialState,
  );

  return (
    <form className="settings-form danger-zone" action={action}>
      <Field name="reasonCategory" label="Reason (optional)" placeholder="For example: no longer needed" />
      <p>
        This records a deletion request. Content is not immediately hard-deleted;
        retention, workspace ownership and recovery rules are applied by the deletion pipeline.
      </p>
      {state.message ? (
        <p className={state.ok ? "form-status form-status--success" : "form-status form-status--error"} role="status">
          {state.message}
        </p>
      ) : null}
      <Button type="submit" variant="danger" disabled={pending}>
        {pending ? "Requesting…" : "Request account deletion"}
      </Button>
    </form>
  );
}
