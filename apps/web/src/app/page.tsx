import type { Metadata } from "next";
import { ConnectedHome } from "../components/connected-home";

export const metadata: Metadata = {
  title: "Your knowledge in a brighter orbit",
  description:
    "Nexosophy brings notes, sources, files and next steps into one connected workspace for study, research and serious work.",
  alternates: { canonical: "/" },
};

export default function HomePage() {
  return <ConnectedHome />;
}
