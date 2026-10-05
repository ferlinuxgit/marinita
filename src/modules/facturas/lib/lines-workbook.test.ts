import ExcelJS from "exceljs";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import { buildInvoiceLinesWorkbook } from "@/modules/facturas/lib/lines-workbook";
import { INVOICE_LINE_HEADERS, type InvoiceLineValue } from "@/modules/facturas/lib/types";

const line: InvoiceLineValue[] = INVOICE_LINE_HEADERS.map((_, index) => (index === 5 ? 950 : `v${index}`));

describe("buildInvoiceLinesWorkbook", () => {
  it("writes the headers and lines into a table on the Líneas sheet", async () => {
    const buffer = await buildInvoiceLinesWorkbook([line, line]);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer);
    const sheet = workbook.getWorksheet("Líneas");

    expect((sheet?.getRow(1).values as unknown[]).slice(1)).toEqual([...INVOICE_LINE_HEADERS]);
    expect((sheet?.getRow(2).values as unknown[]).slice(1)).toEqual(line);
    expect(sheet?.rowCount).toBe(3);
  });

  it("normalizes the table XML for the ERP import", async () => {
    const archive = await JSZip.loadAsync(await buildInvoiceLinesWorkbook([line]));
    const tableXml = await archive.file("xl/tables/table1.xml")!.async("string");

    expect(tableXml).toContain('totalsRowShown="0"');
    expect(tableXml).not.toContain("headerRowCount");
    expect(tableXml).toMatch(/<autoFilter ref="[^"]+"\/>/);
  });
});
