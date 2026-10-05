import { UserFacingError } from "@/core/http/errors";
import { roundMoney } from "@/core/lib/money";
import { facturasConfig } from "@/modules/facturas/config";
import {
  INVOICE_LINE_HEADERS,
  type CostCenterSummary,
  type InvoiceLine,
  type InvoiceLineValue,
  type InvoicePdfAnalysis,
  type MoneyTotals,
} from "@/modules/facturas/lib/types";

export type PdfText = {
  tokens: string[];
  pageCount: number;
};

function subtractTotals(gross: MoneyTotals, discount: MoneyTotals): MoneyTotals {
  return {
    base: roundMoney(gross.base - discount.base),
    vat: roundMoney(gross.vat - discount.vat),
    total: roundMoney(gross.total - discount.total),
  };
}

function sumTotals(totals: MoneyTotals[]): MoneyTotals {
  return totals.reduce(
    (sum, item) => ({
      base: roundMoney(sum.base + item.base),
      vat: roundMoney(sum.vat + item.vat),
      total: roundMoney(sum.total + item.total),
    }),
    { base: 0, vat: 0, total: 0 },
  );
}

export function parseSpanishMoney(value: string) {
  const normalized = value.trim().replace(/\s/g, "");

  if (!/^-?\d{1,3}(?:\.\d{3})*,\d{2}$/.test(normalized)) {
    return null;
  }

  const parsed = Number(normalized.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeCostCenter(value: string) {
  const trimmed = value.trim();
  return /^\d+$/.test(trimmed) ? trimmed.padStart(3, "0") : trimmed;
}

function readTotals(tokens: string[], startIndex: number): MoneyTotals | null {
  const values = tokens.slice(startIndex, startIndex + 3).map(parseSpanishMoney);

  if (values.length < 3 || values.some((value) => value === null)) {
    return null;
  }

  return {
    base: values[0] as number,
    vat: values[1] as number,
    total: values[2] as number,
  };
}

function sameTotals(left: MoneyTotals, right: MoneyTotals) {
  return (
    Math.abs(left.base - right.base) < 0.011 &&
    Math.abs(left.vat - right.vat) < 0.011 &&
    Math.abs(left.total - right.total) < 0.011
  );
}

export function makeInvoiceLine(center: CostCenterSummary): InvoiceLine {
  const { line, vatRate } = facturasConfig;
  const base = center.net.base;
  const vatAmount = roundMoney(base * vatRate);
  const totalAmount = roundMoney(base + vatAmount);
  const values: InvoiceLineValue[] = [
    line.type,
    line.itemNumber,
    line.businessVatGroup,
    line.description,
    line.quantity,
    base,
    line.productVatGroup,
    base,
    center.code,
    "",
    "",
    line.epigraphCode,
    0,
    0,
    0,
    0,
    "",
    base,
    0,
    0,
    base,
    vatAmount,
    totalAmount,
  ];

  return {
    costCenterCode: center.code,
    amount: base,
    vatAmount,
    totalAmount,
    values,
  };
}

/** Builds the analysis from the text tokens of a BP invoice, in reading order. */
export function analyzeInvoiceText({ tokens, pageCount }: PdfText, fileName: string): InvoicePdfAnalysis {
  const firstDateIndex = tokens.indexOf("FECHA");
  const firstNumberIndex = tokens.indexOf("NUMERO");
  const invoiceDate = firstDateIndex >= 0 ? (tokens[firstDateIndex + 1] ?? "") : "";
  const invoiceNumber = firstNumberIndex >= 0 ? (tokens[firstNumberIndex + 1] ?? "") : "";
  const centers: CostCenterSummary[] = [];
  let currentCenter = "";
  let lastInvoiceTotals: MoneyTotals | null = null;

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    const centerMatch = token.match(/^CENTRO DE COSTE\s*:\s*(\S+)$/i);

    if (centerMatch) {
      currentCenter = normalizeCostCenter(centerMatch[1]);
      continue;
    }

    if (token === "TOTAL FACTURA") {
      const totals = readTotals(tokens, index + 1);

      if (totals) {
        lastInvoiceTotals = totals;
      }
      continue;
    }

    if (token !== "TOTAL CENTRO DE COSTE") {
      continue;
    }

    if (!currentCenter) {
      throw new UserFacingError("Se encontró un total sin su CENTRO DE COSTE correspondiente.");
    }

    const gross = readTotals(tokens, index + 1);
    const discountLabelIndex = index + 4;
    const discount =
      tokens[discountLabelIndex] === "DESCUENTO" ? readTotals(tokens, discountLabelIndex + 1) : null;

    if (!gross || !discount) {
      throw new UserFacingError(`No se pudieron leer los importes del centro de coste ${currentCenter}.`);
    }

    if (centers.some((center) => center.code === currentCenter)) {
      throw new UserFacingError(`El centro de coste ${currentCenter} aparece más de una vez.`);
    }

    centers.push({
      code: currentCenter,
      gross,
      discount,
      net: subtractTotals(gross, discount),
    });
  }

  if (centers.length === 0) {
    throw new UserFacingError(
      "No se encontraron bloques 'CENTRO DE COSTE' con su total y descuento. Comprueba que sea una factura BP con texto seleccionable.",
    );
  }

  const totals = sumTotals(centers.map((center) => center.net));
  const warnings: string[] = [];
  const reconciled = lastInvoiceTotals ? sameTotals(totals, lastInvoiceTotals) : false;

  if (!lastInvoiceTotals) {
    warnings.push("No se encontró el resumen final de la factura para comprobar los totales.");
  } else if (!reconciled) {
    warnings.push(
      "La suma de los centros de coste no coincide con el resumen final del PDF. Revisa los importes antes de copiar.",
    );
  }

  if (!invoiceNumber) {
    warnings.push("No se pudo identificar el número de factura.");
  }

  return {
    fileName,
    invoiceNumber,
    invoiceDate,
    pageCount,
    vatRate: facturasConfig.vatRate,
    centers,
    totals,
    invoiceTotals: lastInvoiceTotals,
    reconciled,
    warnings,
    headers: INVOICE_LINE_HEADERS,
    lines: centers.map(makeInvoiceLine),
  };
}
