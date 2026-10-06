import ExcelJS from "exceljs";

import type { DataBlock } from "@/modules/tareas/lib/data-blocks";

export type ExportEntry = {
  title: string;
  description: string;
  blocks: DataBlock[];
  updatedAt: Date | string;
};

const BRAND = "FF0F6D5F";
const HEADER_FILL = "FFE8F1EE";
const BORDER = { style: "thin" as const, color: { argb: "FFD8DED7" } };
const MIN_TEXT_COLUMNS = 6;

/** Sheets that are not data entries (skipped when importing). */
export const INDEX_SHEET = "Índice";
export const INSTRUCTIONS_SHEET = "Instrucciones";
/** Marker rows written before each block, so an exported file can be imported back. */
export const TEXT_MARKER = "TEXTO";
export const TABLE_MARKER = "TABLA";
export const UPDATED_PREFIX = "Actualizado el";

/** Excel sheet names: max 31 chars, no []:*?/\ and unique (case-insensitive). */
export function sheetName(title: string, used: Set<string>) {
  const base = (title.replace(/[[\]:*?/\\]/g, " ").replace(/\s+/g, " ").trim() || "Dato").slice(0, 31).trim();
  let name = base;

  for (let index = 2; used.has(name.toLowerCase()); index += 1) {
    const suffix = ` (${index})`;
    name = `${base.slice(0, 31 - suffix.length)}${suffix}`;
  }

  used.add(name.toLowerCase());
  return name;
}

function formatDate(value: Date | string) {
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeZone: "Europe/Madrid" }).format(new Date(value));
}

function writeEntrySheet(sheet: ExcelJS.Worksheet, entry: ExportEntry) {
  const tableWidth = Math.max(0, ...entry.blocks.map((block) => (block.type === "table" ? block.columns.length : 0)));
  const width = Math.max(MIN_TEXT_COLUMNS, tableWidth);
  const columnWidths = Array.from({ length: width }, () => 14);

  const title = sheet.addRow([entry.title]);
  title.font = { bold: true, size: 16, color: { argb: BRAND } };
  title.height = 24;

  // Row 2 is always the description (maybe empty), so the layout is predictable when importing.
  const description = sheet.addRow([entry.description]);
  description.font = { italic: true, color: { argb: "FF60706A" } };

  sheet.addRow([`${UPDATED_PREFIX} ${formatDate(entry.updatedAt)}`]).font = { size: 9, color: { argb: "FF8A9690" } };

  const marker = (label: string) => {
    sheet.addRow([]);
    const row = sheet.addRow([label]);
    row.font = { bold: true, size: 8, color: { argb: "FF8A9690" } };
  };

  for (const block of entry.blocks) {
    if (block.type === "text") {
      if (!block.text.trim()) {
        continue;
      }

      marker(TEXT_MARKER);
      const row = sheet.addRow([block.text]);
      sheet.mergeCells(row.number, 1, row.number, width);
      row.getCell(1).alignment = { wrapText: true, vertical: "top" };
      // Rough height: one line per ~90 characters and per line break.
      const lines = block.text.split("\n").reduce((total, line) => total + Math.max(1, Math.ceil(line.length / 90)), 0);
      row.height = Math.min(409, Math.max(18, lines * 15));
      continue;
    }

    marker(TABLE_MARKER);
    const header = sheet.addRow(block.columns.map((column, index) => column || `Columna ${index + 1}`));
    header.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: BRAND } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
      cell.border = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };
    });

    for (const cells of block.rows) {
      if (!cells.some((cell) => cell.trim())) {
        continue;
      }

      const row = sheet.addRow(cells);

      for (let index = 1; index <= block.columns.length; index += 1) {
        const cell = row.getCell(index);
        cell.alignment = { wrapText: true, vertical: "top" };
        cell.border = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };
      }
    }

    block.columns.forEach((column, index) => {
      const longest = Math.max(column.length, ...block.rows.map((cells) => (cells[index] ?? "").length));
      columnWidths[index] = Math.max(columnWidths[index], Math.min(60, longest + 3));
    });
  }

  columnWidths.forEach((columnWidth, index) => {
    sheet.getColumn(index + 1).width = columnWidth;
  });
}

