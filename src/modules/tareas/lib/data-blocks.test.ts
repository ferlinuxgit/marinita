import { describe, expect, it } from "vitest";

import {
  addTableColumn,
  addTableRow,
  dataBlocksSchema,
  newTableBlock,
  removeTableColumn,
  removeTableRow,
  searchableText,
  setTableCell,
  setTableHeader,
} from "@/modules/tareas/lib/data-blocks";

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
