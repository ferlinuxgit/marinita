export const INVOICE_LINE_HEADERS = [
  "Tipo",
  "Nº",
  "Grupo contable IVA negocio",
  "Descripción o comentario",
  "Cantidad",
  "Coste unit. directo excl. IVA",
  "Grupo contable IVA prod.",
  "Importe línea excl. IVA",
  "Cecos Código",
  "Natur Código",
  "Interco Código",
  "Epigrafe Código",
  "Kgs. Plástico No Reciclable",
  "KgsPlastTotal",
  "Importe Imp. Plástico No Rec.",
  "Cant. a asignar",
  "Año provision Código",
  "Subtotal excl. IVA (EUR)",
  "Importe dto. factura (EUR)",
  "% descuento en factura",
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
  amount: number;
  vatAmount: number;
  totalAmount: number;
  values: InvoiceLineValue[];
};

export type InvoicePdfAnalysis = {
  fileName: string;
  invoiceNumber: string;
  invoiceDate: string;
  pageCount: number;
  vatRate: number;
  centers: CostCenterSummary[];
  totals: MoneyTotals;
  invoiceTotals: MoneyTotals | null;
  reconciled: boolean;
  warnings: string[];
  headers: readonly string[];
  lines: InvoiceLine[];
};
