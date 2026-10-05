import { z } from "zod";

/** Content of a "Datos" sheet: free text or a table with user-defined columns. */
export type TextBlock = { id: string; type: "text"; text: string };
export type TableBlock = { id: string; type: "table"; columns: string[]; rows: string[][] };
export type DataBlock = TextBlock | TableBlock;

const LIMITS = { blocks: 100, text: 20000, columns: 20, rows: 500, cell: 2000, header: 200 };

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

export function newTableBlock(id: string): TableBlock {
  return { id, type: "table", columns: ["", ""], rows: [["", ""]] };
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
