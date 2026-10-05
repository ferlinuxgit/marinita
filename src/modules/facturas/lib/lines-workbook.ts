import ExcelJS from "exceljs";
import JSZip from "jszip";

import { INVOICE_LINE_HEADERS, type InvoiceLineValue } from "@/modules/facturas/lib/types";

const COLUMN_WIDTHS = [
  6.57, 5.05, 27.3, 25.2, 10.59, 26.87, 25.09, 22.51, 14.43, 14.34, 15.58, 16.52,
  25.82, 14.38, 28.73, 15.65, 21.42, 23.48, 26.01, 23.38, 20.55, 15.77, 20.17,
] as const;

const NUMBER_FORMATS: Record<number, string> = {
  5: "#,##0.#####",
  6: "#,##0.00######",
  8: "#,##0.00",
  13: "#,##0.00",
  14: "#,##0.00",
  15: "#,##0.00",
  16: "#,##0.#####",
  18: "#,##0.00",
  19: "#,##0.00",
  20: "#,##0.00",
  21: "#,##0.00",
  22: "#,##0.00",
  23: "#,##0.00",
};

/** Builds the "Líneas" workbook (an Excel table matching the ERP import template). */
export async function buildInvoiceLinesWorkbook(lines: InvoiceLineValue[][]) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Marinita";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet("Líneas", {
    views: [{ state: "frozen", ySplit: 1, activeCell: "A2" }],
  });

  worksheet.columns = INVOICE_LINE_HEADERS.map((header, index) => ({
    header,
    key: `column_${index + 1}`,
    width: COLUMN_WIDTHS[index],
  }));

  worksheet.addTable({
    name: "Table1",
    ref: "A1",
    headerRow: true,
    totalsRow: false,
    style: {
      theme: "TableStyleMedium2",
      showFirstColumn: false,
      showLastColumn: false,
      showRowStripes: true,
      showColumnStripes: false,
    },
    columns: INVOICE_LINE_HEADERS.map((header) => ({ name: header, filterButton: true })),
    rows: lines,
  });

  worksheet.getRow(1).font = { bold: true, name: "Calibri", size: 11 };
  worksheet.getRow(1).numFmt = "@";

  for (let rowNumber = 2; rowNumber <= lines.length + 1; rowNumber += 1) {
    for (const [columnNumberText, numberFormat] of Object.entries(NUMBER_FORMATS)) {
      worksheet.getCell(rowNumber, Number(columnNumberText)).numFmt = numberFormat;
    }

    for (const columnNumber of [1, 2, 3, 4, 7, 9, 10, 11, 12, 17]) {
      worksheet.getCell(rowNumber, columnNumber).numFmt = "@";
    }
  }

  const initialBuffer = await workbook.xlsx.writeBuffer();
  const archive = await JSZip.loadAsync(initialBuffer);
  const tableFile = archive.file("xl/tables/table1.xml");

  if (tableFile) {
    const tableXml = await tableFile.async("string");
    const normalizedTableXml = tableXml
      .replace(' totalsRowShown="1"', ' totalsRowShown="0"')
      .replace(' headerRowCount="1"', "")
      .replace(/ totalsRowLabel="[^"]*"/g, "")
      .replace(/ totalsRowFunction="none"/g, "")
      .replace(/<autoFilter ref="([^"]+)">[\s\S]*?<\/autoFilter>/, '<autoFilter ref="$1"/>');

    archive.file("xl/tables/table1.xml", normalizedTableXml);
  }

  return archive.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
  });
}
