import "server-only";

import { NextResponse } from "next/server";
import { z } from "zod";

import { UserFacingError } from "@/core/http/errors";
import { withUser } from "@/core/http/handler";
import { xlsxResponse } from "@/core/http/responses";
import { readUploadedFile } from "@/core/http/upload";
import { facturasConfig } from "@/modules/facturas/config";
import { analyzeInvoiceText } from "@/modules/facturas/lib/invoice";
import { buildInvoiceLinesWorkbook } from "@/modules/facturas/lib/lines-workbook";
import { extractPdfText } from "@/modules/facturas/lib/pdf-text";
import { INVOICE_LINE_HEADERS } from "@/modules/facturas/lib/types";

export const exportRequestSchema = z.object({
  invoiceNumber: z.string().max(100),
  lines: z
    .array(
      z
        .array(z.union([z.string().max(500), z.number().finite()]))
        .length(INVOICE_LINE_HEADERS.length),
    )
    .min(1)
    .max(facturasConfig.maxExportLines),
});

export type ExportRequest = z.infer<typeof exportRequestSchema>;

export const analyzeInvoiceHandler = withUser(async ({ request }) => {
  const file = await readUploadedFile(request, {
    extensions: [".pdf"],
    mimeTypes: ["application/pdf"],
    maxBytes: facturasConfig.upload.maxBytes,
    label: "una factura en PDF",
  });
  const text = await extractPdfText(file.buffer);

  return NextResponse.json(analyzeInvoiceText(text, file.name));
});

// Receives the lines already shown to the user instead of re-uploading and re-parsing the PDF.
export const exportLinesHandler = withUser(async ({ request }) => {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    throw new UserFacingError("Los datos enviados no son válidos.");
  }

  const { invoiceNumber, lines } = exportRequestSchema.parse(body);
  const workbook = await buildInvoiceLinesWorkbook(lines);
  const safeInvoiceNumber = invoiceNumber.replace(/[^a-zA-Z0-9_-]/g, "") || "factura";

  return xlsxResponse(workbook, `Lineas_${safeInvoiceNumber}.xlsx`);
});
