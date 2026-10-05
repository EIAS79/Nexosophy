export function isClerkWebConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
      process.env.CLERK_SECRET_KEY,
  );
}

export function assertClerkConfiguredForProtectedEnvironment(): void {
  if (
    (process.env.APP_ENV === "staging" || process.env.APP_ENV === "production") &&
    !isClerkWebConfigured()
  ) {
    throw new Error(
      "Clerk authentication configuration is required in staging and production.",
    );
  }
}
