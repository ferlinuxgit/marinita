"use client";

import { Download, Eye, Loader2, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

type ReportSummary = {
  id: string;
  fileName: string;
  sourceRowCount: number;
  filteredRowCount: number;
  groupCount: number;
  createdAt: string;
};

export function ReportHistory() {
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingReportId, setDeletingReportId] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      const response = await fetch("/api/reports", {
        cache: "no-store",
      });
      setIsLoading(false);

      if (!response.ok) {
        setError("No se pudo cargar el historial.");
        return;
      }

      const payload = (await response.json()) as { reports: ReportSummary[] };
      setReports(payload.reports);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  async function deleteReport(reportId: string) {
    setError("");
    setDeletingReportId(reportId);

    const response = await fetch(`/api/reports/${reportId}`, {
      method: "DELETE",
    });

    setDeletingReportId(null);

    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      setError(payload.error ?? "No se pudo eliminar el informe.");
      return;
    }

    setReports((currentReports) => currentReports.filter((report) => report.id !== reportId));
  }

  return (
    <div className="grid">
      <section>
        <h1>Historial de gastos</h1>
        <p className="muted">Informes analizados anteriormente.</p>
        <Link className="button secondary" href="/app/gastos">
          Nuevo analisis
        </Link>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Informes</h2>
        </div>
        <div className="panel-body">
          {error ? <div className="message error">{error}</div> : null}

          {isLoading ? (
            <div className="message">Cargando informes...</div>
          ) : reports.length > 0 ? (
            <div className="history-list">
              {reports.map((report) => (
                <div className="history-item" key={report.id}>
                  <Link className="history-main history-link" href={`/app/gastos/historial/${report.id}`}>
                    <strong>{report.fileName}</strong>
                    <span className="muted">
                      {new Intl.DateTimeFormat("es-ES", {
                        dateStyle: "short",
                        timeStyle: "short",
                      }).format(new Date(report.createdAt))}
                    </span>
                    <span className="muted">
                      {report.groupCount} grupos · {report.filteredRowCount} filas procesadas
                    </span>
                  </Link>
                  <div className="history-actions">
                    <Link className="button secondary" href={`/app/gastos/historial/${report.id}`}>
                      <Eye size={16} />
                      Abrir
                    </Link>
                    <a className="button secondary" href={`/api/reports/${report.id}/export`}>
                      <Download size={16} />
                      Exportar
                    </a>
                    <a
                      className="button secondary"
                      href={`/api/reports/${report.id}/accounting-export`}
                    >
                      <Download size={16} />
                      Contabilidad
                    </a>
                    <button
                      className="button danger"
                      disabled={deletingReportId === report.id}
                      onClick={() => void deleteReport(report.id)}
                      type="button"
                    >
                      {deletingReportId === report.id ? <Loader2 size={16} /> : <Trash2 size={16} />}
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="message">Todavia no hay informes guardados.</div>
          )}
        </div>
      </section>
    </div>
  );
}
