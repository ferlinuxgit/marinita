import ExcelJS from "exceljs";

import { UserFacingError } from "@/core/http/errors";
import { roundMoney } from "@/core/lib/money";
import { gastosConfig } from "@/modules/gastos/config";
import { parseAmount } from "@/modules/gastos/lib/amount";
import { compareSummaryRows, type ExcelAnalysis, type SummaryRow } from "@/modules/gastos/lib/types";

export const REQUIRED_COLUMNS = [
  "Account Code",
  "Teams External ID",
  "Expense Owner ID",
  "Expense Owner",
  "Total Expense (EUR)",
  "Document Type",
] as const;

type RequiredColumn = (typeof REQUIRED_COLUMNS)[number];

function normalizeCell(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

function cellToValue(cell: ExcelJS.Cell): unknown {
  const value = cell.value;

  if (value && typeof value === "object" && !(value instanceof Date)) {
    if ("error" in value) {
      return value.error;
    }

    if ("result" in value) {
      return value.result;
    }

    if ("richText" in value) {
      return value.richText.map((item) => item.text).join("");
    }

    if ("text" in value) {
      return value.text;
    }
  }

  return value;
}

function makeGroupKey(row: SummaryRow) {
  return [row.accountCode, row.teamsExternalId, row.expenseOwnerId, row.expenseOwner].join("\u001f");
}

async function loadWorkbook(buffer: Buffer) {
  const workbook = new ExcelJS.Workbook();
  const arrayBuffer = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  ) as ArrayBuffer;

  try {
    await workbook.xlsx.load(arrayBuffer);
  } catch {
    throw new UserFacingError("El archivo no es un Excel .xlsx válido.");
  }

  return workbook;
}

export async function analyzePaymentsWorkbook(buffer: Buffer): Promise<ExcelAnalysis> {
  const { sheetName, excludedDocumentTypes } = gastosConfig.source;
  const workbook = await loadWorkbook(buffer);
  const worksheet = workbook.getWorksheet(sheetName);

  if (!worksheet) {
    throw new UserFacingError(`El Excel debe contener una hoja llamada '${sheetName}'.`);
  }

  const headers = new Map<string, number>();

  worksheet.getRow(1).eachCell((cell, columnNumber) => {
    const header = normalizeCell(cellToValue(cell));

    if (header) {
      headers.set(header, columnNumber);
    }
  });

  const missingColumns = REQUIRED_COLUMNS.filter((column) => !headers.has(column));

  if (missingColumns.length > 0) {
    throw new UserFacingError(`Faltan columnas requeridas: ${missingColumns.join(", ")}.`);
  }

  const excluded = new Set(excludedDocumentTypes.map((type) => type.toLowerCase()));
  const groups = new Map<string, SummaryRow>();
  let sourceRowCount = 0;
  let filteredRowCount = 0;

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      return;
    }

    sourceRowCount += 1;

    const read = (column: RequiredColumn) => cellToValue(row.getCell(headers.get(column)!));

    if (excluded.has(normalizeCell(read("Document Type")).toLowerCase())) {
      return;
    }

    filteredRowCount += 1;

    const rawAmount = read("Total Expense (EUR)");
    const amount = parseAmount(rawAmount);

    if (amount === null) {
      throw new UserFacingError(
        `Importe no válido en la fila ${rowNumber} (Total Expense (EUR)): "${normalizeCell(rawAmount)}".`,
      );
    }

    const summaryRow: SummaryRow = {
      accountCode: normalizeCell(read("Account Code")),
      teamsExternalId: normalizeCell(read("Teams External ID")),
      expenseOwnerId: normalizeCell(read("Expense Owner ID")),
      expenseOwner: normalizeCell(read("Expense Owner")),
      totalAgrupadoEur: amount,
    };

    const key = makeGroupKey(summaryRow);
    const current = groups.get(key);

    if (!current) {
      groups.set(key, summaryRow);
      return;
    }

    current.totalAgrupadoEur = roundMoney(current.totalAgrupadoEur + summaryRow.totalAgrupadoEur);
  });

  const rows = Array.from(groups.values())
    .map((row) => ({ ...row, totalAgrupadoEur: roundMoney(row.totalAgrupadoEur) }))
    .sort(compareSummaryRows);

  return { sourceRowCount, filteredRowCount, rows };
}
