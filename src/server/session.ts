import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/lib/auth";

export type CurrentUser = { id: string; name: string; email: string };

/**
 * Reads and validates the session once per request.
 *
 * `disableRefresh`: sliding the session here would push its expiry forward in the DB, but the fresh cookie
 * Better Auth sets would be thrown away (a Server Component can't set cookies, and even nextCookies() can't
 * tell a full document load from an action). The cookie would then still expire 30 days after sign-in.
 * The slide happens in the browser instead: UIProvider calls GET /api/auth/get-session, whose response
 * moves the DB row and the cookie together.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth.api.getSession({ headers: await headers(), query: { disableRefresh: true } });
  if (!session) return null;
  const { id, name, email } = session.user;
  return { id, name, email };
});

/** Every query and action goes through this, so data is always scoped to the signed-in user. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
