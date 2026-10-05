import "server-only";

import { z } from "zod";

const DEV_DATABASE_URL = "postgres://postgres:postgres@localhost:55432/marinita";
const DEV_AUTH_SECRET = "dev-only-secret-change-this-before-deploying-marinita";

const optionalString = z
  .string()
  .optional()
  .transform((value) => (value?.trim() ? value.trim() : undefined));

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  NEXT_PHASE: optionalString,
  DATABASE_URL: optionalString,
  BETTER_AUTH_SECRET: optionalString,
  BETTER_AUTH_URL: optionalString,
  NEXT_PUBLIC_APP_URL: optionalString,
  AUTH_ALLOW_SIGNUPS: optionalString,
  SIGNUP_INVITE_CODE: optionalString,
});

const parsed = envSchema.parse(process.env);

// `next build` evaluates server modules with NODE_ENV=production but without runtime secrets.
const isProductionRuntime =
  parsed.NODE_ENV === "production" && parsed.NEXT_PHASE !== "phase-production-build";

function requiredInProduction(name: string, value: string | undefined, devFallback: string) {
  if (value) {
    return value;
  }

  if (isProductionRuntime) {
    throw new Error(`La variable de entorno ${name} es obligatoria en producción.`);
  }

  return devFallback;
}

export const env = {
  databaseUrl: requiredInProduction("DATABASE_URL", parsed.DATABASE_URL, DEV_DATABASE_URL),
  authSecret: requiredInProduction("BETTER_AUTH_SECRET", parsed.BETTER_AUTH_SECRET, DEV_AUTH_SECRET),
  authBaseUrl: parsed.BETTER_AUTH_URL ?? parsed.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  allowSignUps: parsed.AUTH_ALLOW_SIGNUPS === "true",
  signUpInviteCode: parsed.SIGNUP_INVITE_CODE,
};
