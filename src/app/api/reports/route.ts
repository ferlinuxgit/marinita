import { randomUUID } from "node:crypto";

import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { reportRows, reports } from "@/db/schema";
import { analyzePaymentsWorkbook } from "@/lib/excel";
import { requireUser } from "@/lib/session";

const MAX_FILE_SIZE = 8 * 1024 * 1024;

export async function GET() {
  const user = await requireUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const userReports = await db
    .select({
      id: reports.id,
      fileName: reports.fileName,
      sourceRowCount: reports.sourceRowCount,
      filteredRowCount: reports.filteredRowCount,
      groupCount: reports.groupCount,
      createdAt: reports.createdAt,
    })
    .from(reports)
    .where(eq(reports.userId, user.id))
    .orderBy(desc(reports.createdAt))
    .limit(50);

  return NextResponse.json({ reports: userReports });
}

export async function POST(request: Request) {
  const user = await requireUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Sube un archivo .xlsx." }, { status: 400 });
  }

  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    return NextResponse.json({ error: "Solo se admiten archivos .xlsx." }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "El archivo supera el limite de 8 MB." }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const analysis = await analyzePaymentsWorkbook(buffer);
    const reportId = randomUUID();

    await db.transaction(async (tx) => {
      await tx.insert(reports).values({
        id: reportId,
        userId: user.id,
        fileName: file.name,
        sourceRowCount: analysis.sourceRowCount,
        filteredRowCount: analysis.filteredRowCount,
        groupCount: analysis.rows.length,
      });

      if (analysis.rows.length > 0) {
        await tx.insert(reportRows).values(
          analysis.rows.map((row) => ({
            id: randomUUID(),
            reportId,
            accountCode: row.accountCode,
            teamsExternalId: row.teamsExternalId,
            expenseOwnerId: row.expenseOwnerId,
            expenseOwner: row.expenseOwner,
            totalAgrupadoEur: row.totalAgrupadoEur.toFixed(2),
          })),
        );
      }
    });

    return NextResponse.json({
      report: {
        id: reportId,
        fileName: file.name,
        sourceRowCount: analysis.sourceRowCount,
        filteredRowCount: analysis.filteredRowCount,
        groupCount: analysis.rows.length,
      },
      rows: analysis.rows,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo analizar el Excel.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
