export type SummaryRow = {
  accountCode: string;
  teamsExternalId: string;
  expenseOwnerId: string;
  expenseOwner: string;
  totalAgrupadoEur: number;
};

export type ExcelAnalysis = {
  sourceRowCount: number;
  filteredRowCount: number;
  rows: SummaryRow[];
};

export type ReportSummary = {
  id: string;
  fileName: string;
  sourceRowCount: number;
  filteredRowCount: number;
  groupCount: number;
  createdAt: string;
};

export type ReportResponse = {
  report: Omit<ReportSummary, "createdAt"> & { createdAt?: string };
  rows: SummaryRow[];
};

export function compareSummaryRows(a: SummaryRow, b: SummaryRow) {
  return a.expenseOwnerId.localeCompare(b.expenseOwnerId, "es", {
    numeric: true,
    sensitivity: "base",
  });
}
