import ExcelJS from "exceljs";

import { gastosConfig } from "@/modules/gastos/config";
import type { SummaryRow } from "@/modules/gastos/lib/types";

type AccountingReportMetadata = {
  fileName: string;
  createdAt: Date | string;
};

const ACCOUNTING_COLUMNS = [
  "Fecha registro",
  "Tipo documento",
  "Nº documento",
  "Nº documento externo",
  "Nº efecto",
  "Tipo mov.",
  "Nº cuenta",
  "Descripción",
  "Importe debe",
  "Importe haber",
  "Tipo contrapartida",
  "Cta. contrapartida",
  "Cecos Código",
  "Natur Código",
  "Interco Código",
  "Epigrafe Código",
] as const;

const MONTH_INDEX: Record<string, number> = {
  jan: 0,
  ene: 0,
  january: 0,
  enero: 0,
  feb: 1,
  february: 1,
  febrero: 1,
  mar: 2,
  march: 2,
  marzo: 2,
  apr: 3,
  abr: 3,
  april: 3,
  abril: 3,
  may: 4,
  mayo: 4,
  jun: 5,
  june: 5,
  junio: 5,
  jul: 6,
  july: 6,
  julio: 6,
  aug: 7,
  ago: 7,
  august: 7,
  agosto: 7,
  sep: 8,
  sept: 8,
  september: 8,
  septiembre: 8,
  oct: 9,
  october: 9,
  octubre: 9,
  nov: 10,
  november: 10,
  noviembre: 10,
  dec: 11,
  dic: 11,
  december: 11,
  diciembre: 11,
};

function formatSpanishDate(date: Date) {
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/**
 * Accounting date: the end of the period in the file name (e.g. "1 Jul 2026 - 31 Jul 2026"), or the
 * last day of the month the report was created in.
 */
export function getAccountingDate(report: AccountingReportMetadata) {
  const periodMatch = report.fileName.match(
    /(\d{1,2})\s+([A-Za-zÁÉÍÓÚáéíóúñÑ]+)\s+(\d{4})\s*-\s*(\d{1,2})\s+([A-Za-zÁÉÍÓÚáéíóúñÑ]+)\s+(\d{4})/,
  );

  if (periodMatch) {
    const day = Number(periodMatch[4]);
    const month = MONTH_INDEX[periodMatch[5].toLowerCase()];
    const year = Number(periodMatch[6]);

    if (Number.isInteger(day) && month !== undefined && Number.isInteger(year)) {
      return new Date(Date.UTC(year, month, day));
    }
  }

  const createdAt = new Date(report.createdAt);
  return new Date(Date.UTC(createdAt.getUTCFullYear(), createdAt.getUTCMonth() + 1, 0));
}

export async function buildSummaryWorkbook(rows: SummaryRow[]) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Resumen");

  worksheet.columns = [
    { header: "Account Code", key: "accountCode", width: 18 },
    { header: "Teams External ID", key: "teamsExternalId", width: 22 },
    { header: "Expense Owner ID", key: "expenseOwnerId", width: 20 },
    { header: "Expense Owner", key: "expenseOwner", width: 26 },
    { header: "Total Agrupado", key: "totalAgrupadoEur", width: 18 },
  ];

  worksheet.getRow(1).font = { bold: true };

  for (const row of rows) {
    worksheet.addRow(row);
  }

  worksheet.getColumn("totalAgrupadoEur").numFmt = "#,##0.00";

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export async function buildAccountingWorkbook(report: AccountingReportMetadata, rows: SummaryRow[]) {
  const config = gastosConfig.accounting;
  const accountingDate = getAccountingDate(report);
  const formattedDate = formatSpanishDate(accountingDate);
  const documentNumber = `${config.documentNumberPrefix}${String(accountingDate.getUTCMonth() + 1).padStart(2, "0")}`;
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Asientos");

  worksheet.columns = ACCOUNTING_COLUMNS.map((header) => ({
    header,
    key: header,
    width: Math.max(header.length + 2, 16),
  }));
  worksheet.getRow(1).font = { bold: true };

  for (const row of rows) {
    worksheet.addRow({
      "Fecha registro": formattedDate,
      "Tipo documento": "",
      "Nº documento": documentNumber,
      "Nº documento externo": "",
      "Nº efecto": "",
      "Tipo mov.": config.movementType,
      "Nº cuenta": row.accountCode,
      "Descripción": row.expenseOwner,
      "Importe debe": row.totalAgrupadoEur,
      "Importe haber": 0,
      "Tipo contrapartida": config.counterpartType,
      "Cta. contrapartida": config.counterpartAccount,
      "Cecos Código": row.teamsExternalId,
      "Natur Código": row.expenseOwnerId,
      "Interco Código": "",
      "Epigrafe Código": config.epigraphByAccountCode[row.accountCode] ?? "",
    });
  }

  worksheet.getColumn("Importe debe").numFmt = "#,##0.00";
  worksheet.getColumn("Importe haber").numFmt = "#,##0.00";

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
