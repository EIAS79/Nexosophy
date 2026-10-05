import { redirect } from "next/navigation";

export default function LegacySecurityRoute() {
  redirect("/settings/security");
}
