"use client";

import { Download, FileUp, Loader2 } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";

type SummaryRow = {
  accountCode: string;
  teamsExternalId: string;
  expenseOwnerId: string;
  expenseOwner: string;
  totalAgrupadoEur: number;
};

type ReportResponse = {
  report: {
    id: string;
    fileName: string;
    sourceRowCount: number;
    filteredRowCount: number;
    groupCount: number;
  };
  rows: SummaryRow[];
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

export function ExpenseAnalyzer() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ReportResponse | null>(null);
  const [error, setError] = useState("");
  const [isPending, setIsPending] = useState(false);

  const previewRows = useMemo(() => result?.rows.slice(0, 50) ?? [], [result]);

  async function analyze(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setResult(null);

    if (!file) {
      setError("Selecciona un archivo .xlsx.");
      return;
    }

    const body = new FormData();
    body.append("file", file);
    setIsPending(true);

    const response = await fetch("/api/reports", {
      method: "POST",
      body,
    });

    const payload = (await response.json()) as ReportResponse | { error?: string };
    setIsPending(false);

    if (!response.ok) {
      setError("error" in payload && payload.error ? payload.error : "No se pudo analizar el Excel.");
      return;
    }

    setResult(payload as ReportResponse);
  }

  return (
    <div className="grid">
      <section>
        <h1>Analisis de gastos</h1>
        <p className="muted">
          Sube el export de Payhawk en formato .xlsx. Se analizara la hoja Payments, se excluiran
          facturas y se agruparan los importes por cuenta, equipo y empleado.
        </p>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Subida</h2>
        </div>
        <div className="panel-body">
          <form className="stack" onSubmit={analyze}>
            <div className="field">
              <label htmlFor="file">Excel</label>
              <input
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="input"
                id="file"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                required
                type="file"
              />
            </div>

            {error ? <div className="message error">{error}</div> : null}

            <div className="row">
              <button className="button" disabled={isPending} type="submit">
                {isPending ? <Loader2 size={16} /> : <FileUp size={16} />}
                {isPending ? "Analizando..." : "Analizar Excel"}
              </button>
              {result ? (
                <a className="button secondary" href={`/api/reports/${result.report.id}/export`}>
                  <Download size={16} />
                  Exportar XLSX
                </a>
              ) : null}
            </div>
          </form>
        </div>
      </section>

      {result ? (
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Vista previa</h2>
              <span className="muted">{result.report.fileName}</span>
            </div>
            <a className="button" href={`/api/reports/${result.report.id}/export`}>
              <Download size={16} />
              Exportar XLSX
            </a>
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
                Mostrando las primeras {previewRows.length} filas de {result.rows.length}. El
                archivo exportado incluye todas.
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
