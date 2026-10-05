"use client";

import { Download, Eye, Loader2, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { errorMessage, fetchJson } from "@/core/ui/api-client";
import type { ReportSummary } from "@/modules/gastos/lib/types";
import { gastosApi, gastosRoutes } from "@/modules/gastos/module";

export function ReportHistory() {
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingReportId, setDeletingReportId] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      try {
        const payload = await fetchJson<{ reports: ReportSummary[] }>(
          gastosApi.reports,
          undefined,
          "No se pudo cargar el historial.",
        );
        setReports(payload.reports);
      } catch (requestError) {
        setError(errorMessage(requestError, "No se pudo cargar el historial."));
      } finally {
        setIsLoading(false);
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  async function deleteReport(reportId: string) {
    setError("");
    setDeletingReportId(reportId);

    try {
      await fetchJson(gastosApi.report(reportId), { method: "DELETE" }, "No se pudo eliminar el informe.");
    } catch (requestError) {
      setError(errorMessage(requestError, "No se pudo eliminar el informe."));
      return;
    } finally {
      setDeletingReportId(null);
    }

    setReports((currentReports) => currentReports.filter((report) => report.id !== reportId));
  }

  return (
    <div className="grid">
      <section>
        <h1>Historial de gastos</h1>
        <p className="muted">Informes analizados anteriormente.</p>
        <Link className="button secondary" href={gastosRoutes.home}>
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
                  <Link className="history-main history-link" href={gastosRoutes.report(report.id)}>
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
                    <Link className="button secondary" href={gastosRoutes.report(report.id)}>
                      <Eye size={16} />
                      Abrir
                    </Link>
                    <a className="button secondary" href={gastosApi.summaryExport(report.id)}>
                      <Download size={16} />
                      Exportar
                    </a>
                    <a
                      className="button secondary"
                      href={gastosApi.accountingExport(report.id)}
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
