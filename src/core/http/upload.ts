import "server-only";

import { UserFacingError } from "@/core/http/errors";

export type UploadRules = {
  /** Lowercase extensions including the dot, e.g. `[".xlsx"]`. */
  extensions: string[];
  mimeTypes?: string[];
  maxBytes: number;
  /** Human label used in error messages, e.g. "un archivo .xlsx". */
  label: string;
  field?: string;
};

export type UploadedFile = {
  name: string;
  size: number;
  buffer: Buffer;
  /** The whole form, to read other fields sent with the file. */
  form: FormData;
};

export async function readUploadedFile(request: Request, rules: UploadRules): Promise<UploadedFile> {
  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    throw new UserFacingError(`Sube ${rules.label}.`);
  }

  const file = formData.get(rules.field ?? "file");

  if (!(file instanceof File)) {
    throw new UserFacingError(`Sube ${rules.label}.`);
  }

  const name = file.name.toLowerCase();
  const validExtension = rules.extensions.some((extension) => name.endsWith(extension));
  const validMimeType = rules.mimeTypes?.includes(file.type) ?? false;

  if (!validExtension && !validMimeType) {
    throw new UserFacingError(`Solo se admite ${rules.label}.`);
  }

  if (file.size > rules.maxBytes) {
    const megabytes = Math.round(rules.maxBytes / 1024 / 1024);
    throw new UserFacingError(`El archivo supera el límite de ${megabytes} MB.`);
  }

  return {
    name: file.name,
    size: file.size,
    buffer: Buffer.from(await file.arrayBuffer()),
    form: formData,
  };
}
