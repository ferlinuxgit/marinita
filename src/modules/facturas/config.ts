// Business rules for the BP fuel invoice module. Change values here, not in the parsing code.
export const facturasConfig = {
  upload: {
    maxBytes: 20 * 1024 * 1024,
  },
  /** VAT applied to the net base of each cost center line. */
  vatRate: 0.21,
  /** Fixed values of every generated invoice line. */
  line: {
    type: "Artículo",
    itemNumber: "SC00013",
    businessVatGroup: "NACIONAL",
    description: "Combustible",
    quantity: 1,
    productVatGroup: "IVA21SERV",
    epigraphCode: "SC00013",
  },
  /** Max lines accepted by the XLSX export endpoint. */
  maxExportLines: 1000,
};
