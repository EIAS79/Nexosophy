import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { OnboardingForm } from "../../components/onboarding-form";
import { getMe } from "../../lib/api-server";
import {
  assertClerkConfiguredForProtectedEnvironment,
  isClerkWebConfigured,
} from "../../lib/clerk-config";

export default async function OnboardingPage() {
  assertClerkConfiguredForProtectedEnvironment();

  if (!isClerkWebConfigured()) {
    return (
      <main className="route-state" id="main-content">
        <section className="route-state__card">
          <p className="eyebrow">Development configuration</p>
          <h1>Onboarding requires authentication.</h1>
          <p>
            Connect the Clerk development instance before testing account
            onboarding.
          </p>
        </section>
      </main>
    );
  }

  await auth.protect({ unauthenticatedUrl: "/login" });
  const account = await getMe();

  if (
    account.onboarding.status === "completed" ||
    account.onboarding.status === "skipped"
  ) {
    redirect("/app");
  }

  return (
    <main className="onboarding-page" id="main-content">
      <header className="onboarding-page__header">
        <a className="brand" href="/">
          <span className="brand__mark" aria-hidden="true">N</span>
          <span>Nexosophy</span>
        </a>
        <p className="eyebrow">Set up your workspace</p>
        <h1>Tell Nexosophy what kind of work you do.</h1>
        <p>
          These choices personalize defaults and suggestions. They do not change
          your permissions and can be changed later.
        </p>
      </header>
      <OnboardingForm />
    </main>
  );
}
