import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import {
  addTableColumn,
  addTableRow,
  contentPreview,
  contentSummary,
  dataBlocksSchema,
  newTableBlock,
  parseClipboardGrid,
  parseColumnList,
  pasteIntoTable,
  removeTableColumn,
  removeTableRow,
  searchableText,
  setTableCell,
  setTableHeader,
} from "@/modules/tareas/lib/data-blocks";
import { buildDataWorkbook, sheetName } from "@/modules/tareas/lib/data-workbook";

describe("table blocks", () => {
  it("keeps every row as wide as the columns", () => {
    let table = setTableHeader(setTableHeader(newTableBlock("t"), 0, "Tarjeta"), 1, "Titular");
    table = setTableCell(table, 0, 0, "BBVA ****1234");
    table = setTableCell(table, 0, 1, "Ana");
    table = addTableRow(table);
    table = addTableColumn(table);

    expect(table.columns).toEqual(["Tarjeta", "Titular", ""]);
    expect(table.rows).toEqual([
      ["BBVA ****1234", "Ana", ""],
      ["", "", ""],
    ]);

    table = removeTableColumn(removeTableRow(table, 1), 2);
    expect(table).toMatchObject({ columns: ["Tarjeta", "Titular"], rows: [["BBVA ****1234", "Ana"]] });
    expect(removeTableColumn(removeTableColumn(table, 1), 0).columns).toEqual(["Tarjeta"]);
  });

  it("validates blocks", () => {
    expect(dataBlocksSchema.safeParse([{ id: "a", type: "text", text: "Dividendo: 526 / 572" }, newTableBlock("b")]).success).toBe(true);
    expect(dataBlocksSchema.safeParse([{ id: "b", type: "table", columns: ["A", "B"], rows: [["solo una"]] }]).success).toBe(false);
    expect(dataBlocksSchema.safeParse([{ id: "c", type: "image" }]).success).toBe(false);
  });

  it("searches title, description, text and table cells", () => {
    const text = searchableText({
      title: "Tarjetas BBVA",
      description: "Listado de tarjetas",
      blocks: [
        { id: "t", type: "table", columns: ["Tarjeta", "Titular"], rows: [["****1234", "Marina López"]] },
        { id: "x", type: "text", text: "Caducan en 2027" },
      ],
    });

    expect(text).toContain("marina lópez");
    expect(text).toContain("caducan en 2027");
    expect(text).toContain("tarjetas bbva");
  });
});

describe("pasting from Excel", () => {
  it("parses tab-separated rows, quoted cells and Windows line breaks", () => {
    expect(parseClipboardGrid("Tarjeta\tTitular\r\n**** 1234\tAna\r\n")).toEqual([
      ["Tarjeta", "Titular"],
      ["**** 1234", "Ana"],
    ]);
    expect(parseClipboardGrid('"Línea 1\nLínea 2"\tB\n"con ""comillas"""\tD')).toEqual([
      ["Línea 1\nLínea 2", "B"],
      ['con "comillas"', "D"],
    ]);
    expect(parseClipboardGrid("solo un valor")).toBeNull();
  });

  it("pastes into the body, growing rows and columns", () => {
    const table = newTableBlock("t", ["Tarjeta", "Titular"]);
    const pasted = pasteIntoTable(table, 0, 1, [
      ["Ana", "3.000 €"],
      ["Luis", "1.000 €"],
    ]);

    expect(pasted.columns).toEqual(["Tarjeta", "Titular", ""]);
    expect(pasted.rows).toEqual([
      ["", "Ana", "3.000 €"],
      ["", "Luis", "1.000 €"],
    ]);
  });

  it("pasting on the header row uses the first line as column names", () => {
    const pasted = pasteIntoTable(newTableBlock("t"), -1, 0, [
      ["Cuenta", "Banco"],
      ["ES12", "BBVA"],
    ]);
    expect(pasted).toMatchObject({ columns: ["Cuenta", "Banco"], rows: [["ES12", "BBVA"]] });
  });

  it("parses column lists and summarizes content", () => {
    expect(parseColumnList("Tarjeta, Titular;  Límite ,")).toEqual(["Tarjeta", "Titular", "Límite"]);
    const blocks = [
      { id: "a", type: "table" as const, columns: ["A"], rows: [["1"], [""], ["2"]] },
      { id: "b", type: "text" as const, text: "Hola\nmundo" },
    ];
    expect(contentSummary(blocks)).toBe("Tabla · 2 filas · Texto");
    expect(contentSummary([])).toBe("Vacío");
    expect(contentPreview(blocks)).toBe("1 — 2");
  });
});

describe("data workbook", () => {
  it("makes valid, unique sheet names", () => {
    const used = new Set<string>();
    expect(sheetName("Tarjetas BBVA", used)).toBe("Tarjetas BBVA");
    expect(sheetName("tarjetas bbva", used)).toBe("tarjetas bbva (2)");
    expect(sheetName("IVA: 303/390 [trimestral] y otros modelos largos", used)).toBe("IVA 303 390 trimestral y otros");
    expect(sheetName("   ", used)).toBe("Dato");
  });

  it("writes an index and one sheet per entry with text and tables", async () => {
    const buffer = await buildDataWorkbook([
      {
        title: "Tarjetas BBVA",
        description: "Listado de tarjetas",
        updatedAt: "2026-10-06T10:00:00Z",
        blocks: [
          { id: "t", type: "table", columns: ["Tarjeta", "Titular"], rows: [["**** 1234", "Ana"], ["", ""]] },
          { id: "x", type: "text", text: "Renovar en 2027" },
        ],
      },
      { title: "Dividendo", description: "", updatedAt: "2026-10-06T10:00:00Z", blocks: [{ id: "y", type: "text", text: "526 / 572" }] },
    ]);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer);

    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(["Índice", "Tarjetas BBVA", "Dividendo"]);
    const values = (name: string) => {
      const rows: unknown[][] = [];
      workbook.getWorksheet(name)!.eachRow((row) => rows.push((row.values as unknown[]).slice(1)));
      return rows;
    };
    expect(values("Índice").slice(1).map((row) => (row[0] as { text: string }).text)).toEqual(["Tarjetas BBVA", "Dividendo"]);
    const tarjetas = values("Tarjetas BBVA");
    expect(tarjetas[0]).toEqual(["Tarjetas BBVA"]);
    expect(tarjetas[1]).toEqual(["Listado de tarjetas"]);
    expect(tarjetas).toContainEqual(["Tarjeta", "Titular"]);
    expect(tarjetas).toContainEqual(["**** 1234", "Ana"]);
    expect(tarjetas.at(-1)?.[0]).toBe("Renovar en 2027");
    // Empty table rows are skipped.
    expect(tarjetas.filter((row) => row.length === 2 && row.every((cell) => cell === "")).length).toBe(0);
  });
});
