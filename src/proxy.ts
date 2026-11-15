import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

// Optimistic check only: bounce visitors without a session cookie to /login early.
// Real authorization happens in the data layer (src/server/session.ts) on every read and write.
// (No "/login → /" redirect here: a stale cookie would bounce between the two pages forever.)
export function proxy(request: NextRequest) {
  const hasSession = Boolean(getSessionCookie(request));
  const isLogin = request.nextUrl.pathname === "/login";

  if (!hasSession && !isLogin) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|ico|webp)$).*)"],
};
