// Business rules for the Payhawk expenses module. Change values here, not in the parsing code.
export const gastosConfig = {
  upload: {
    maxBytes: 8 * 1024 * 1024,
  },
  source: {
    sheetName: "Payments",
    /** `Document Type` values (case-insensitive) excluded from the summary. */
    excludedDocumentTypes: ["invoice"],
  },
  history: {
    listLimit: 50,
  },
  accounting: {
    /** Document number is `<prefix><MM>` using the month of the accounting date. */
    documentNumberPrefix: "PAY",
    movementType: "Cuenta",
    counterpartType: "Banco",
    counterpartAccount: "ASLH2202",
    /** `Epigrafe Código` by account code; accounts not listed get an empty value. */
    epigraphByAccountCode: {
      "6290007": "SC00032",
    } as Record<string, string>,
  },
};
