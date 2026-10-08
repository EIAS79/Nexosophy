import type { Metadata } from "next";
import { ConnectedHome } from "../components/connected-home";

export const metadata: Metadata = {
  title: "A place for your thinking to become something",
  description:
    "Nexosophy brings notes, sources, files and next steps into one connected workspace for study, research and serious work.",
  alternates: { canonical: "/" },
};

export default function HomePage() {
  return <ConnectedHome />;
}
