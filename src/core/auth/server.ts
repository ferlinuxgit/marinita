import "server-only";

import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";

import { inviteCodeMatches } from "@/core/auth/invite";
import { db } from "@/core/db";
import * as authSchema from "@/core/db/auth-schema";
import { env } from "@/core/env";

export const auth = betterAuth({
  secret: env.authSecret,
  baseURL: env.authBaseUrl,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: authSchema,
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

      if (!env.allowSignUps || !env.signUpInviteCode) {
        throw new APIError("FORBIDDEN", {
          message: "El registro esta deshabilitado.",
        });
      }

      const body = ctx.body as { inviteCode?: unknown } | undefined;
      const inviteCode =
        typeof body?.inviteCode === "string"
          ? body.inviteCode
          : ctx.headers?.get("x-signup-invite-code");

      if (!inviteCodeMatches(inviteCode, env.signUpInviteCode)) {
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
