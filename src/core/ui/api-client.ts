export class ApiRequestError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
  }
}

async function readErrorMessage(response: Response, fallback: string) {
  try {
    const payload = (await response.json()) as { error?: unknown };
    return typeof payload.error === "string" && payload.error ? payload.error : fallback;
  } catch {
    return fallback;
  }
}

async function send(url: string, init: RequestInit | undefined, fallbackError: string) {
  let response: Response;

  try {
    response = await fetch(url, { cache: "no-store", ...init });
  } catch {
    throw new ApiRequestError("No se pudo conectar con el servidor. Inténtalo de nuevo.", 0);
  }

  if (!response.ok) {
    throw new ApiRequestError(await readErrorMessage(response, fallbackError), response.status);
  }

  return response;
}

/** Fetches a module API route and returns the JSON body, throwing `ApiRequestError` on failure. */
export async function fetchJson<T>(url: string, init: RequestInit | undefined, fallbackError: string) {
  const response = await send(url, init, fallbackError);
  return (await response.json()) as T;
}

/** Fetches a file from a module API route and triggers a browser download. */
export async function downloadFile(
  url: string,
  init: RequestInit | undefined,
  fileName: string,
  fallbackError: string,
) {
  const response = await send(url, init, fallbackError);
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(objectUrl);
}

export function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiRequestError ? error.message : fallback;
}

export function uploadBody(file: File, field = "file") {
  const body = new FormData();
  body.append(field, file);
  return body;
}
