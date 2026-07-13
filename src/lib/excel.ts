import ExcelJS from "exceljs";
import { z } from "zod";

export const REQUIRED_COLUMNS = [
  "Account Code",
  "Teams External ID",
  "Expense Owner ID",
  "Expense Owner",
  "Total Expense (EUR)",
  "Document Type",
] as const;

export type SummaryRow = {
  accountCode: string;
  teamsExternalId: string;
  expenseOwnerId: string;
  expenseOwner: string;
  totalAgrupadoEur: number;
};

export type ExcelAnalysis = {
  sourceRowCount: number;
  filteredRowCount: number;
  rows: SummaryRow[];
};

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

const EPIGRAPH_BY_ACCOUNT_CODE: Record<string, string> = {
  "6290007": "SC00032",
};

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

const rawRowSchema = z.record(z.string(), z.unknown());

function normalizeCell(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

function parseAmount(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const text = normalizeCell(value);

  if (!text) {
    return 0;
  }

  const normalized = text
    .replace(/\s/g, "")
    .replace(/[€]/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function formatSpanishDate(date: Date) {
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function getAccountingDate(report: AccountingReportMetadata) {
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

function makeGroupKey(row: SummaryRow) {
  return [
    row.accountCode,
    row.teamsExternalId,
    row.expenseOwnerId,
    row.expenseOwner,
  ].join("\u001f");
}

function cellToValue(cell: ExcelJS.Cell) {
  const value = cell.value;

  if (value && typeof value === "object") {
    if ("result" in value) {
      return value.result;
    }

    if ("text" in value) {
      return value.text;
    }

    if ("richText" in value) {
      return value.richText.map((item) => item.text).join("");
    }
  }

  return value;
}

export async function analyzePaymentsWorkbook(buffer: Buffer): Promise<ExcelAnalysis> {
  const workbook = new ExcelJS.Workbook();
  const arrayBuffer = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  ) as ArrayBuffer;
  await workbook.xlsx.load(arrayBuffer);

  const worksheet = workbook.getWorksheet("Payments");

  if (!worksheet) {
    throw new Error("El Excel debe contener una hoja llamada 'Payments'.");
  }

  const headerRow = worksheet.getRow(1);
  const headers = new Map<string, number>();

  headerRow.eachCell((cell, columnNumber) => {
    const header = normalizeCell(cellToValue(cell));

    if (header) {
      headers.set(header, columnNumber);
    }
  });

  const missingColumns = REQUIRED_COLUMNS.filter((column) => !headers.has(column));

  if (missingColumns.length > 0) {
    throw new Error(`Faltan columnas requeridas: ${missingColumns.join(", ")}.`);
  }

  const rows: Record<string, unknown>[] = [];

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      return;
    }

    const rawRow: Record<string, unknown> = {};

    for (const column of REQUIRED_COLUMNS) {
      const columnNumber = headers.get(column);

      if (columnNumber) {
        rawRow[column] = cellToValue(row.getCell(columnNumber));
      }
    }

    rows.push(rawRowSchema.parse(rawRow));
  });

  const groups = new Map<string, SummaryRow>();
  let filteredRowCount = 0;

  for (const row of rows) {
    if (normalizeCell(row["Document Type"]).toLowerCase() === "invoice") {
      continue;
    }

    filteredRowCount += 1;

    const summaryRow: SummaryRow = {
      accountCode: normalizeCell(row["Account Code"]),
      teamsExternalId: normalizeCell(row["Teams External ID"]),
      expenseOwnerId: normalizeCell(row["Expense Owner ID"]),
      expenseOwner: normalizeCell(row["Expense Owner"]),
      totalAgrupadoEur: parseAmount(row["Total Expense (EUR)"]),
    };

    const key = makeGroupKey(summaryRow);
    const current = groups.get(key);

    if (!current) {
      groups.set(key, summaryRow);
      continue;
    }

    current.totalAgrupadoEur = roundMoney(current.totalAgrupadoEur + summaryRow.totalAgrupadoEur);
  }

  const groupedRows = Array.from(groups.values())
    .map((row) => ({
      ...row,
      totalAgrupadoEur: roundMoney(row.totalAgrupadoEur),
    }))
    .sort((a, b) =>
      a.expenseOwnerId.localeCompare(b.expenseOwnerId, "es", {
        numeric: true,
        sensitivity: "base",
      }),
    );

  return {
    sourceRowCount: rows.length,
    filteredRowCount,
    rows: groupedRows,
  };
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
  const accountingDate = getAccountingDate(report);
  const formattedDate = formatSpanishDate(accountingDate);
  const documentNumber = `PAY${String(accountingDate.getUTCMonth() + 1).padStart(2, "0")}`;
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
      "Tipo mov.": "Cuenta",
      "Nº cuenta": row.accountCode,
      "Descripción": row.expenseOwner,
      "Importe debe": row.totalAgrupadoEur,
      "Importe haber": 0,
      "Tipo contrapartida": "Banco",
      "Cta. contrapartida": "ASLH2202",
      "Cecos Código": row.teamsExternalId,
      "Natur Código": row.expenseOwnerId,
      "Interco Código": "",
      "Epigrafe Código": EPIGRAPH_BY_ACCOUNT_CODE[row.accountCode] ?? "",
    });
  }

  worksheet.getColumn("Importe debe").numFmt = "#,##0.00";
  worksheet.getColumn("Importe haber").numFmt = "#,##0.00";

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
