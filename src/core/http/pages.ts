import "server-only";

import { notFound } from "next/navigation";

import { NotFoundError } from "@/core/http/errors";

/** For server pages: resolves the promise, or renders the 404 page if it throws `NotFoundError`. */
export async function orNotFound<T>(promise: Promise<T>): Promise<T> {
  try {
    return await promise;
  } catch (error) {
    if (error instanceof NotFoundError) {
      notFound();
    }

    throw error;
  }
}
