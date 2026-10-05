"use client";

import {
  Check,
  CheckCircle2,
  Clipboard,
  FileSpreadsheet,
  FileText,
  FileUp,
  Loader2,
  TriangleAlert,
} from "lucide-react";
import { FormEvent, useState } from "react";

import { formatMoney } from "@/core/lib/money";
import { downloadFile, errorMessage, fetchJson, uploadBody } from "@/core/ui/api-client";
import { FileDropzone } from "@/core/ui/file-dropzone";
import type { InvoicePdfAnalysis } from "@/modules/facturas/lib/types";
import { facturasApi } from "@/modules/facturas/module";

const numberFormatter = new Intl.NumberFormat("es-ES", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: false,
});

function formatCell(value: string | number) {
  return typeof value === "number" ? numberFormatter.format(value) : value;
}

function makeTsv(result: InvoicePdfAnalysis, includeHeaders: boolean) {
  const rows = result.lines.map((line) => line.values.map(formatCell).join("\t"));

  if (includeHeaders) {
    rows.unshift(result.headers.join("\t"));
  }

  return rows.join("\n");
}

export function InvoiceCostCenterAnalyzer() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<InvoicePdfAnalysis | null>(null);
  const [error, setError] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [copied, setCopied] = useState<"lines" | "headers" | null>(null);

  function selectFile(selectedFile: File | null) {
    setError("");
    setResult(null);
    setCopied(null);

    if (!selectedFile) {
      setFile(null);
      return;
    }

    if (!selectedFile.name.toLowerCase().endsWith(".pdf")) {
      setFile(null);
      setError("Solo se admiten archivos PDF.");
      return;
    }

    setFile(selectedFile);
  }

  async function analyze(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setResult(null);
    setCopied(null);

    if (!file) {
      setError("Selecciona una factura en PDF.");
      return;
    }

    setIsPending(true);

    try {
      setResult(
        await fetchJson<InvoicePdfAnalysis>(
          facturasApi.analyze,
          { method: "POST", body: uploadBody(file) },
          "No se pudo leer la factura.",
        ),
      );
    } catch (requestError) {
      setError(errorMessage(requestError, "No se pudo leer la factura."));
    } finally {
      setIsPending(false);
    }
  }

  async function copyRows(includeHeaders: boolean) {
    if (!result) {
      return;
    }

    try {
      await navigator.clipboard.writeText(makeTsv(result, includeHeaders));
      setCopied(includeHeaders ? "headers" : "lines");
      window.setTimeout(() => setCopied(null), 2200);
    } catch {
      setError("El navegador no ha permitido copiar. Descarga el TSV como alternativa.");
    }
  }

  async function exportXlsx() {
    if (!result) {
      return;
    }

    setError("");
    setIsExporting(true);

    try {
      await downloadFile(
        facturasApi.export,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            invoiceNumber: result.invoiceNumber,
            lines: result.lines.map((line) => line.values),
          }),
        },
        `Líneas_${result.invoiceNumber || "factura"}.xlsx`,
        "No se pudo generar el Excel.",
      );
    } catch (requestError) {
      setError(errorMessage(requestError, "No se pudo descargar el Excel. Inténtalo de nuevo."));
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="invoice-app">
      <section className="invoice-heading">
        <div>
          <p className="eyebrow">Facturas de combustible</p>
          <h1>Agrupar por centro de coste</h1>
          <p className="muted invoice-intro">
            Lee los totales y descuentos del PDF, calcula la base de cada centro y prepara las
            líneas para pegarlas en la factura.
          </p>
        </div>
        <div className="invoice-formula" aria-label="Fórmula aplicada">
          <span>Base de la línea</span>
          <strong>Total centro de coste - Descuento</strong>
        </div>
      </section>

      <section className="panel upload-panel">
        <div className="panel-header">
          <div>
            <h2>Factura PDF</h2>
            <p className="panel-subtitle">Formato BP con bloques CENTRO DE COSTE</p>
          </div>
          <FileText size={20} aria-hidden="true" />
        </div>
        <div className="panel-body">
          <form className="stack" onSubmit={analyze}>
            <div className="field">
              <label htmlFor="invoice-file">Archivo</label>
              <FileDropzone
                accept=".pdf,application/pdf"
                className="invoice-dropzone"
                id="invoice-file"
                onSelect={selectFile}
              >
                <span className="dropzone-icon" aria-hidden="true">
                  <FileUp size={22} />
                </span>
                <span className="dropzone-copy">
                  <strong>{file ? file.name : "Arrastra aquí la factura"}</strong>
                  <span>{file ? "PDF listo para analizar" : "o haz clic para seleccionarla"}</span>
                </span>
              </FileDropzone>
            </div>

            {error ? <div className="message error">{error}</div> : null}

            <div className="row start">
              <button className="button" disabled={isPending} type="submit">
                {isPending ? <Loader2 className="spin" size={17} /> : <FileText size={17} />}
                {isPending ? "Leyendo el PDF..." : "Procesar factura"}
              </button>
              {file ? (
                <span className="file-meta">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
              ) : null}
            </div>
          </form>
        </div>
      </section>

      {result ? (
        <section className="invoice-result" aria-live="polite">
          <div className={`reconciliation ${result.reconciled ? "ok" : "warning"}`}>
            {result.reconciled ? (
              <CheckCircle2 size={21} aria-hidden="true" />
            ) : (
              <TriangleAlert size={21} aria-hidden="true" />
            )}
            <div>
              <strong>
                {result.reconciled
                  ? "Los importes cuadran con el resumen del PDF"
                  : "Revisión necesaria antes de copiar"}
              </strong>
              <span>
                {result.reconciled
                  ? `${result.centers.length} centros de coste comprobados.`
                  : result.warnings.join(" ")}
              </span>
            </div>
          </div>

          <div className="invoice-metrics" aria-label="Resumen de la factura">
            <div>
              <span>Factura</span>
              <strong>{result.invoiceNumber || "No identificada"}</strong>
              <small>{result.invoiceDate || result.fileName}</small>
            </div>
            <div>
              <span>Centros</span>
              <strong>{result.centers.length}</strong>
              <small>{result.pageCount} páginas leídas</small>
            </div>
            <div>
              <span>Base total</span>
              <strong>{formatMoney(result.totals.base)}</strong>
              <small>después de descuentos</small>
            </div>
            <div>
              <span>Total factura</span>
              <strong>{formatMoney(result.totals.total)}</strong>
              <small>IVA incluido</small>
            </div>
          </div>

          <section className="panel result-panel">
            <div className="panel-header result-header">
              <div>
                <h2>Líneas preparadas</h2>
                <p className="panel-subtitle">Una línea por centro, en el orden del PDF</p>
              </div>
              <div className="result-actions">
                <button className="button" onClick={() => copyRows(false)} type="button">
                  {copied === "lines" ? <Check size={17} /> : <Clipboard size={17} />}
                  {copied === "lines" ? "Copiadas" : "Copiar líneas"}
                </button>
                <button className="button secondary" onClick={() => copyRows(true)} type="button">
                  {copied === "headers" ? <Check size={17} /> : <Clipboard size={17} />}
                  Con cabeceras
                </button>
                <button
                  className="button secondary"
                  disabled={isExporting}
                  onClick={exportXlsx}
                  type="button"
                >
                  {isExporting ? (
                    <Loader2 className="spin" size={17} />
                  ) : (
                    <FileSpreadsheet size={17} />
                  )}
                  {isExporting ? "Generando..." : "Descargar XLSX"}
                </button>
              </div>
            </div>

            <div className="table-wrap compact-table-wrap">
              <table className="invoice-summary-table">
                <thead>
                  <tr>
                    <th>Centro</th>
                    <th>Total centro excl. IVA</th>
                    <th>Descuento excl. IVA</th>
                    <th>Base de la línea</th>
                    <th>IVA {Math.round(result.vatRate * 100)}%</th>
                    <th>Total línea</th>
                  </tr>
                </thead>
                <tbody>
                  {result.centers.map((center, index) => (
                    <tr key={center.code}>
                      <td className="code-cell">{center.code}</td>
                      <td className="amount">{formatMoney(center.gross.base)}</td>
                      <td className="amount discount-amount">
                        -{formatMoney(center.discount.base)}
                      </td>
                      <td className="amount net-amount">{formatMoney(center.net.base)}</td>
                      <td className="amount">{formatMoney(result.lines[index].vatAmount)}</td>
                      <td className="amount">{formatMoney(result.lines[index].totalAmount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th>Total</th>
                    <td />
                    <td />
                    <th className="amount">{formatMoney(result.totals.base)}</th>
                    <td />
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>

            <details className="full-preview">
              <summary>Ver las {result.headers.length} columnas que se copiarán</summary>
              <div className="table-wrap full-table-wrap">
                <table className="full-lines-table">
                  <thead>
                    <tr>
                      {result.headers.map((header) => (
                        <th key={header}>{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.lines.map((line) => (
                      <tr key={line.costCenterCode}>
                        {line.values.map((value, index) => (
                          <td key={`${line.costCenterCode}-${result.headers[index]}`}>
                            {formatCell(value)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </section>
        </section>
      ) : null}
    </div>
  );
}
