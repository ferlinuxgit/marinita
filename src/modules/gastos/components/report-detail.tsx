"use client";

import { Loader2, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { errorMessage, fetchJson } from "@/core/ui/api-client";
import { ReportPreview } from "@/modules/gastos/components/report-preview";
import type { ReportResponse } from "@/modules/gastos/lib/types";
import { gastosApi, gastosRoutes } from "@/modules/gastos/module";

type ReportDetailProps = {
  reportId: string;
};

export function ReportDetail({ reportId }: ReportDetailProps) {
  const router = useRouter();
  const [result, setResult] = useState<ReportResponse | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      try {
        setResult(
          await fetchJson<ReportResponse>(
            gastosApi.report(reportId),
            undefined,
            "No se pudo cargar el informe.",
          ),
        );
      } catch (requestError) {
        setError(errorMessage(requestError, "No se pudo cargar el informe."));
      } finally {
        setIsLoading(false);
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, [reportId]);

  async function deleteReport() {
    setError("");
    setIsDeleting(true);

    try {
      await fetchJson(gastosApi.report(reportId), { method: "DELETE" }, "No se pudo eliminar el informe.");
    } catch (requestError) {
      setError(errorMessage(requestError, "No se pudo eliminar el informe."));
      return;
    } finally {
      setIsDeleting(false);
    }

    router.replace(gastosRoutes.history);
    router.refresh();
  }

  return (
    <div className="grid">
      <section>
        <h1>Informe guardado</h1>
        <p className="muted">{result?.report.fileName ?? "Vista previa del informe"}</p>
        <div className="row start">
          <Link className="button secondary" href={gastosRoutes.history}>
            Historial
          </Link>
          <button className="button danger" disabled={isDeleting} onClick={deleteReport} type="button">
            {isDeleting ? <Loader2 size={16} /> : <Trash2 size={16} />}
            Eliminar
          </button>
        </div>
      </section>

      {error ? <div className="message error">{error}</div> : null}
      {isLoading ? <div className="message">Cargando informe...</div> : null}
      {result ? <ReportPreview result={result} /> : null}
    </div>
  );
}
