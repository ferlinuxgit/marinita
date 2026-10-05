"use client";

import { ChevronRight, ClipboardList, Loader2, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { errorMessage, fetchJson } from "@/core/ui/api-client";
import type { CompanySummary } from "@/modules/tareas/components/company-list";
import { InlineNameEditor } from "@/modules/tareas/components/inline-name-editor";
import { tareasConfig } from "@/modules/tareas/config";
import { tareasApi, tareasRoutes } from "@/modules/tareas/module";

type Source = "empty" | "same" | "other";

type CompanyClosingsProps = {
  company: CompanySummary;
  /** Every company of the user, to copy a checklist from another one. */
  companies: CompanySummary[];
};

const jsonHeaders = { "Content-Type": "application/json" };

function formatCreated(value: string | Date) {
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "medium" }).format(new Date(value));
}

export function CompanyClosings({ company, companies }: CompanyClosingsProps) {
  const router = useRouter();
  const [companyName, setCompanyName] = useState(company.name);
  const [name, setName] = useState("");
  const [source, setSource] = useState<Source>("empty");
  const [sameSourceId, setSameSourceId] = useState(company.closings[0]?.id ?? "");
  const otherCompanies = companies.filter((item) => item.id !== company.id && item.closings.length > 0);
  const [otherSourceId, setOtherSourceId] = useState(otherCompanies[0]?.closings[0]?.id ?? "");
  const [error, setError] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  async function rename(newName: string) {
    setError("");

    try {
      await fetchJson(
        tareasApi.company(company.id),
        { method: "PATCH", headers: jsonHeaders, body: JSON.stringify({ name: newName }) },
        "No se pudo cambiar el nombre.",
      );
      setCompanyName(newName);
    } catch (requestError) {
      setError(errorMessage(requestError, "No se pudo cambiar el nombre."));
      throw requestError;
    }
  }

  async function createClosing(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsCreating(true);
    const sourceClosingId = source === "same" ? sameSourceId : source === "other" ? otherSourceId : null;

    try {
      const closing = await fetchJson<{ id: string }>(
        tareasApi.companyClosings(company.id),
        { method: "POST", headers: jsonHeaders, body: JSON.stringify({ name: name.trim(), sourceClosingId: sourceClosingId || null }) },
        "No se pudo crear el cierre.",
      );
      router.push(tareasRoutes.closing(company.id, closing.id));
    } catch (requestError) {
      setError(errorMessage(requestError, "No se pudo crear el cierre."));
      setIsCreating(false);
    }
  }

  return (
    <div className="grid">
      <nav className="tk-breadcrumb" aria-label="Ruta">
        <Link href={tareasRoutes.closings}>Empresas</Link>
        <ChevronRight size={14} />
        <span>{companyName}</span>
      </nav>

      <InlineNameEditor label="nombre de la empresa" onSave={rename} value={companyName}>
        <h2 className="tk-section-title">{companyName}</h2>
      </InlineNameEditor>

      {error ? <div className="message error">{error}</div> : null}

      <div className="tk-closings-layout">
        <section className="panel">
          <div className="panel-header">
            <h2>Cierres</h2>
          </div>
          {company.closings.length > 0 ? (
            <ul className="tk-list">
              {company.closings.map((closing) => (
                <li className="tk-list-item" key={closing.id}>
                  <span className="tk-list-icon" aria-hidden="true">
                    <ClipboardList size={18} />
                  </span>
                  <Link className="tk-list-link" href={tareasRoutes.closing(company.id, closing.id)}>
                    <strong>{closing.name}</strong>
                    <span className="muted">Creado el {formatCreated(closing.createdAt)}</span>
                  </Link>
                  <ChevronRight aria-hidden="true" className="tk-list-chevron" size={18} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="panel-body">
              <div className="message">Esta empresa todavía no tiene cierres.</div>
            </div>
          )}
        </section>

        <section className="panel">
          <div className="panel-header">
            <h2>Nuevo cierre</h2>
          </div>
          <form className="panel-body stack" onSubmit={createClosing}>
            <div className="field">
              <label htmlFor="tk-closing-name">Nombre o periodo</label>
              <input
                className="input"
                id="tk-closing-name"
                maxLength={tareasConfig.limits.nameLength}
                onChange={(event) => setName(event.target.value)}
                placeholder="Septiembre 2026, Tercer trimestre 2026…"
                required
                value={name}
              />
            </div>

            <fieldset className="tk-source">
              <legend>Checklist inicial</legend>
              <label className="tk-radio">
                <input checked={source === "empty"} name="source" onChange={() => setSource("empty")} type="radio" />
                Vacío
              </label>

              <label className={`tk-radio ${company.closings.length === 0 ? "disabled" : ""}`}>
                <input
                  checked={source === "same"}
                  disabled={company.closings.length === 0}
                  name="source"
                  onChange={() => setSource("same")}
                  type="radio"
                />
                Copiar un cierre anterior de esta empresa
              </label>
              {source === "same" ? (
                <select aria-label="Cierre a copiar" className="input" onChange={(event) => setSameSourceId(event.target.value)} value={sameSourceId}>
                  {company.closings.map((closing) => (
                    <option key={closing.id} value={closing.id}>
                      {closing.name}
                    </option>
                  ))}
                </select>
              ) : null}

              <label className={`tk-radio ${otherCompanies.length === 0 ? "disabled" : ""}`}>
                <input
                  checked={source === "other"}
                  disabled={otherCompanies.length === 0}
                  name="source"
                  onChange={() => setSource("other")}
                  type="radio"
                />
                Copiar el checklist de otra empresa
              </label>
              {source === "other" ? (
                <select aria-label="Checklist a copiar" className="input" onChange={(event) => setOtherSourceId(event.target.value)} value={otherSourceId}>
                  {otherCompanies.map((other) => (
                    <optgroup key={other.id} label={other.name}>
                      {other.closings.map((closing) => (
                        <option key={closing.id} value={closing.id}>
                          {closing.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              ) : null}
              {source !== "empty" ? (
                <small className="muted">Se copian las tareas y subtareas en el mismo orden, sin marcar y sin observaciones.</small>
              ) : null}
            </fieldset>

            <button className="button" disabled={isCreating || !name.trim()} type="submit">
              {isCreating ? <Loader2 className="spin" size={16} /> : <Plus size={16} />}
              Crear cierre
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