/** One sheet per entry; with several entries, an "Índice" sheet first with links to each one. */
export async function buildDataWorkbook(entries: ExportEntry[]) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Marinita";
  workbook.created = new Date();
  const used = new Set<string>();
  const index = entries.length > 1 ? workbook.addWorksheet(sheetName(INDEX_SHEET, used)) : null;
  const names = entries.map((entry) => sheetName(entry.title, used));

  if (index) {
    index.columns = [
      { header: "Dato", key: "title", width: 34 },
      { header: "Descripción", key: "description", width: 60 },
      { header: "Actualizado", key: "updated", width: 16 },
    ];
    index.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
    });
    index.views = [{ state: "frozen", ySplit: 1 }];

    entries.forEach((entry, position) => {
      const row = index.addRow({ title: entry.title, description: entry.description, updated: formatDate(entry.updatedAt) });
      row.getCell(1).value = { text: entry.title, hyperlink: `#'${names[position].replace(/'/g, "''")}'!A1` };
      row.getCell(1).font = { color: { argb: "FF2563EB" }, underline: true };
      row.getCell(2).alignment = { wrapText: true, vertical: "top" };
    });
  }

  entries.forEach((entry, position) => writeEntrySheet(workbook.addWorksheet(names[position]), entry));

  if (entries.length === 0) {
    workbook.addWorksheet("Datos").addRow(["Todavía no hay datos."]);
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

const INSTRUCTIONS = [
  "Cómo preparar un Excel para importar datos",
  "",
  "• Cada hoja del libro es un dato. Las hojas «Índice» e «Instrucciones» se ignoran.",
  "• Celda A1: título del dato (si está vacía se usa el nombre de la hoja).",
  "• Celda A2: descripción (opcional).",
  "• Debajo, el contenido. Escribe TEXTO o TABLA en la columna A para empezar cada bloque:",
  "     – TEXTO: la fila siguiente es el texto (puede tener saltos de línea dentro de la celda).",
  "     – TABLA: la fila siguiente son los nombres de las columnas y, debajo, una fila por registro.",
  "• Deja una fila vacía entre bloques.",
  "• Si no pones TEXTO o TABLA, las filas con varias celdas se leen como tabla y las demás como texto.",
  "• Al importar verás una vista previa. Si ya existe un dato con el mismo título, eliges si actualizarlo o crear otro.",
  "",
  "Consejo: un Excel exportado desde la aplicación tiene ya este formato y se puede volver a importar.",
];

/** Example file to show the import format: instructions plus two sample entries. */
export async function buildDataTemplate() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Marinita";
  const instructions = workbook.addWorksheet(INSTRUCTIONS_SHEET);
  instructions.getColumn(1).width = 110;
  INSTRUCTIONS.forEach((line, position) => {
    const row = instructions.addRow([line]);
    row.getCell(1).alignment = { wrapText: true };

    if (position === 0) {
      row.font = { bold: true, size: 14, color: { argb: BRAND } };
    }
  });

  const examples: ExportEntry[] = [
    {
      title: "Tarjetas BBVA",
      description: "Listado de las tarjetas y a quién pertenecen",
      updatedAt: new Date(),
      blocks: [
        {
          id: "t",
          type: "table",
          columns: ["Tarjeta", "Titular", "Límite"],
          rows: [
            ["**** 1234", "Marina López", "3.000 €"],
            ["**** 9876", "Fernando Ruiz", "1.500 €"],
          ],
        },
        { id: "x", type: "text", text: "Las tarjetas de débito no tienen límite.\nRenovar en 2027." },
      ],
    },
    {
      title: "Dividendo",
      description: "Cómo contabilizar el dividendo",
      updatedAt: new Date(),
      blocks: [
        {
          id: "y",
          type: "text",
          text: "1. Acuerdo de reparto: cargo a 129 y abono a 526.\n2. Pago: cargo a 526, abono a 572 y retención (19%) a 4751.",
        },
      ],
    },
  ];

  examples.forEach((entry) => writeEntrySheet(workbook.addWorksheet(entry.title), entry));
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
