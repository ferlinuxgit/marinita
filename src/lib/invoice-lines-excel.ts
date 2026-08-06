import ExcelJS from "exceljs";
import JSZip from "jszip";

import { INVOICE_LINE_HEADERS, type InvoicePdfAnalysis } from "./invoice-pdf";

const COLUMN_WIDTHS = [
  6.57, 5.05, 27.3, 25.2, 10.59, 26.87, 25.09, 22.51, 20.88, 14.43, 14.34, 15.58,
  16.52, 25.82, 14.38, 28.73, 15.65, 21.42, 23.48, 26.01, 23.38, 20.55, 15.77,
  20.17,
] as const;

const NUMBER_FORMATS: Record<number, string> = {
  5: "#,##0.#####",
  6: "#,##0.00######",
  8: "#,##0.00",
  9: "#,##0.00###",
  14: "#,##0.00",
  15: "#,##0.00",
  16: "#,##0.00",
  17: "#,##0.#####",
  19: "#,##0.00",
  20: "#,##0.00",
  21: "#,##0.00",
  22: "#,##0.00",
  23: "#,##0.00",
  24: "#,##0.00",
};

export async function buildInvoiceLinesWorkbook(analysis: InvoicePdfAnalysis) {
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
    rows: analysis.lines.map((line) => line.values),
  });

  worksheet.getRow(1).font = { bold: true, name: "Calibri", size: 11 };
  worksheet.getRow(1).numFmt = "@";

  for (let rowNumber = 2; rowNumber <= analysis.lines.length + 1; rowNumber += 1) {
    for (const [columnNumberText, numberFormat] of Object.entries(NUMBER_FORMATS)) {
      worksheet.getCell(rowNumber, Number(columnNumberText)).numFmt = numberFormat;
    }

    for (const columnNumber of [1, 2, 3, 4, 7, 10, 11, 12, 13, 18]) {
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
