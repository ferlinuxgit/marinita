"use client";

import { Download, FileUp, Loader2 } from "lucide-react";
import Link from "next/link";
import { FormEvent, useState } from "react";

import { errorMessage, fetchJson, uploadBody } from "@/core/ui/api-client";
import { DefaultDropzoneContent, FileDropzone } from "@/core/ui/file-dropzone";
import { ReportPreview } from "@/modules/gastos/components/report-preview";
import type { ReportResponse } from "@/modules/gastos/lib/types";
import { gastosApi, gastosRoutes } from "@/modules/gastos/module";

export function ExpenseAnalyzer() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ReportResponse | null>(null);
  const [error, setError] = useState("");
  const [isPending, setIsPending] = useState(false);

  async function analyze(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setResult(null);

    if (!file) {
      setError("Selecciona un archivo .xlsx.");
      return;
    }

    setIsPending(true);

    try {
      setResult(
        await fetchJson<ReportResponse>(
          gastosApi.reports,
          { method: "POST", body: uploadBody(file) },
          "No se pudo analizar el Excel.",
        ),
      );
    } catch (requestError) {
      setError(errorMessage(requestError, "No se pudo analizar el Excel."));
    } finally {
      setIsPending(false);
    }
  }

  function selectFile(selectedFile: File | null) {
    setError("");
    setResult(null);

    if (!selectedFile) {
      setFile(null);
      return;
    }

    if (!selectedFile.name.toLowerCase().endsWith(".xlsx")) {
      setFile(null);
      setError("Solo se admiten archivos .xlsx.");
      return;
    }

    setFile(selectedFile);
  }

  return (
    <div className="grid">
      <section>
        <h1>Analisis de gastos</h1>
        <p className="muted">
          Sube el export de Payhawk en formato .xlsx. Se analizara la hoja Payments, se excluiran
          facturas y se agruparan los importes por cuenta, equipo y empleado.
        </p>
        <Link className="button secondary" href={gastosRoutes.history}>
          Historial
        </Link>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Subida</h2>
        </div>
        <div className="panel-body">
          <form className="stack" onSubmit={analyze}>
            <div className="field">
              <label htmlFor="file">Excel</label>
              <FileDropzone
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                id="file"
                onSelect={selectFile}
              >
                <DefaultDropzoneContent
                  label={file ? file.name : "Arrastra un .xlsx o haz click para seleccionarlo"}
                />
              </FileDropzone>
            </div>

            {error ? <div className="message error">{error}</div> : null}

            <div className="row">
              <button className="button" disabled={isPending} type="submit">
                {isPending ? <Loader2 size={16} /> : <FileUp size={16} />}
                {isPending ? "Analizando..." : "Analizar Excel"}
              </button>
              {result ? (
                <a className="button secondary" href={gastosApi.summaryExport(result.report.id)}>
                  <Download size={16} />
                  Exportar XLSX
                </a>
              ) : null}
            </div>
          </form>
        </div>
      </section>

      {result ? <ReportPreview result={result} /> : null}
    </div>
  );
}
