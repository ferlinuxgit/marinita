// Runs once when the server starts: validate the environment so a misconfigured deploy fails at
// boot instead of on the first request.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("@/core/env");
  }
}
