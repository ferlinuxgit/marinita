import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";

import { db } from "@/db";
import * as schema from "@/db/schema";

export const auth = betterAuth({
  secret:
    process.env.BETTER_AUTH_SECRET ??
    "dev-only-secret-change-this-before-deploying-marinita",
  baseURL: process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-up/email") {
        return;
      }

      if (process.env.AUTH_ALLOW_SIGNUPS !== "true") {
        throw new APIError("FORBIDDEN", {
          message: "El registro esta deshabilitado.",
        });
      }

      const expectedInviteCode = process.env.SIGNUP_INVITE_CODE;

      if (!expectedInviteCode) {
        throw new APIError("FORBIDDEN", {
          message: "El registro esta deshabilitado.",
        });
      }

      const body = ctx.body as { inviteCode?: unknown } | undefined;
      const inviteCode =
        typeof body?.inviteCode === "string"
          ? body.inviteCode
          : ctx.headers?.get("x-signup-invite-code");

      if (inviteCode !== expectedInviteCode) {
        throw new APIError("FORBIDDEN", {
          message: "Codigo de invitacion invalido.",
        });
      }
    }),
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
});
