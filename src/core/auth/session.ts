import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { auth } from "@/core/auth/server";

export type SessionUser = typeof auth.$Infer.Session.user;

// Deduplicated per request: the layout and the page can both ask for the session.
export const getCurrentSession = cache(async () =>
  auth.api.getSession({
    headers: await headers(),
  }),
);

export async function requireUser() {
  const session = await getCurrentSession();
  return session?.user ?? null;
}

/** For server components: returns the user or redirects to the login page. */
export async function requirePageUser() {
  const user = await requireUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}
