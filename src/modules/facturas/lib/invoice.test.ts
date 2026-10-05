import { describe, expect, it } from "vitest";

import { UserFacingError } from "@/core/http/errors";
import { analyzeInvoiceText, parseSpanishMoney } from "@/modules/facturas/lib/invoice";
import { INVOICE_LINE_HEADERS } from "@/modules/facturas/lib/types";

// Text items in the order pdf.js returns them for a BP invoice.
function bpInvoiceTokens({ invoiceTotal = ["1.050,00", "220,50", "1.270,50"] } = {}) {
  return [
    "FACTURA",
    "FECHA",
    "31/07/2026",
    "NUMERO",
    "BP-123/26",
    "CENTRO DE COSTE: 7",
    "Gasóleo",
    "100,00",
    "TOTAL CENTRO DE COSTE",
    "1.000,00",
    "210,00",
    "1.210,00",
    "DESCUENTO",
    "50,00",
    "10,50",
    "60,50",
    "CENTRO DE COSTE : ABC",
    "TOTAL CENTRO DE COSTE",
    "100,00",
    "21,00",
    "121,00",
    "DESCUENTO",
    "0,00",
    "0,00",
    "0,00",
    "TOTAL FACTURA",
    ...invoiceTotal,
  ];
}

describe("parseSpanishMoney", () => {
  it.each([
    ["1.234,56", 1234.56],
    ["-0,50", -0.5],
    ["12,00", 12],
  ])("parses %s", (input, expected) => {
    expect(parseSpanishMoney(input)).toBe(expected);
  });

  it.each([["1234.56"], ["12"], ["1.23,45"], ["abc"]])("rejects %s", (input) => {
    expect(parseSpanishMoney(input)).toBeNull();
  });
});

describe("analyzeInvoiceText", () => {
  it("computes the net base per cost center and reconciles with the invoice total", () => {
    const analysis = analyzeInvoiceText({ tokens: bpInvoiceTokens(), pageCount: 2 }, "bp.pdf");

    expect(analysis.invoiceNumber).toBe("BP-123/26");
    expect(analysis.invoiceDate).toBe("31/07/2026");
    expect(analysis.pageCount).toBe(2);
    expect(analysis.centers.map((center) => [center.code, center.net])).toEqual([
      ["007", { base: 950, vat: 199.5, total: 1149.5 }],
      ["ABC", { base: 100, vat: 21, total: 121 }],
    ]);
    expect(analysis.totals).toEqual({ base: 1050, vat: 220.5, total: 1270.5 });
    expect(analysis.reconciled).toBe(true);
    expect(analysis.warnings).toEqual([]);
  });

  it("builds one invoice line per center with the configured values", () => {
    const [line] = analyzeInvoiceText({ tokens: bpInvoiceTokens(), pageCount: 1 }, "bp.pdf").lines;
    const values = Object.fromEntries(INVOICE_LINE_HEADERS.map((header, index) => [header, line.values[index]]));

    expect(line.values).toHaveLength(INVOICE_LINE_HEADERS.length);
    expect(line).toMatchObject({ costCenterCode: "007", amount: 950, vatAmount: 199.5, totalAmount: 1149.5 });
    expect(values).toMatchObject({
      Tipo: "Artículo",
      "Nº": "SC00013",
      "Descripción o comentario": "Combustible",
      "Coste unit. directo excl. IVA": 950,
      "Grupo contable IVA prod.": "IVA21SERV",
      "Cecos Código": "007",
      "Epigrafe Código": "SC00013",
      "IVA total (EUR)": 199.5,
      "Total IVA incl. (EUR)": 1149.5,
    });
  });

  it("warns when the centers do not add up to the invoice total", () => {
    const analysis = analyzeInvoiceText(
      { tokens: bpInvoiceTokens({ invoiceTotal: ["9,99", "0,00", "9,99"] }), pageCount: 1 },
      "bp.pdf",
    );

    expect(analysis.reconciled).toBe(false);
    expect(analysis.warnings[0]).toContain("no coincide");
  });

  it("warns when the invoice total is missing", () => {
    const analysis = analyzeInvoiceText(
      { tokens: bpInvoiceTokens({ invoiceTotal: [] }).slice(0, -1), pageCount: 1 },
      "bp.pdf",
    );

    expect(analysis.reconciled).toBe(false);
    expect(analysis.warnings[0]).toContain("No se encontró el resumen final");
  });

  it("fails when there are no cost center blocks", () => {
    expect(() => analyzeInvoiceText({ tokens: ["FACTURA"], pageCount: 1 }, "x.pdf")).toThrow(
      UserFacingError,
    );
  });

  it("fails when a center has no discount block", () => {
    const tokens = ["CENTRO DE COSTE: 1", "TOTAL CENTRO DE COSTE", "1,00", "0,21", "1,21", "OTRA"];
    expect(() => analyzeInvoiceText({ tokens, pageCount: 1 }, "x.pdf")).toThrow("centro de coste 001");
  });

  it("fails when a center appears twice", () => {
    const block = ["CENTRO DE COSTE: 1", "TOTAL CENTRO DE COSTE", "1,00", "0,21", "1,21", "DESCUENTO", "0,00", "0,00", "0,00"];
    expect(() => analyzeInvoiceText({ tokens: [...block, ...block], pageCount: 1 }, "x.pdf")).toThrow(
      "aparece más de una vez",
    );
  });

  it("fails when a total appears before any cost center", () => {
    expect(() =>
      analyzeInvoiceText({ tokens: ["TOTAL CENTRO DE COSTE", "1,00", "0,21", "1,21"], pageCount: 1 }, "x.pdf"),
    ).toThrow("sin su CENTRO DE COSTE");
  });
});
