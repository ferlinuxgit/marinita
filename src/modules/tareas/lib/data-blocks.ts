import { z } from "zod";

/** Content of a "Datos" sheet: free text or a table with user-defined columns. */
export type TextBlock = { id: string; type: "text"; text: string };
export type TableBlock = { id: string; type: "table"; columns: string[]; rows: string[][] };
export type DataBlock = TextBlock | TableBlock;

export const DATA_LIMITS = { blocks: 100, text: 20000, columns: 20, rows: 500, cell: 2000, header: 200 };
const LIMITS = DATA_LIMITS;

const blockId = z.string().min(1).max(64);

export const dataBlockSchema = z.discriminatedUnion("type", [
  z.object({ id: blockId, type: z.literal("text"), text: z.string().max(LIMITS.text) }),
  z
    .object({
      id: blockId,
      type: z.literal("table"),
      columns: z.array(z.string().max(LIMITS.header)).min(1).max(LIMITS.columns),
      rows: z.array(z.array(z.string().max(LIMITS.cell))).max(LIMITS.rows),
    })
    .refine((table) => table.rows.every((row) => row.length === table.columns.length), {
      message: "Cada fila debe tener tantas celdas como columnas.",
    }),
]);

export const dataBlocksSchema = z.array(dataBlockSchema).max(LIMITS.blocks);

export function newTextBlock(id: string): TextBlock {
  return { id, type: "text", text: "" };
}

export function newTableBlock(id: string, columns: string[] = ["", ""]): TableBlock {
  const headers = columns.length ? columns.slice(0, LIMITS.columns) : [""];
  return { id, type: "table", columns: headers, rows: [headers.map(() => "")] };
}

/** "Tarjeta, Titular; Límite" → ["Tarjeta", "Titular", "Límite"]. */
export function parseColumnList(text: string) {
  return text
    .split(/[,;\n\t]/)
    .map((column) => column.trim())
    .filter(Boolean)
    .slice(0, LIMITS.columns);
}

/**
 * Parses cells copied from Excel or Google Sheets (tab-separated rows, quoted cells may contain
 * line breaks). Returns null when the text is a single value, so a normal paste happens.
 */
export function parseClipboardGrid(text: string): string[][] | null {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const source = text.replace(/\r\n?/g, "\n").replace(/\n$/, "");

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];

    if (quoted) {
      if (char === '"' && source[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"' && cell === "") {
      quoted = true;
    } else if (char === "\t") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell);
  rows.push(row);

  return rows.length === 1 && rows[0].length === 1 ? null : rows;
}

/**
 * Pastes a grid into a table starting at (`row`, `column`); `row = -1` starts at the header row.
 * Adds the rows and columns needed (within the limits).
 */
export function pasteIntoTable(table: TableBlock, row: number, column: number, grid: string[][]): TableBlock {
  const width = Math.min(LIMITS.columns, Math.max(table.columns.length, column + Math.max(...grid.map((line) => line.length))));
  const headerLines = row === -1 ? 1 : 0;
  const bodyStart = Math.max(row, 0);
  const height = Math.min(LIMITS.rows, Math.max(table.rows.length, bodyStart + grid.length - headerLines));
  const pad = (cells: string[]) => [...cells, ...Array(width - cells.length).fill("")].slice(0, width);

  const columns = pad(table.columns);
  const rows = Array.from({ length: height }, (_, index) => pad(table.rows[index] ?? []));

  grid.forEach((line, lineIndex) => {
    const target = row === -1 ? lineIndex - 1 : row + lineIndex;

    line.forEach((value, offset) => {
      const targetColumn = column + offset;

      if (targetColumn >= width) {
        return;
      }

      if (target === -1) {
        columns[targetColumn] = value.slice(0, LIMITS.header);
      } else if (target < height) {
        rows[target][targetColumn] = value.slice(0, LIMITS.cell);
      }
    });
  });

  return { ...table, columns, rows };
}

/** Short text describing a sheet's content for the list. */
export function contentSummary(blocks: DataBlock[]) {
  const tables = blocks.filter((block): block is TableBlock => block.type === "table");
  const texts = blocks.filter((block): block is TextBlock => block.type === "text" && block.text.trim() !== "");
  const parts: string[] = [];

  if (tables.length) {
    const rows = tables.reduce((total, table) => total + table.rows.filter((cells) => cells.some((cell) => cell.trim())).length, 0);
    parts.push(`${tables.length === 1 ? "Tabla" : `${tables.length} tablas`} · ${rows === 1 ? "1 fila" : `${rows} filas`}`);
  }

  if (texts.length) {
    parts.push(texts.length === 1 ? "Texto" : `${texts.length} textos`);
  }

  return parts.join(" · ") || "Vacío";
}

/** First lines of text, or the first table cells, to preview a sheet. */
export function contentPreview(blocks: DataBlock[], maxLength = 140) {
  for (const block of blocks) {
    const text =
      block.type === "text"
        ? block.text
        : block.rows
            .filter((cells) => cells.some((cell) => cell.trim()))
            .slice(0, 3)
            .map((cells) => cells.filter(Boolean).join(" · "))
            .join(" — ");
    const clean = text.replace(/\s+/g, " ").trim();

    if (clean) {
      return clean.length > maxLength ? `${clean.slice(0, maxLength - 1)}…` : clean;
    }
  }

  return "";
}

export function addTableColumn(table: TableBlock): TableBlock {
  return { ...table, columns: [...table.columns, ""], rows: table.rows.map((row) => [...row, ""]) };
}

export function removeTableColumn(table: TableBlock, index: number): TableBlock {
  if (table.columns.length <= 1) {
    return table;
  }

  return {
    ...table,
    columns: table.columns.filter((_, column) => column !== index),
    rows: table.rows.map((row) => row.filter((_, column) => column !== index)),
  };
}

export function addTableRow(table: TableBlock): TableBlock {
  return { ...table, rows: [...table.rows, table.columns.map(() => "")] };
}

export function removeTableRow(table: TableBlock, index: number): TableBlock {
  return { ...table, rows: table.rows.filter((_, row) => row !== index) };
}

export function setTableCell(table: TableBlock, row: number, column: number, value: string): TableBlock {
  return {
    ...table,
    rows: table.rows.map((cells, rowIndex) =>
      rowIndex === row ? cells.map((cell, columnIndex) => (columnIndex === column ? value : cell)) : cells,
    ),
  };
}

export function setTableHeader(table: TableBlock, column: number, value: string): TableBlock {
  return { ...table, columns: table.columns.map((header, index) => (index === column ? value : header)) };
}

/** Text used to search a sheet: title, description and every block. */
export function searchableText(entry: { title: string; description: string; blocks: DataBlock[] }) {
  const content = entry.blocks.map((block) =>
    block.type === "text" ? block.text : [...block.columns, ...block.rows.flat()].join(" "),
  );
  return [entry.title, entry.description, ...content].join(" ").toLocaleLowerCase("es");
}
