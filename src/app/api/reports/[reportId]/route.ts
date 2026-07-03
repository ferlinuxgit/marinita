import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { reports } from "@/db/schema";
import type { SummaryRow } from "@/lib/excel";
import { requireUser } from "@/lib/session";

type RouteContext = {
  params: Promise<{
    reportId: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const user = await requireUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const { reportId } = await context.params;
  const report = await db.query.reports.findFirst({
    where: eq(reports.id, reportId),
    with: {
      rows: true,
    },
  });

  if (!report || report.userId !== user.id) {
    return NextResponse.json({ error: "Informe no encontrado." }, { status: 404 });
  }

  const rows: SummaryRow[] = report.rows
    .map((row) => ({
      accountCode: row.accountCode,
      teamsExternalId: row.teamsExternalId,
      expenseOwnerId: row.expenseOwnerId,
      expenseOwner: row.expenseOwner,
      totalAgrupadoEur: Number(row.totalAgrupadoEur),
    }))
    .sort((a, b) =>
      a.expenseOwnerId.localeCompare(b.expenseOwnerId, "es", {
        numeric: true,
        sensitivity: "base",
      }),
    );

  return NextResponse.json({
    report: {
      id: report.id,
      fileName: report.fileName,
      sourceRowCount: report.sourceRowCount,
      filteredRowCount: report.filteredRowCount,
      groupCount: report.groupCount,
      createdAt: report.createdAt,
    },
    rows,
  });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const user = await requireUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const { reportId } = await context.params;
  const report = await db.query.reports.findFirst({
    where: eq(reports.id, reportId),
  });

  if (!report || report.userId !== user.id) {
    return NextResponse.json({ error: "Informe no encontrado." }, { status: 404 });
  }

  await db.delete(reports).where(eq(reports.id, reportId));

  return NextResponse.json({ ok: true });
}
