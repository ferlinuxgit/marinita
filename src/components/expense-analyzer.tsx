"use client";

import { Download, FileUp, Loader2 } from "lucide-react";
import Link from "next/link";
import { DragEvent, FormEvent, useRef, useState } from "react";

import { ReportPreview, type ReportResponse } from "@/components/report-preview";

export function ExpenseAnalyzer() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ReportResponse | null>(null);
  const [error, setError] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

    const nextResult = payload as ReportResponse;
    setResult(nextResult);
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

  function onDragOver(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setIsDragging(true);
  }

  function onDragLeave(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setIsDragging(false);
  }

  function onDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setIsDragging(false);
    selectFile(event.dataTransfer.files.item(0));
  }

  return (
    <div className="grid">
      <section>
        <h1>Analisis de gastos</h1>
        <p className="muted">
          Sube el export de Payhawk en formato .xlsx. Se analizara la hoja Payments, se excluiran
          facturas y se agruparan los importes por cuenta, equipo y empleado.
        </p>
        <Link className="button secondary" href="/app/gastos/historial">
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
              <button
                className={`dropzone ${isDragging ? "dragging" : ""}`}
                onClick={() => fileInputRef.current?.click()}
                onDragLeave={onDragLeave}
                onDragOver={onDragOver}
                onDrop={onDrop}
                type="button"
              >
                <FileUp size={22} />
                <span>{file ? file.name : "Arrastra un .xlsx o haz click para seleccionarlo"}</span>
              </button>
              <input
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="sr-only"
                id="file"
                onChange={(event) => selectFile(event.target.files?.[0] ?? null)}
                ref={fileInputRef}
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

      {result ? <ReportPreview result={result} /> : null}
    </div>
  );
}
