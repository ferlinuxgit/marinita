import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { UserFacingError } from "@/core/http/errors";

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export function toErrorResponse(error: unknown) {
  if (error instanceof UserFacingError) {
    return jsonError(error.message, error.status);
  }

  if (error instanceof ZodError) {
    return jsonError("Los datos enviados no son válidos.", 400);
  }

  console.error(error);
  return jsonError("Error interno. Inténtalo de nuevo más tarde.", 500);
}
