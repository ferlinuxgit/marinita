"use client";

import { AlignLeft, CheckCircle2, Download, FileText, Plus, Search, Table2, Upload } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { DataImportDialog, importSummary } from "@/modules/tareas/components/data-import-dialog";
import { NewDataDialog } from "@/modules/tareas/components/new-data-dialog";
import { contentPreview, contentSummary, searchableText, type DataBlock } from "@/modules/tareas/lib/data-blocks";
import { tareasApi, tareasRoutes } from "@/modules/tareas/module";

export type DataEntrySummary = {
  id: string;
  title: string;
  description: string;
  blocks: DataBlock[];
  updatedAt: string | Date;
};

const EXAMPLES = ["Tarjetas BBVA", "Cómo contabilizar el dividendo", "Cuentas bancarias", "Contactos de la gestoría"];

function formatUpdated(value: string | Date) {
  return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}

function EntryIcon({ blocks }: { blocks: DataBlock[] }) {
  const first = blocks[0]?.type;
  const Icon = first === "table" ? Table2 : first === "text" ? AlignLeft : FileText;
  return <Icon size={18} />;
}

export function DataList({ entries }: { entries: DataEntrySummary[] }) {
  const [query, setQuery] = useState("");
  const router = useRouter();
  const [creating, setCreating] = useState<{ title: string } | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [notice, setNotice] = useState("");

  const index = useMemo(() => entries.map((entry) => ({ entry, text: searchableText(entry) })), [entries]);
  const terms = query.toLocaleLowerCase("es").split(/\s+/).filter(Boolean);
  const visible = index.filter(({ text }) => terms.every((term) => text.includes(term))).map(({ entry }) => entry);

  return (
    <div className="grid">
      <div className="tk-data-header">
        <div>
          <h2 className="tk-section-title">Datos</h2>
          <p className="muted tk-subtitle">Información que consultas a menudo: listados, explicaciones, procedimientos…</p>
        </div>
        <div className="tk-data-actions">
          <button className="button secondary" onClick={() => setIsImporting(true)} type="button">
            <Upload size={16} />
            Importar
          </button>
          {entries.length ? (
            <a className="button secondary" download href={tareasApi.dataExportAll}>
              <Download size={16} />
              Exportar Excel
            </a>
          ) : null}
          <button className="button" onClick={() => setCreating({ title: "" })} type="button">
            <Plus size={16} />
            Nuevo dato
          </button>
        </div>
      </div>

      {notice ? (
        <div className="message ok tk-import-notice" role="status">
          <CheckCircle2 aria-hidden="true" size={16} /> {notice}
        </div>
      ) : null}

      {entries.length === 0 ? (
        <section className="panel tk-data-empty">
          <span className="tk-data-empty-icon" aria-hidden="true">
            <FileText size={28} />
          </span>
          <h3>Guarda aquí lo que siempre tienes que buscar</h3>
          <p className="muted">Cada dato es una ficha con un título y el contenido que quieras: un texto, una tabla o ambos.</p>
          <div className="tk-column-chips tk-examples">
            {EXAMPLES.map((example) => (
              <button className="tk-chip tk-chip-button" key={example} onClick={() => setCreating({ title: example })} type="button">
                {example}
              </button>
            ))}
          </div>
          <div className="tk-data-empty-actions">
            <button className="button" onClick={() => setCreating({ title: "" })} type="button">
              <Plus size={16} />
              Crear el primer dato
            </button>
            <button className="button secondary" onClick={() => setIsImporting(true)} type="button">
              <Upload size={16} />
              Importar desde Excel
            </button>
          </div>
        </section>
      ) : (
        <>
          <label className="tk-search tk-search-box">
            <Search aria-hidden="true" size={17} />
            <input
              aria-label="Buscar en los datos"
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`Buscar en ${entries.length === 1 ? "1 dato" : `${entries.length} datos`} (título o contenido)`}
              type="search"
              value={query}
            />
          </label>

          {visible.length ? (
            <ul className="tk-data-grid">
              {visible.map((entry) => {
                const preview = contentPreview(entry.blocks);

                return (
                  <li key={entry.id}>
                    <Link className="tk-data-card" href={tareasRoutes.dataEntry(entry.id)}>
                      <span className="tk-data-card-head">
                        <span className="tk-data-card-icon" aria-hidden="true">
                          <EntryIcon blocks={entry.blocks} />
                        </span>
                        <strong>{entry.title}</strong>
                      </span>
                      {entry.description ? <span className="tk-data-card-description">{entry.description}</span> : null}
                      {preview ? <span className="tk-data-card-preview">{preview}</span> : null}
                      <span className="tk-data-card-foot">
                        <span className="tk-chip">{contentSummary(entry.blocks)}</span>
                        <span>{formatUpdated(entry.updatedAt)}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="message">Ningún dato coincide con «{query}».</div>
          )}
        </>
      )}

      {isImporting ? (
        <DataImportDialog
          onClose={() => setIsImporting(false)}
          onImported={(outcome) => {
            setIsImporting(false);
            setNotice(importSummary(outcome));
            router.refresh();
          }}
        />
      ) : null}

      {creating ? <NewDataDialog initialTitle={creating.title} onClose={() => setCreating(null)} /> : null}
    </div>
  );
}
