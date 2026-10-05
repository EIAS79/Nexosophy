"use client";

import { useReverification } from "@clerk/nextjs";
import { isReverificationCancelledError } from "@clerk/nextjs/errors";
import { Button, Field } from "@nexosophy/ui";
import { useState } from "react";

import {
  requestDeletionAction,
  type AccountActionState,
} from "../lib/account-actions";

const initialState: AccountActionState = { ok: false, message: "" };

export function DeletionRequestForm() {
  const [state, setState] = useState(initialState);
  const [pending, setPending] = useState(false);
  const requestDeletion = useReverification(requestDeletionAction);

  return (
    <form
      className="settings-form danger-zone"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);

        try {
          const result = await requestDeletion(new FormData(event.currentTarget));
          if (result) setState(result);
        } catch (error) {
          if (isReverificationCancelledError(error)) {
            setState({
              ok: false,
              message: "Identity verification was cancelled. No deletion request was created.",
            });
          } else {
            setState({
              ok: false,
              message: "The deletion request could not be completed.",
            });
          }
        } finally {
          setPending(false);
        }
      }}
    >
      <Field
        name="reasonCategory"
        label="Reason (optional)"
        placeholder="For example: no longer needed"
      />
      <p>
        This records a deletion request. Content is not immediately hard-deleted;
        retention, workspace ownership and recovery rules are applied by the deletion pipeline.
        Nexosophy requires recent identity verification before accepting this action.
      </p>
      {state.message ? (
        <p
          className={
            state.ok
              ? "form-status form-status--success"
              : "form-status form-status--error"
          }
          role="status"
        >
          {state.message}
        </p>
      ) : null}
      <Button type="submit" variant="danger" disabled={pending}>
        {pending ? "Verifying…" : "Request account deletion"}
      </Button>
    </form>
  );
}
