import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const backend = process.env.NEXOSOPHY_API_URL ?? "http://127.0.0.1:4000";

export type OwnedSession = {
  user: { id: string; email: string; emailVerified: boolean; name: string };
  session: { id: string; createdAt: string | Date; expiresAt: string | Date };
};

export async function getOwnedSession(): Promise<OwnedSession | null> {
  const jar = await cookies();
  const cookie = jar.toString();
  if (!cookie) return null;
  if (
    (process.env.APP_ENV === "staging" || process.env.APP_ENV === "production") &&
    !process.env.NEXOSOPHY_API_URL
  )
    return null;

  try {
    const response = await fetch(new URL("/api/auth/get-session", backend), {
      headers: { cookie },
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return null;
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== "object") return null;
    const session = payload as Partial<OwnedSession>;
    if (!session.session?.id || !session.user?.id || !session.user.emailVerified) return null;

    // Authorization can be withdrawn independently of a valid Better Auth cookie.
    // A disabled/suspended/deleted Nexosophy user must never render protected layouts.
    const principal = await fetch(new URL("/v1/me", backend), {
      headers: { cookie },
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
    if (!principal.ok) return null;
    return session as OwnedSession;
  } catch {
    return null;
  }
}

export async function requireOwnedSession(): Promise<OwnedSession> {
  const session = await getOwnedSession();
  if (!session) redirect("/login");
  return session;
}
