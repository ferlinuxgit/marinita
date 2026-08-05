import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { getDocument, GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf.mjs";

const packagedWorkerPath = join(process.cwd(), "pdf.worker.mjs");
const installedWorkerPath = join(
  process.cwd(),
  "node_modules",
  "pdfjs-dist",
  "legacy",
  "build",
  "pdf.worker.mjs",
);

GlobalWorkerOptions.workerSrc = pathToFileURL(
  existsSync(packagedWorkerPath) ? packagedWorkerPath : installedWorkerPath,
).href;

export const INVOICE_LINE_HEADERS = [
  "Tipo",
  "Nº",
  "N.º referencia art.",
  "Descripción",
  "Cantidad",
  "Cód. unidad medida",
  "Coste unit. directo excl. IVA",
  "Precio venta (DL)",
  "% Descuento línea",
  "Importe línea excl. IVA",
  "Coste total de CBAM",
  "Cód. de esquema especial",
  "N.º proyecto",
  "Código de fraccionamiento",
  "Aprobada",
  "Kgs. Plástico No Reciclable",
  "Importe Imp. Plástico No Rec.",
  "KgsPlastTotal",
  "Tipo descuento FF ",
  "Fecha aplicación inicio Dto. FF",
  "Fecha aplicación fin Dto. FF",
  "Cliente Asociado",
  "Provisión Transporte",
  "Provisión Rappel",
  "Cecos Código",
  "Natur Código",
  "Interco Código",
  "Año provision Código",
  "Epigrafe Código",
  "Tramo sind Código",
  "Nº línea",
  "Importe descuento factura excl. IVA",
  "Total IVA excl. (EUR)",
  "IVA total (EUR)",
  "Total IVA incl. (EUR)",
] as const;

export type MoneyTotals = {
  base: number;
  vat: number;
  total: number;
};

export type CostCenterSummary = {
  code: string;
  gross: MoneyTotals;
  discount: MoneyTotals;
  net: MoneyTotals;
};

export type InvoiceLineValue = string | number;

export type InvoiceLine = {
  costCenterCode: string;
  lineNumber: number;
  amount: number;
  values: InvoiceLineValue[];
};

export type InvoicePdfAnalysis = {
  fileName: string;
  invoiceNumber: string;
  invoiceDate: string;
  pageCount: number;
  centers: CostCenterSummary[];
  totals: MoneyTotals;
  invoiceTotals: MoneyTotals | null;
  reconciled: boolean;
  warnings: string[];
  headers: readonly string[];
  lines: InvoiceLine[];
};

type PdfTextItem = {
  str: string;
};

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

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

function parseSpanishMoney(value: string) {
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

function readTotals(tokens: string[], startIndex: number) {
  const values = tokens.slice(startIndex, startIndex + 3).map(parseSpanishMoney);

  if (values.some((value) => value === null)) {
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

function makeInvoiceLine(
  center: CostCenterSummary,
  index: number,
  invoiceTotals: MoneyTotals,
): InvoiceLine {
  const lineNumber = (index + 1) * 10000;
  const values: InvoiceLineValue[] = [
    "Artículo",
    "SC00013",
    "",
    "Combustible",
    1,
    "UND",
    center.net.base,
    0,
    0,
    center.net.base,
    0,
    "01 General",
    "",
    "",
    "FALSE",
    0,
    0,
    0,
    "",
    "",
    "",
    "",
    0,
    0,
    center.code,
    "",
    "",
    "",
    "SC00013",
    "",
    lineNumber,
    0,
    invoiceTotals.base,
    invoiceTotals.vat,
    invoiceTotals.total,
  ];

  return {
    costCenterCode: center.code,
    lineNumber,
    amount: center.net.base,
    values,
  };
}

export async function analyzeInvoicePdf(
  buffer: Buffer,
  fileName: string,
): Promise<InvoicePdfAnalysis> {
  const data = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const loadingTask = getDocument({ data });
  const pdf = await loadingTask.promise;
  const tokens: string[] = [];

  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();

      for (const item of content.items) {
        if (!("str" in item)) {
          continue;
        }

        const value = (item as PdfTextItem).str.trim();

        if (value) {
          tokens.push(value);
        }
      }
    }
  } finally {
    await loadingTask.destroy();
  }

  const firstDateIndex = tokens.findIndex((token) => token === "FECHA");
  const firstNumberIndex = tokens.findIndex((token) => token === "NUMERO");
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
      throw new Error("Se encontró un total sin su CENTRO DE COSTE correspondiente.");
    }

    const gross = readTotals(tokens, index + 1);
    const discountLabelIndex = index + 4;
    const discount =
      tokens[discountLabelIndex] === "DESCUENTO"
        ? readTotals(tokens, discountLabelIndex + 1)
        : null;

    if (!gross || !discount) {
      throw new Error(`No se pudieron leer los importes del centro de coste ${currentCenter}.`);
    }

    if (centers.some((center) => center.code === currentCenter)) {
      throw new Error(`El centro de coste ${currentCenter} aparece más de una vez.`);
    }

    centers.push({
      code: currentCenter,
      gross,
      discount,
      net: subtractTotals(gross, discount),
    });
  }

  if (centers.length === 0) {
    throw new Error(
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
    pageCount: pdf.numPages,
    centers,
    totals,
    invoiceTotals: lastInvoiceTotals,
    reconciled,
    warnings,
    headers: INVOICE_LINE_HEADERS,
    lines: centers.map((center, index) => makeInvoiceLine(center, index, totals)),
  };
}
