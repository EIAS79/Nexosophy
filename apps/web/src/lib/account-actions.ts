"use server";

import type { MeResponse } from "@nexosophy/contracts";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { NexosophyApiError, nexosophyApi } from "./api-server";

export type AccountActionState = {
  ok: boolean;
  message: string;
};

const initialError: AccountActionState = {
  ok: false,
  message: "The request could not be completed.",
};

function text(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

function nullableText(formData: FormData, key: string): string | null {
  return text(formData, key) ?? null;
}

function version(formData: FormData): number {
  const raw = formData.get("expectedVersion");
  const parsed = typeof raw === "string" ? Number.parseInt(raw, 10) : Number.NaN;
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error("Invalid optimistic concurrency version.");
  }
  return parsed;
}

function actionError(error: unknown): AccountActionState {
  if (error instanceof NexosophyApiError) {
    return { ok: false, message: error.message };
  }
  return initialError;
}

export async function updateProfileAction(
  _previous: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  try {
    await nexosophyApi<MeResponse>("/v1/me", {
      method: "PATCH",
      body: JSON.stringify({
        expectedVersion: version(formData),
        displayName: text(formData, "displayName"),
        preferredName: nullableText(formData, "preferredName"),
        legalName: nullableText(formData, "legalName"),
        pronouns: nullableText(formData, "pronouns"),
        institutionAffiliation: nullableText(formData, "institutionAffiliation"),
        locale: text(formData, "locale"),
        timezone: text(formData, "timezone"),
      }),
    });

    revalidatePath("/settings/profile");
    return { ok: true, message: "Profile saved." };
  } catch (error) {
    return actionError(error);
  }
}

export async function updatePreferencesAction(
  _previous: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  try {
    await nexosophyApi("/v1/me/preferences", {
      method: "PATCH",
      body: JSON.stringify({
        expectedVersion: version(formData),
        locale: text(formData, "locale"),
        timezone: text(formData, "timezone"),
        theme: text(formData, "theme"),
        density: text(formData, "density"),
      }),
    });

    revalidatePath("/settings/preferences");
    return { ok: true, message: "Preferences saved." };
  } catch (error) {
    return actionError(error);
  }
}

export async function completeOnboardingAction(
  _previous: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  try {
    const personas = formData
      .getAll("personas")
      .filter((value): value is string => typeof value === "string");
    const interests = formData
      .getAll("interests")
      .filter((value): value is string => typeof value === "string");

    await nexosophyApi("/v1/onboarding/complete", {
      method: "POST",
      body: JSON.stringify({
        skipped: false,
        personas,
        interests,
      }),
    });
  } catch (error) {
    return actionError(error);
  }

  redirect("/app");
}

export async function skipOnboardingAction(): Promise<void> {
  await nexosophyApi("/v1/onboarding/complete", {
    method: "POST",
    body: JSON.stringify({
      skipped: true,
      personas: [],
      interests: [],
    }),
  });

  redirect("/app");
}

export async function requestDeletionAction(
  _previous: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  try {
    await nexosophyApi("/v1/me/deletion-request", {
      method: "POST",
      body: JSON.stringify({
        reasonCategory: text(formData, "reasonCategory"),
      }),
    });

    return {
      ok: true,
      message:
        "Deletion request recorded. Your account remains recoverable until the deletion pipeline advances.",
    };
  } catch (error) {
    return actionError(error);
  }
}
