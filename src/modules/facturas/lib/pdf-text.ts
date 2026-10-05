import "server-only";

import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { getDocument, GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf.mjs";

import { UserFacingError } from "@/core/http/errors";
import type { PdfText } from "@/modules/facturas/lib/invoice";

// The Docker image copies the worker next to server.js (see Dockerfile).
const packagedWorkerPath = join(process.cwd(), "pdf.worker.mjs");
const installedWorkerPath = join(
  process.cwd(),
  "node_modules",
  "pdfjs-dist",
  "legacy",
  "build",
  "pdf.worker.mjs",
);

GlobalWorkerOptions.workerSrc = pathToFileURL(
  existsSync(packagedWorkerPath) ? packagedWorkerPath : installedWorkerPath,
).href;

type PdfTextItem = {
  str: string;
};

/** Extracts the non-empty text items of every page, in reading order. */
export async function extractPdfText(buffer: Buffer): Promise<PdfText> {
  const data = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const loadingTask = getDocument({ data });
  const tokens: string[] = [];

  try {
    let pdf;

    try {
      pdf = await loadingTask.promise;
    } catch {
      throw new UserFacingError("El archivo no es un PDF válido o está protegido.");
    }

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();

      for (const item of content.items) {
        if (!("str" in item)) {
          continue;
        }

        const value = (item as PdfTextItem).str.trim();

        if (value) {
          tokens.push(value);
        }
      }
    }

    return { tokens, pageCount: pdf.numPages };
  } finally {
    await loadingTask.destroy();
  }
}
