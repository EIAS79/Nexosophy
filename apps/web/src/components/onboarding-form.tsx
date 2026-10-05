"use client";

import { Button } from "@nexosophy/ui";
import { useActionState } from "react";

import {
  completeOnboardingAction,
  skipOnboardingAction,
  type AccountActionState,
} from "../lib/account-actions";

const initialState: AccountActionState = { ok: false, message: "" };

const personas = [
  "Student",
  "Postgraduate researcher",
  "Professor or instructor",
  "Researcher",
  "Laboratory member",
  "Reporter",
  "Analyst",
] as const;

const interests = [
  "Coursework",
  "Literature review",
  "Research projects",
  "Laboratory records",
  "Writing",
  "Data analysis",
  "Planning",
  "Collaboration",
] as const;

export function OnboardingForm() {
  const [state, action, pending] = useActionState(
    completeOnboardingAction,
    initialState,
  );

  return (
    <div className="onboarding-form">
      <form action={action}>
        <fieldset>
          <legend>What best describes your work?</legend>
          <p>Select any that apply. You can change this later.</p>
          <div className="choice-grid">
            {personas.map((persona) => (
              <label key={persona} className="choice-card">
                <input type="checkbox" name="personas" value={persona} />
                <span>{persona}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>What do you want to organize first?</legend>
          <div className="choice-grid">
            {interests.map((interest) => (
              <label key={interest} className="choice-card">
                <input type="checkbox" name="interests" value={interest} />
                <span>{interest}</span>
              </label>
            ))}
          </div>
        </fieldset>
        {state.message ? (
          <p className="form-status form-status--error" role="alert">
            {state.message}
          </p>
        ) : null}
        <div className="settings-form__actions">
          <Button type="submit" disabled={pending}>{pending ? "Finishing…" : "Continue to workspace"}</Button>
        </div>
      </form>
      <form action={skipOnboardingAction}>
        <Button type="submit" variant="ghost">Skip for now</Button>
      </form>
    </div>
  );
}
