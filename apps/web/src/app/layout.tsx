import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import "@nexosophy/ui/styles.css";
import { ToastProvider } from "@nexosophy/ui";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Nexosophy",
    template: "%s · Nexosophy",
  },
  description:
    "Connected knowledge for study, research, laboratories, reporting and analysis.",
  metadataBase: new URL("https://nexosophy.com"),
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  const content = (
    <>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <ToastProvider>{children}</ToastProvider>
    </>
  );

  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        {publishableKey ? (
          <ClerkProvider
            publishableKey={publishableKey}
            signInUrl="/login"
            signUpUrl="/signup"
            signInFallbackRedirectUrl="/app"
            signUpFallbackRedirectUrl="/onboarding"
          >
            {content}
          </ClerkProvider>
        ) : (
          content
        )}
      </body>
    </html>
  );
}
