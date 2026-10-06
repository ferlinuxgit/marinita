import ExcelJS from "exceljs";

import { UserFacingError } from "@/core/http/errors";
import { DATA_LIMITS, type DataBlock } from "@/modules/tareas/lib/data-blocks";
import {
  INDEX_SHEET,
  INSTRUCTIONS_SHEET,
  TABLE_MARKER,
  TEXT_MARKER,
  UPDATED_PREFIX,
} from "@/modules/tareas/lib/data-workbook";

export type ImportedEntry = {
  sheet: string;
  title: string;
  description: string;
  blocks: DataBlock[];
};

export type ImportResult = {
  entries: ImportedEntry[];
  /** Sheets that are not data (instructions, index, empty sheets). */
  ignored: string[];
  warnings: string[];
};

const MAX_SHEETS = 200;
const TITLE_LENGTH = 200;
const DESCRIPTION_LENGTH = 5000;

function normalize(text: string) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
}

const SKIPPED_SHEETS = new Set([normalize(INDEX_SHEET), normalize(INSTRUCTIONS_SHEET)]);

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(date);
}

function cellText(cell: ExcelJS.Cell): string {
  // Only the top-left cell of a merged range holds the value.
  if (cell.isMerged && cell.master.address !== cell.address) {
    return "";
  }

  const value = cell.value;

  if (value === null || value === undefined) {
    return "";
  }

  if (value instanceof Date) {
    return formatDate(value);
  }

  if (typeof value === "object") {
    if ("richText" in value) {
      return value.richText.map((part) => part.text).join("");
    }

    if ("text" in value && typeof value.text === "string") {
      return value.text;
    }

    if ("result" in value) {
      const result = value.result;
      return result instanceof Date ? formatDate(result) : result === undefined || result === null ? "" : String(result);
    }

    if ("error" in value) {
      return "";
    }
  }

  return String(value);
}

function readRows(sheet: ExcelJS.Worksheet) {
  const rows: string[][] = [];

  for (let rowNumber = 1; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const cells: string[] = [];

    for (let column = 1; column <= Math.min(sheet.columnCount, 50); column += 1) {
      cells.push(cellText(row.getCell(column)).replace(/\r\n?/g, "\n"));
    }

    while (cells.length && !cells[cells.length - 1].trim()) {
      cells.pop();
    }

    rows.push(cells);
  }

  while (rows.length && rows[rows.length - 1].length === 0) {
    rows.pop();
  }

  return rows;
}

const filled = (row: string[]) => row.filter((cell) => cell.trim()).length;
const onlyFirst = (row: string[]) => row.length >= 1 && row.slice(1).every((cell) => !cell.trim());

function markerOf(row: string[]): DataBlock["type"] | null {
  if (!onlyFirst(row)) {
    return null;
  }

  const value = normalize(row[0] ?? "");
  return value === normalize(TEXT_MARKER) ? "text" : value === normalize(TABLE_MARKER) ? "table" : null;
}

function toBlock(type: DataBlock["type"], rows: string[][], newId: () => string, warnings: string[], sheet: string): DataBlock {
  if (type === "text") {
    const text = rows.map((row) => row.filter((cell) => cell.trim()).join(" ")).join("\n");
    return { id: newId(), type: "text", text: text.slice(0, DATA_LIMITS.text) };
  }

  const width = Math.min(DATA_LIMITS.columns, Math.max(1, ...rows.map((row) => row.length)));
  const pad = (row: string[]) => Array.from({ length: width }, (_, index) => (row[index] ?? "").slice(0, DATA_LIMITS.cell));
  const [header, ...body] = rows;
  const dataRows = body.filter((row) => filled(row) > 0).map(pad);

  if (dataRows.length > DATA_LIMITS.rows) {
    warnings.push(`«${sheet}»: solo se importan las primeras ${DATA_LIMITS.rows} filas de una tabla.`);
  }

  return {
    id: newId(),
    type: "table",
    columns: pad(header).map((column) => column.slice(0, DATA_LIMITS.header)),
    rows: dataRows.slice(0, DATA_LIMITS.rows),
  };
}

/** Reads one sheet: title (A1), description (A2) and blocks (see the Instrucciones sheet). */
export function parseSheetRows(sheet: string, rows: string[][], newId: () => string, warnings: string[]): ImportedEntry | null {
  if (rows.every((row) => filled(row) === 0)) {
    return null;
  }

  let index = 0;
  let title = sheet;
  let description = "";

  // A1 is the title unless the first row already looks like a table header or a marker.
  if (rows[0] && onlyFirst(rows[0]) && filled(rows[0]) === 1 && !markerOf(rows[0])) {
    title = rows[0][0].trim();
    index = 1;

    const second = rows[1];

    if (second && onlyFirst(second) && !markerOf(second) && !(second[0] ?? "").startsWith(UPDATED_PREFIX)) {
      description = (second[0] ?? "").trim();
      index = 2;
    } else if (second && filled(second) === 0) {
      index = 2;
    }
  }

  const blocks: DataBlock[] = [];
  let current: { type: DataBlock["type"] | null; rows: string[][] } = { type: null, rows: [] };

  const close = () => {
    if (current.rows.length) {
      const type = current.type ?? (filled(current.rows[0]) >= 2 ? "table" : "text");
      blocks.push(toBlock(type, current.rows, newId, warnings, sheet));
    }

    current = { type: null, rows: [] };
  };

  for (const row of rows.slice(index)) {
    const marker = markerOf(row);

    if (marker) {
      close();
      current = { type: marker, rows: [] };
    } else if (filled(row) === 0) {
      if (current.rows.length) {
        close();
      }
    } else if (onlyFirst(row) && row[0].startsWith(UPDATED_PREFIX) && !current.rows.length) {
      continue;
    } else {
      current.rows.push(row);
    }
  }

  close();

  if (blocks.length > DATA_LIMITS.blocks) {
    warnings.push(`«${sheet}»: solo se importan los primeros ${DATA_LIMITS.blocks} bloques.`);
  }

  return {
    sheet,
    title: (title || sheet).slice(0, TITLE_LENGTH),
    description: description.slice(0, DESCRIPTION_LENGTH),
    blocks: blocks.slice(0, DATA_LIMITS.blocks),
  };
}

export async function parseDataWorkbook(buffer: Buffer, newId: () => string): Promise<ImportResult> {
  const workbook = new ExcelJS.Workbook();

  try {
    await workbook.xlsx.load(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer);
  } catch {
    throw new UserFacingError("El archivo no es un Excel .xlsx válido.");
  }

  const result: ImportResult = { entries: [], ignored: [], warnings: [] };

  for (const sheet of workbook.worksheets.slice(0, MAX_SHEETS)) {
    if (SKIPPED_SHEETS.has(normalize(sheet.name))) {
      result.ignored.push(sheet.name);
      continue;
    }

    const entry = parseSheetRows(sheet.name, readRows(sheet), newId, result.warnings);

    if (entry) {
      result.entries.push(entry);
    } else {
      result.ignored.push(sheet.name);
    }
  }

  if (workbook.worksheets.length > MAX_SHEETS) {
    result.warnings.push(`Solo se leen las primeras ${MAX_SHEETS} hojas.`);
  }

  return result;
}
