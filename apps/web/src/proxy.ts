import { NextResponse } from "next/server";

// Protected layouts verify a Nexosophy-owned server session. This proxy does
// not grant access; the API independently verifies every privileged request.
export default function proxy() {
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|.*\\.(?:css|js|png|webp|svg|ico|woff2?)).*)"],
};
