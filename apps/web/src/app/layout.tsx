import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import "@nexosophy/ui/styles.css";
import { ToastProvider } from "@nexosophy/ui";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Nexosophy",
    template: "%s · Nexosophy",
  },
  description: "Connected knowledge for study, research, laboratories, reporting and analysis.",
  metadataBase: new URL("https://nexosophy.com"),
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Nexosophy", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#171925",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <a className="skip-link" href="#main-content">
          Skip to main content
        </a>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
