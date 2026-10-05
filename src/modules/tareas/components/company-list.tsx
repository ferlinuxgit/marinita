"use client";

import { Building2, ChevronRight, Loader2, Plus } from "lucide-react";
import Link from "next/link";
import { FormEvent, useState } from "react";

import { errorMessage, fetchJson } from "@/core/ui/api-client";
import { InlineNameEditor } from "@/modules/tareas/components/inline-name-editor";
import { tareasConfig } from "@/modules/tareas/config";
import { tareasApi, tareasRoutes } from "@/modules/tareas/module";

export type CompanySummary = {
  id: string;
  name: string;
  closings: { id: string; name: string; createdAt: string | Date }[];
};

const jsonHeaders = { "Content-Type": "application/json" };

export function CompanyList({ initialCompanies }: { initialCompanies: CompanySummary[] }) {
  const [companies, setCompanies] = useState(initialCompanies);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  async function addCompany(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsAdding(true);
    const submittedName = name;

    try {
      const company = await fetchJson<CompanySummary>(
        tareasApi.companies,
        { method: "POST", headers: jsonHeaders, body: JSON.stringify({ name: submittedName.trim() }) },
        "No se pudo crear la empresa.",
      );
      setCompanies((current) => [...current, company].sort((a, b) => a.name.localeCompare(b.name, "es")));
      // Keep anything typed while the request was in flight.
      setName((current) => (current === submittedName ? "" : current));
    } catch (requestError) {
      setError(errorMessage(requestError, "No se pudo crear la empresa."));
    } finally {
      setIsAdding(false);
    }
  }

  async function rename(companyId: string, newName: string) {
    setError("");

    try {
      await fetchJson(
        tareasApi.company(companyId),
        { method: "PATCH", headers: jsonHeaders, body: JSON.stringify({ name: newName }) },
        "No se pudo cambiar el nombre.",
      );
      setCompanies((current) => current.map((company) => (company.id === companyId ? { ...company, name: newName } : company)));
    } catch (requestError) {
      setError(errorMessage(requestError, "No se pudo cambiar el nombre."));
      throw requestError;
    }
  }

  return (
    <div className="grid">
      <section>
        <h2 className="tk-section-title">Empresas</h2>
        <p className="muted">Elige una empresa para ver y preparar sus cierres.</p>
      </section>

      {error ? <div className="message error">{error}</div> : null}

      <section className="panel">
        {companies.length > 0 ? (
          <ul className="tk-list">
            {companies.map((company) => (
              <li className="tk-list-item" key={company.id}>
                <span className="tk-list-icon" aria-hidden="true">
                  <Building2 size={18} />
                </span>
                <InlineNameEditor label="nombre de la empresa" onSave={(newName) => rename(company.id, newName)} value={company.name}>
                  <Link className="tk-list-link" href={tareasRoutes.company(company.id)}>
                    <strong>{company.name}</strong>
                    <span className="muted">
                      {company.closings.length === 1 ? "1 cierre" : `${company.closings.length} cierres`}
                    </span>
                  </Link>
                </InlineNameEditor>
                <Link aria-label={`Abrir ${company.name}`} className="tk-list-chevron" href={tareasRoutes.company(company.id)}>
                  <ChevronRight size={18} />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="panel-body">
            <div className="message">Todavía no hay empresas. Añade la primera para crear sus cierres.</div>
          </div>
        )}

        <form className="tk-add-form" onSubmit={addCompany}>
          <input
            aria-label="Nombre de la nueva empresa"
            className="input"
            maxLength={tareasConfig.limits.nameLength}
            onChange={(event) => setName(event.target.value)}
            placeholder="Nombre de la nueva empresa"
            required
            value={name}
          />
          <button className="button" disabled={isAdding || !name.trim()} type="submit">
            {isAdding ? <Loader2 className="spin" size={16} /> : <Plus size={16} />}
            Añadir empresa
          </button>
        </form>
      </section>
    </div>
  );
}
