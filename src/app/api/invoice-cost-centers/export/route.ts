import { NextResponse } from "next/server";

import { buildInvoiceLinesWorkbook } from "@/lib/invoice-lines-excel";
import { analyzeInvoicePdf } from "@/lib/invoice-pdf";
import { requireUser } from "@/lib/session";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 20 * 1024 * 1024;

export async function POST(request: Request) {
  const user = await requireUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Sube una factura en PDF." }, { status: 400 });
  }

  if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
    return NextResponse.json({ error: "Solo se admiten archivos PDF." }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "El PDF supera el límite de 20 MB." }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const analysis = await analyzeInvoicePdf(buffer, file.name);
    const workbook = await buildInvoiceLinesWorkbook(analysis);
    const invoiceNumber = analysis.invoiceNumber.replace(/[^a-zA-Z0-9_-]/g, "") || "factura";

    return new NextResponse(new Uint8Array(workbook), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="Lineas_${invoiceNumber}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo generar el Excel.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
