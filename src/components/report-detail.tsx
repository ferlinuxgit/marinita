"use client";

import { Loader2, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ReportPreview, type ReportResponse } from "@/components/report-preview";

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
      const response = await fetch(`/api/reports/${reportId}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as ReportResponse | { error?: string };

      setIsLoading(false);

      if (!response.ok) {
        setError("error" in payload && payload.error ? payload.error : "No se pudo cargar el informe.");
        return;
      }

      setResult(payload as ReportResponse);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [reportId]);

  async function deleteReport() {
    setError("");
    setIsDeleting(true);

    const response = await fetch(`/api/reports/${reportId}`, {
      method: "DELETE",
    });

    setIsDeleting(false);

    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      setError(payload.error ?? "No se pudo eliminar el informe.");
      return;
    }

    router.replace("/app/gastos/historial");
    router.refresh();
  }

  return (
    <div className="grid">
      <section>
        <h1>Informe guardado</h1>
        <p className="muted">{result?.report.fileName ?? "Vista previa del informe"}</p>
        <div className="row start">
          <Link className="button secondary" href="/app/gastos/historial">
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
