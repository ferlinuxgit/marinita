"use client";

import { Download } from "lucide-react";

import { formatMoney } from "@/core/lib/money";
import type { ReportResponse } from "@/modules/gastos/lib/types";
import { gastosApi } from "@/modules/gastos/module";

const PREVIEW_LIMIT = 200;

type ReportPreviewProps = {
  result: ReportResponse;
};

export function ReportPreview({ result }: ReportPreviewProps) {
  const previewRows = result.rows.slice(0, PREVIEW_LIMIT);
  const groupedTotal = result.rows.reduce((total, row) => total + row.totalAgrupadoEur, 0);

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>Vista previa</h2>
          <span className="muted">{result.report.fileName}</span>
        </div>
        <div className="row start">
          <a className="button secondary" href={gastosApi.accountingExport(result.report.id)}>
            <Download size={16} />
            Exportar contabilidad
          </a>
          <a className="button" href={gastosApi.summaryExport(result.report.id)}>
            <Download size={16} />
            Exportar XLSX
          </a>
        </div>
      </div>
      <div className="panel-body stack">
        <div className="metrics">
          <div className="metric">
            <span className="metric-value">{result.report.sourceRowCount}</span>
            <span className="muted">filas origen</span>
          </div>
          <div className="metric">
            <span className="metric-value">{result.report.filteredRowCount}</span>
            <span className="muted">filas procesadas</span>
          </div>
          <div className="metric">
            <span className="metric-value">{result.report.groupCount}</span>
            <span className="muted">grupos generados</span>
          </div>
          <div className="metric">
            <span className="metric-value">{formatMoney(groupedTotal)}</span>
            <span className="muted">total agrupado</span>
          </div>
        </div>

        {previewRows.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Account Code</th>
                  <th>Teams External ID</th>
                  <th>Expense Owner ID</th>
                  <th>Expense Owner</th>
                  <th>Total Agrupado</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row) => (
                  <tr
                    key={[
                      row.accountCode,
                      row.teamsExternalId,
                      row.expenseOwnerId,
                      row.expenseOwner,
                    ].join("-")}
                  >
                    <td>{row.accountCode}</td>
                    <td>{row.teamsExternalId}</td>
                    <td>{row.expenseOwnerId}</td>
                    <td>{row.expenseOwner}</td>
                    <td className="amount">{formatMoney(row.totalAgrupadoEur)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="message">No hay filas para exportar despues del filtro.</div>
        )}

        {result.rows.length > previewRows.length ? (
          <div className="message">
            Mostrando las primeras {previewRows.length} filas de {result.rows.length}. El archivo
            exportado incluye todas.
          </div>
        ) : null}
      </div>
    </section>
  );
}
