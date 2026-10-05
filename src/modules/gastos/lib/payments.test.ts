import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import { UserFacingError } from "@/core/http/errors";
import { analyzePaymentsWorkbook, REQUIRED_COLUMNS } from "@/modules/gastos/lib/payments";

type Row = Partial<Record<(typeof REQUIRED_COLUMNS)[number], unknown>>;

async function makeWorkbook(rows: Row[], options: { sheetName?: string; headers?: string[] } = {}) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(options.sheetName ?? "Payments");
  const headers = options.headers ?? ["Extra", ...REQUIRED_COLUMNS];
  sheet.addRow(headers);

  for (const row of rows) {
    sheet.addRow(headers.map((header) => (row as Record<string, unknown>)[header] ?? null));
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

const base = {
  "Account Code": "6290007",
  "Teams External ID": "T1",
  "Expense Owner ID": "E2",
  "Expense Owner": "Ana",
  "Document Type": "Receipt",
};

describe("analyzePaymentsWorkbook", () => {
  it("groups by account, team and owner, excluding invoices", async () => {
    const buffer = await makeWorkbook([
      { ...base, "Total Expense (EUR)": 10.1 },
      { ...base, "Total Expense (EUR)": "5,20" },
      { ...base, "Total Expense (EUR)": 100, "Document Type": "Invoice" },
      { ...base, "Total Expense (EUR)": 1, "Document Type": " INVOICE " },
      { ...base, "Expense Owner ID": "E10", "Expense Owner": "Luis", "Total Expense (EUR)": 3 },
      { ...base, "Expense Owner ID": "E1", "Account Code": "6000000", "Total Expense (EUR)": 0.1 },
      { ...base, "Expense Owner ID": "E1", "Account Code": "6000000", "Total Expense (EUR)": 0.2 },
    ]);

    const analysis = await analyzePaymentsWorkbook(buffer);

    expect(analysis.sourceRowCount).toBe(7);
    expect(analysis.filteredRowCount).toBe(5);
    // Sorted by Expense Owner ID with numeric collation: E1, E2, E10.
    expect(analysis.rows).toEqual([
      {
        accountCode: "6000000",
        teamsExternalId: "T1",
        expenseOwnerId: "E1",
        expenseOwner: "Ana",
        totalAgrupadoEur: 0.3,
      },
      {
        accountCode: "6290007",
        teamsExternalId: "T1",
        expenseOwnerId: "E2",
        expenseOwner: "Ana",
        totalAgrupadoEur: 15.3,
      },
      {
        accountCode: "6290007",
        teamsExternalId: "T1",
        expenseOwnerId: "E10",
        expenseOwner: "Luis",
        totalAgrupadoEur: 3,
      },
    ]);
  });

  it("reads formula results", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Payments");
    sheet.addRow([...REQUIRED_COLUMNS]);
    sheet.addRow(["600", "T", "E", "Ana", { formula: "2+3", result: 5 }, "Receipt"]);

    const analysis = await analyzePaymentsWorkbook(Buffer.from(await workbook.xlsx.writeBuffer()));

    expect(analysis.rows[0].totalAgrupadoEur).toBe(5);
  });

  it("rejects a workbook without the Payments sheet", async () => {
    const buffer = await makeWorkbook([], { sheetName: "Otra" });
    await expect(analyzePaymentsWorkbook(buffer)).rejects.toThrow("hoja llamada 'Payments'");
  });

  it("lists the missing columns", async () => {
    const buffer = await makeWorkbook([], { headers: ["Account Code", "Expense Owner"] });
    await expect(analyzePaymentsWorkbook(buffer)).rejects.toThrow(
      "Faltan columnas requeridas: Teams External ID, Expense Owner ID, Total Expense (EUR), Document Type.",
    );
  });

  it("fails with the row number when an amount cannot be read", async () => {
    const buffer = await makeWorkbook([
      { ...base, "Total Expense (EUR)": 1 },
      { ...base, "Total Expense (EUR)": "doce" },
    ]);

    const error = await analyzePaymentsWorkbook(buffer).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(UserFacingError);
    expect((error as Error).message).toContain("fila 3");
  });

  it("rejects files that are not xlsx", async () => {
    await expect(analyzePaymentsWorkbook(Buffer.from("no soy un excel"))).rejects.toBeInstanceOf(
      UserFacingError,
    );
  });
});
