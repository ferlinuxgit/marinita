import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import { parseDataWorkbook, parseSheetRows } from "@/modules/tareas/lib/data-import";
import { buildDataTemplate, buildDataWorkbook, type ExportEntry } from "@/modules/tareas/lib/data-workbook";

let counter = 0;
const newId = () => `id${counter++}`;
const withoutIds = (blocks: unknown[]) => blocks.map((block) => ({ ...(block as object), id: undefined }));

describe("parseDataWorkbook", () => {
  it("round-trips an exported workbook", async () => {
    const entries: ExportEntry[] = [
      {
        title: "Tarjetas BBVA",
        description: "Listado de tarjetas",
        updatedAt: "2026-10-06T10:00:00Z",
        blocks: [
          { id: "a", type: "table", columns: ["Tarjeta", "Titular"], rows: [["**** 1234", "Ana"], ["**** 9876", "Luis"]] },
          { id: "b", type: "text", text: "Renovar en 2027.\nLlamar al banco." },
          { id: "c", type: "table", columns: ["Solo una columna"], rows: [["valor"]] },
        ],
      },
      { title: "Dividendo", description: "", updatedAt: "2026-10-06T10:00:00Z", blocks: [{ id: "d", type: "text", text: "526 / 572" }] },
    ];

    const result = await parseDataWorkbook(await buildDataWorkbook(entries), newId);

    expect(result.ignored).toEqual(["Índice"]);
    expect(result.warnings).toEqual([]);
    expect(result.entries.map((entry) => [entry.title, entry.description, withoutIds(entry.blocks)])).toEqual(
      entries.map((entry) => [entry.title, entry.description, withoutIds(entry.blocks)]),
    );
  });

  it("reads the example template and skips the instructions", async () => {
    const result = await parseDataWorkbook(await buildDataTemplate(), newId);

    expect(result.ignored).toEqual(["Instrucciones"]);
    expect(result.entries.map((entry) => entry.title)).toEqual(["Tarjetas BBVA", "Dividendo"]);
    expect(result.entries[0].blocks[0]).toMatchObject({ type: "table", columns: ["Tarjeta", "Titular", "Límite"] });
  });

  it("rejects files that are not Excel", async () => {
    await expect(parseDataWorkbook(Buffer.from("hola"), newId)).rejects.toThrow("no es un Excel");
  });

  it("reads numbers, dates and formulas of a hand-made sheet", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Cuentas");
    sheet.addRow(["Banco", "IBAN", "Saldo", "Fecha"]);
    sheet.addRow(["BBVA", "ES12 0182", 1500.5, new Date(Date.UTC(2026, 9, 6))]);
    sheet.addRow(["Total", "", { formula: "C2", result: 1500.5 }, ""]);
    workbook.addWorksheet("Vacía");

    const result = await parseDataWorkbook(Buffer.from(await workbook.xlsx.writeBuffer()), newId);

    expect(result.ignored).toEqual(["Vacía"]);
    expect(result.entries[0]).toMatchObject({
      title: "Cuentas",
      description: "",
      blocks: [
        {
          type: "table",
          columns: ["Banco", "IBAN", "Saldo", "Fecha"],
          rows: [
            ["BBVA", "ES12 0182", "1500.5", "06/10/2026"],
            ["Total", "", "1500.5", ""],
          ],
        },
      ],
    });
  });
});

describe("parseSheetRows (sheets without markers)", () => {
  const parse = (rows: string[][]) => parseSheetRows("Hoja", rows, newId, []);

  it("title, description, then text and table guessed from the rows", () => {
    const entry = parse([
      ["Procedimiento de cierre"],
      ["Pasos a seguir"],
      [],
      ["Primero revisar bancos."],
      ["Después, amortizaciones."],
      [],
      ["Cuenta", "Descripción"],
      ["572", "Bancos"],
    ]);

    expect(entry).toMatchObject({
      title: "Procedimiento de cierre",
      description: "Pasos a seguir",
      blocks: [
        { type: "text", text: "Primero revisar bancos.\nDespués, amortizaciones." },
        { type: "table", columns: ["Cuenta", "Descripción"], rows: [["572", "Bancos"]] },
      ],
    });
  });

  it("a sheet that starts with a table uses the sheet name as title", () => {
    expect(parse([["A", "B"], ["1", "2"]])).toMatchObject({ title: "Hoja", blocks: [{ type: "table", columns: ["A", "B"] }] });
  });

  it("ignores empty sheets", () => {
    expect(parse([[], [""]])).toBeNull();
  });
});
