"use client";

import { ChevronRight, FileText, Loader2, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";

import { errorMessage, fetchJson } from "@/core/ui/api-client";
import { tareasConfig } from "@/modules/tareas/config";
import { searchableText, type DataBlock } from "@/modules/tareas/lib/data-blocks";
import { tareasApi, tareasRoutes } from "@/modules/tareas/module";

export type DataEntrySummary = {
  id: string;
  title: string;
  description: string;
  blocks: DataBlock[];
  updatedAt: string | Date;
};

function formatUpdated(value: string | Date) {
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "medium" }).format(new Date(value));
}

export function DataList({ entries }: { entries: DataEntrySummary[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const index = useMemo(() => entries.map((entry) => ({ entry, text: searchableText(entry) })), [entries]);
  const terms = query.toLocaleLowerCase("es").split(/\s+/).filter(Boolean);
  const visible = index.filter(({ text }) => terms.every((term) => text.includes(term))).map(({ entry }) => entry);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsCreating(true);

    try {
      const created = await fetchJson<{ id: string }>(
        tareasApi.data,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: title.trim(), description }) },
        "No se pudo crear el dato.",
      );
      router.push(tareasRoutes.dataEntry(created.id));
    } catch (requestError) {
      setError(errorMessage(requestError, "No se pudo crear el dato."));
      setIsCreating(false);
    }
  }

  return (
    <div className="grid">
      <section>
        <h2 className="tk-section-title">Datos</h2>
        <p className="muted tk-subtitle">Información de consulta: listados, explicaciones, procedimientos…</p>
      </section>

      {error ? <div className="message error">{error}</div> : null}

      <div className="tk-closings-layout">
        <section className="panel">
          <div className="tk-search">
            <Search aria-hidden="true" size={16} />
            <input
              aria-label="Buscar en los datos"
              className="input"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por título o contenido"
              type="search"
              value={query}
            />
          </div>
          {visible.length > 0 ? (
            <ul className="tk-list">
              {visible.map((entry) => (
                <li className="tk-list-item" key={entry.id}>
                  <span className="tk-list-icon" aria-hidden="true">
                    <FileText size={18} />
                  </span>
                  <Link className="tk-list-link" href={tareasRoutes.dataEntry(entry.id)}>
                    <strong>{entry.title}</strong>
                    <span className="muted tk-list-description">{entry.description || `Actualizado el ${formatUpdated(entry.updatedAt)}`}</span>
                  </Link>
                  <ChevronRight aria-hidden="true" className="tk-list-chevron" size={18} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="panel-body">
              <div className="message">{entries.length ? "Ningún dato coincide con la búsqueda." : "Todavía no hay datos. Crea el primero."}</div>
            </div>
          )}
        </section>

        <section className="panel">
          <div className="panel-header">
            <h2>Nuevo dato</h2>
          </div>
          <form className="panel-body stack" onSubmit={create}>
            <div className="field">
              <label htmlFor="tk-data-title">Título</label>
              <input
                className="input"
                id="tk-data-title"
                maxLength={tareasConfig.limits.nameLength}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Tarjetas BBVA, Dividendo…"
                required
                value={title}
              />
            </div>
            <div className="field">
              <label htmlFor="tk-data-description">Descripción (opcional)</label>
              <input
                className="input"
                id="tk-data-description"
                maxLength={tareasConfig.limits.notesLength}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Listado de las tarjetas y a quién pertenecen"
                value={description}
              />
            </div>
            <button className="button" disabled={isCreating || !title.trim()} type="submit">
              {isCreating ? <Loader2 className="spin" size={16} /> : <Plus size={16} />}
              Crear dato
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
