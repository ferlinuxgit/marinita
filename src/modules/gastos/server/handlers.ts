import "server-only";

import { NextResponse } from "next/server";

import { withUser } from "@/core/http/handler";
import { xlsxResponse } from "@/core/http/responses";
import { readUploadedFile } from "@/core/http/upload";
import { gastosConfig } from "@/modules/gastos/config";
import { analyzePaymentsWorkbook } from "@/modules/gastos/lib/payments";
import { buildAccountingWorkbook, buildSummaryWorkbook } from "@/modules/gastos/lib/workbooks";
import {
  createReport,
  deleteOwnedReport,
  getOwnedReport,
  listReports,
} from "@/modules/gastos/server/repository";

type ReportParams = { reportId: string };

export const listReportsHandler = withUser(async ({ user }) => {
  return NextResponse.json({ reports: await listReports(user.id) });
});

export const createReportHandler = withUser(async ({ request, user }) => {
  const file = await readUploadedFile(request, {
    extensions: [".xlsx"],
    maxBytes: gastosConfig.upload.maxBytes,
    label: "un archivo .xlsx",
  });
  const analysis = await analyzePaymentsWorkbook(file.buffer);
  const report = await createReport(user.id, file.name, analysis);

  return NextResponse.json({ report, rows: analysis.rows });
});

export const getReportHandler = withUser<ReportParams>(async ({ user, params }) => {
  return NextResponse.json(await getOwnedReport(user.id, params.reportId));
});

export const deleteReportHandler = withUser<ReportParams>(async ({ user, params }) => {
  await deleteOwnedReport(user.id, params.reportId);
  return NextResponse.json({ ok: true });
});

export const summaryExportHandler = withUser<ReportParams>(async ({ user, params }) => {
  const { rows } = await getOwnedReport(user.id, params.reportId);
  const workbook = await buildSummaryWorkbook(rows);
  return xlsxResponse(workbook, `resumen_gastos_${params.reportId}.xlsx`);
});

export const accountingExportHandler = withUser<ReportParams>(async ({ user, params }) => {
  const { report, rows } = await getOwnedReport(user.id, params.reportId);
  const workbook = await buildAccountingWorkbook(report, rows);
  return xlsxResponse(workbook, `asientos_${params.reportId}.xlsx`);
});
