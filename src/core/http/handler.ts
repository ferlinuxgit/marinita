import "server-only";

import { requireUser, type SessionUser } from "@/core/auth/session";
import { jsonError, toErrorResponse } from "@/core/http/error-response";

type RouteContext<Params> = {
  params: Promise<Params>;
};

export type AuthedRequest<Params> = {
  request: Request;
  user: SessionUser;
  params: Params;
};

/**
 * Wraps a route handler: requires a signed-in user, resolves route params and turns thrown errors
 * into JSON responses (`UserFacingError` → its status, anything else → 500 without details).
 */
export function withUser<Params extends Record<string, string> = Record<string, never>>(
  handler: (args: AuthedRequest<Params>) => Promise<Response>,
) {
  return async (request: Request, context: RouteContext<Params>) => {
    const user = await requireUser();

    if (!user) {
      return jsonError("No autorizado.", 401);
    }

    try {
      return await handler({ request, user, params: await context.params });
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}
