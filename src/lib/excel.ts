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
    { header: "Total Agrupado (EUR)", key: "totalAgrupadoEur", width: 22 },
  ];

  worksheet.getRow(1).font = { bold: true };

  for (const row of rows) {
    worksheet.addRow(row);
  }

  worksheet.getColumn("totalAgrupadoEur").numFmt = '#,##0.00 "EUR"';

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
