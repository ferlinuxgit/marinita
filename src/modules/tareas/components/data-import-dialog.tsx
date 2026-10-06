"use client";

import { AlertTriangle, Download, FileSpreadsheet, FileUp, Loader2, Upload } from "lucide-react";
import { useState } from "react";

import { errorMessage, fetchJson, uploadBody } from "@/core/ui/api-client";
import { FileDropzone } from "@/core/ui/file-dropzone";
import { Modal } from "@/core/ui/modal";
import { tareasApi } from "@/modules/tareas/module";

type PreviewEntry = { sheet: string; title: string; description: string; summary: string; exists: boolean };
type Preview = { entries: PreviewEntry[]; ignored: string[]; warnings: string[] };
export type ImportOutcome = { created: number; updated: number };

type DataImportDialogProps = {
  onClose: () => void;
  onImported: (outcome: ImportOutcome) => void;
};

function importBody(file: File, mode: "preview" | "apply", duplicates?: "update" | "create") {
  const body = uploadBody(file);
  body.append("mode", mode);

  if (duplicates) {
    body.append("duplicates", duplicates);
  }

  return body;
}

export function DataImportDialog({ onClose, onImported }: DataImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [duplicates, setDuplicates] = useState<"update" | "create">("update");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"preview" | "apply" | null>(null);

  async function selectFile(selected: File | null) {
    setError("");
    setPreview(null);

    if (!selected) {
      return;
    }

    if (!selected.name.toLowerCase().endsWith(".xlsx")) {
      setError("Elige un archivo de Excel (.xlsx).");
      return;
    }

    setFile(selected);
    setBusy("preview");

    try {
      setPreview(
        await fetchJson<Preview>(tareasApi.dataImport, { method: "POST", body: importBody(selected, "preview") }, "No se pudo leer el Excel."),
      );
    } catch (requestError) {
      setError(errorMessage(requestError, "No se pudo leer el Excel."));
    } finally {
      setBusy(null);
    }
  }

  async function apply() {
    if (!file || !preview) {
      return;
    }

    setError("");
    setBusy("apply");

    try {
      onImported(
        await fetchJson<ImportOutcome>(
          tareasApi.dataImport,
          { method: "POST", body: importBody(file, "apply", duplicates) },
          "No se pudo importar el Excel.",
        ),
      );
    } catch (requestError) {
      setError(errorMessage(requestError, "No se pudo importar el Excel."));
      setBusy(null);
    }
  }

  const existing = preview?.entries.filter((entry) => entry.exists).length ?? 0;

  return (
    <Modal onClose={onClose} title="Importar datos desde Excel">
      {!preview ? (
        <div className="stack tk-import">
          <div className="tk-import-intro">
            <FileSpreadsheet aria-hidden="true" size={22} />
            <p>
              Cada hoja del Excel se convierte en un dato: el título en <b>A1</b>, la descripción en <b>A2</b> y debajo
              el contenido, en texto o en tabla. Si tienes dudas, parte del ejemplo.
            </p>
          </div>
          <a className="button secondary tk-template-link" download href={tareasApi.dataTemplate}>
            <Download size={16} />
            Descargar Excel de ejemplo
          </a>

          <FileDropzone accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="tk-import-drop" id="tk-import-file" onSelect={(selected) => void selectFile(selected)}>
            {busy === "preview" ? <Loader2 className="spin" size={22} /> : <FileUp size={22} />}
            <span>
              <strong>{busy === "preview" ? "Leyendo el Excel…" : "Arrastra aquí tu Excel"}</strong>
              <small>o haz clic para elegirlo (.xlsx)</small>
            </span>
          </FileDropzone>
          <label className="sr-only" htmlFor="tk-import-file">
            Archivo Excel
          </label>

          {error ? <div className="message error">{error}</div> : null}
        </div>
      ) : (
        <div className="stack tk-import">
          <p className="tk-import-file">
            <FileSpreadsheet aria-hidden="true" size={16} />
            {file?.name}
            <span className="muted">
              · {preview.entries.length === 1 ? "1 dato encontrado" : `${preview.entries.length} datos encontrados`}
            </span>
          </p>

          <ul className="tk-import-list">
            {preview.entries.map((entry) => (
              <li key={entry.sheet}>
                <span className="tk-import-entry">
                  <strong>{entry.title}</strong>
                  <small>{entry.description || entry.summary}</small>
                </span>
                <span className="tk-chip">{entry.summary}</span>
                <span className={`tk-import-badge ${entry.exists ? "exists" : ""}`}>{entry.exists ? "Ya existe" : "Nuevo"}</span>
              </li>
            ))}
          </ul>

          {preview.ignored.length ? (
            <small className="muted">Hojas ignoradas: {preview.ignored.join(", ")}.</small>
          ) : null}

          {preview.warnings.map((warning) => (
            <div className="message tk-import-warning" key={warning}>
              <AlertTriangle aria-hidden="true" size={15} /> {warning}
            </div>
          ))}

          {existing ? (
            <fieldset className="tk-source">
              <legend>
                {existing === 1 ? "1 dato ya existe con el mismo título" : `${existing} datos ya existen con el mismo título`}
              </legend>
              <label className="tk-radio">
                <input checked={duplicates === "update"} name="duplicates" onChange={() => setDuplicates("update")} type="radio" />
                Actualizarlos con el contenido del Excel
              </label>
              <label className="tk-radio">
                <input checked={duplicates === "create"} name="duplicates" onChange={() => setDuplicates("create")} type="radio" />
                Mantenerlos y crear otros nuevos
              </label>
            </fieldset>
          ) : null}

          {error ? <div className="message error">{error}</div> : null}

          <div className="tk-dialog-actions">
            <button className="button secondary" disabled={busy !== null} onClick={() => setPreview(null)} type="button">
              Elegir otro archivo
            </button>
            <button className="button" disabled={busy !== null} onClick={() => void apply()} type="button">
              {busy === "apply" ? <Loader2 className="spin" size={16} /> : <Upload size={16} />}
              {preview.entries.length === 1 ? "Importar 1 dato" : `Importar ${preview.entries.length} datos`}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export function importSummary({ created, updated }: ImportOutcome) {
  const parts = [
    created ? (created === 1 ? "1 dato nuevo" : `${created} datos nuevos`) : null,
    updated ? (updated === 1 ? "1 actualizado" : `${updated} actualizados`) : null,
  ].filter(Boolean);
  return `Importación completada: ${parts.join(" y ")}.`;
}
