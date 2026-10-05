import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import type { SummaryRow } from "@/modules/gastos/lib/types";
import {
  buildAccountingWorkbook,
  buildSummaryWorkbook,
  getAccountingDate,
} from "@/modules/gastos/lib/workbooks";

const rows: SummaryRow[] = [
  {
    accountCode: "6290007",
    teamsExternalId: "T1",
    expenseOwnerId: "E1",
    expenseOwner: "Ana",
    totalAgrupadoEur: 15.3,
  },
  {
    accountCode: "6000000",
    teamsExternalId: "T2",
    expenseOwnerId: "E2",
    expenseOwner: "Luis",
    totalAgrupadoEur: 3,
  },
];

async function readSheet(buffer: Buffer, name: string) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer);
  const sheet = workbook.getWorksheet(name);
  const values: unknown[][] = [];
  sheet?.eachRow((row) => values.push((row.values as unknown[]).slice(1)));
  return values;
}

describe("getAccountingDate", () => {
  it("uses the end of the period in the file name", () => {
    const date = getAccountingDate({
      fileName: "Payhawk 1 Jul 2026 - 31 Jul 2026.xlsx",
      createdAt: "2026-09-15T10:00:00Z",
    });
    expect(date.toISOString()).toBe("2026-07-31T00:00:00.000Z");
  });

  it("understands Spanish month names", () => {
    const date = getAccountingDate({
      fileName: "export 1 agosto 2026 - 31 agosto 2026.xlsx",
      createdAt: "2026-09-15T10:00:00Z",
    });
    expect(date.toISOString()).toBe("2026-08-31T00:00:00.000Z");
  });

  it("falls back to the last day of the creation month", () => {
    const date = getAccountingDate({ fileName: "export.xlsx", createdAt: "2026-02-10T10:00:00Z" });
    expect(date.toISOString()).toBe("2026-02-28T00:00:00.000Z");
  });
});

describe("buildSummaryWorkbook", () => {
  it("writes one row per group in a Resumen sheet", async () => {
    const values = await readSheet(await buildSummaryWorkbook(rows), "Resumen");

    expect(values).toEqual([
      ["Account Code", "Teams External ID", "Expense Owner ID", "Expense Owner", "Total Agrupado"],
      ["6290007", "T1", "E1", "Ana", 15.3],
      ["6000000", "T2", "E2", "Luis", 3],
    ]);
  });
});

describe("buildAccountingWorkbook", () => {
  it("builds the journal entries with the configured accounts", async () => {
    const buffer = await buildAccountingWorkbook(
      { fileName: "1 Jul 2026 - 31 Jul 2026.xlsx", createdAt: new Date() },
      rows,
    );
    const [header, first, second] = await readSheet(buffer, "Asientos");

    expect(header).toHaveLength(16);
    const entry = Object.fromEntries((header as string[]).map((name, index) => [name, first[index]]));

    expect(entry).toMatchObject({
      "Fecha registro": "31/07/2026",
      "Nº documento": "PAY07",
      "Tipo mov.": "Cuenta",
      "Nº cuenta": "6290007",
      "Descripción": "Ana",
      "Importe debe": 15.3,
      "Importe haber": 0,
      "Tipo contrapartida": "Banco",
      "Cta. contrapartida": "ASLH2202",
      "Cecos Código": "T1",
      "Natur Código": "E1",
      "Epigrafe Código": "SC00032",
    });
    // Accounts without a mapped epigraph get an empty value.
    expect(second[(header as string[]).indexOf("Epigrafe Código")]).toBe("");
  });
});
