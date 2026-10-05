import "server-only";

import { randomUUID } from "node:crypto";

import { and, desc, eq } from "drizzle-orm";

import { db } from "@/core/db";
import { NotFoundError } from "@/core/http/errors";
import { gastosConfig } from "@/modules/gastos/config";
import { reportRows, reports } from "@/modules/gastos/db/schema";
import { compareSummaryRows, type ExcelAnalysis, type SummaryRow } from "@/modules/gastos/lib/types";

const REPORT_NOT_FOUND = "Informe no encontrado.";

export async function listReports(userId: string) {
  return db
    .select({
      id: reports.id,
      fileName: reports.fileName,
      sourceRowCount: reports.sourceRowCount,
      filteredRowCount: reports.filteredRowCount,
      groupCount: reports.groupCount,
      createdAt: reports.createdAt,
    })
    .from(reports)
    .where(eq(reports.userId, userId))
    .orderBy(desc(reports.createdAt))
    .limit(gastosConfig.history.listLimit);
}

export async function createReport(userId: string, fileName: string, analysis: ExcelAnalysis) {
  const reportId = randomUUID();

  await db.transaction(async (tx) => {
    await tx.insert(reports).values({
      id: reportId,
      userId,
      fileName,
      sourceRowCount: analysis.sourceRowCount,
      filteredRowCount: analysis.filteredRowCount,
      groupCount: analysis.rows.length,
    });

    if (analysis.rows.length > 0) {
      await tx.insert(reportRows).values(
        analysis.rows.map((row) => ({
          id: randomUUID(),
          reportId,
          ...row,
          totalAgrupadoEur: row.totalAgrupadoEur.toFixed(2),
        })),
      );
    }
  });

  return {
    id: reportId,
    fileName,
    sourceRowCount: analysis.sourceRowCount,
    filteredRowCount: analysis.filteredRowCount,
    groupCount: analysis.rows.length,
  };
}

/** Loads a report owned by `userId` with its rows sorted, or throws `NotFoundError`. */
export async function getOwnedReport(userId: string, reportId: string) {
  const report = await db.query.reports.findFirst({
    where: and(eq(reports.id, reportId), eq(reports.userId, userId)),
    with: { rows: true },
  });

  if (!report) {
    throw new NotFoundError(REPORT_NOT_FOUND);
  }

  const rows: SummaryRow[] = report.rows
    .map((row) => ({
      accountCode: row.accountCode,
      teamsExternalId: row.teamsExternalId,
      expenseOwnerId: row.expenseOwnerId,
      expenseOwner: row.expenseOwner,
      totalAgrupadoEur: Number(row.totalAgrupadoEur),
    }))
    .sort(compareSummaryRows);

  return {
    report: {
      id: report.id,
      fileName: report.fileName,
      sourceRowCount: report.sourceRowCount,
      filteredRowCount: report.filteredRowCount,
      groupCount: report.groupCount,
      createdAt: report.createdAt,
    },
    rows,
  };
}

export async function deleteOwnedReport(userId: string, reportId: string) {
  const deleted = await db
    .delete(reports)
    .where(and(eq(reports.id, reportId), eq(reports.userId, userId)))
    .returning({ id: reports.id });

  if (deleted.length === 0) {
    throw new NotFoundError(REPORT_NOT_FOUND);
  }
}
