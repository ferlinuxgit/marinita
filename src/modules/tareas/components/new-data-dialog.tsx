"use client";

import { AlignLeft, Check, LayoutList, Loader2, Table2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { errorMessage, fetchJson } from "@/core/ui/api-client";
import { Modal } from "@/core/ui/modal";
import { tareasConfig } from "@/modules/tareas/config";
import { newTableBlock, newTextBlock, parseColumnList, type DataBlock } from "@/modules/tareas/lib/data-blocks";
import { tareasApi, tareasRoutes } from "@/modules/tareas/module";

type Layout = "table" | "text" | "both";

const LAYOUTS: { value: Layout; label: string; hint: string; icon: typeof Table2 }[] = [
  { value: "table", label: "Tabla", hint: "Listados: tarjetas, cuentas, contactos…", icon: Table2 },
  { value: "text", label: "Texto", hint: "Explicaciones y procedimientos", icon: AlignLeft },
  { value: "both", label: "Texto y tabla", hint: "Una explicación con su listado", icon: LayoutList },
];

export function NewDataDialog({ onClose, initialTitle = "" }: { onClose: () => void; initialTitle?: string }) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState("");
  const [layout, setLayout] = useState<Layout>("table");
  const [columnsText, setColumnsText] = useState("");
  const [error, setError] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const columns = parseColumnList(columnsText);
  const withTable = layout !== "text";

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!title.trim()) {
      setError("Ponle un título.");
      return;
    }

    const blocks: DataBlock[] = [];

    if (layout !== "table") {
      blocks.push(newTextBlock(crypto.randomUUID()));
    }

    if (withTable) {
      blocks.push(newTableBlock(crypto.randomUUID(), columns.length ? columns : ["", ""]));
    }

    setError("");
    setIsCreating(true);

    try {
      const created = await fetchJson<{ id: string }>(
        tareasApi.data,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: title.trim(), description: description.trim(), blocks }),
        },
        "No se pudo crear el dato.",
      );
      router.push(tareasRoutes.dataEntry(created.id));
    } catch (requestError) {
      setError(errorMessage(requestError, "No se pudo crear el dato."));
      setIsCreating(false);
    }
  }

  return (
    <Modal onClose={onClose} title="Nuevo dato">
      <form className="stack tk-new-data" onSubmit={create}>
        <div className="field">
          <label htmlFor="tk-new-data-title">Título</label>
          <input
            className="input tk-new-data-title"
            data-autofocus
            id="tk-new-data-title"
            maxLength={tareasConfig.limits.nameLength}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Ej.: Tarjetas BBVA"
            value={title}
          />
        </div>

        <div className="field">
          <label htmlFor="tk-new-data-description">Descripción <span className="tk-optional">(opcional)</span></label>
          <input
            className="input"
            id="tk-new-data-description"
            maxLength={tareasConfig.limits.notesLength}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Ej.: Listado de las tarjetas y a quién pertenecen"
            value={description}
          />
        </div>

        <fieldset className="tk-layouts">
          <legend>¿Qué vas a guardar?</legend>
          <div className="tk-layout-options">
            {LAYOUTS.map((option) => {
              const Icon = option.icon;

              return (
                <label className={`tk-layout-option ${layout === option.value ? "selected" : ""}`} key={option.value}>
                  <input
                    checked={layout === option.value}
                    className="sr-only"
                    name="layout"
                    onChange={() => setLayout(option.value)}
                    type="radio"
                  />
                  <span className="tk-layout-icon" aria-hidden="true">
                    <Icon size={20} />
                  </span>
                  <strong>{option.label}</strong>
                  <span>{option.hint}</span>
                  {layout === option.value ? <Check aria-hidden="true" className="tk-layout-check" size={16} /> : null}
                </label>
              );
            })}
          </div>
        </fieldset>

        {withTable ? (
          <div className="field">
            <label htmlFor="tk-new-data-columns">
              Columnas de la tabla <span className="tk-optional">(opcional)</span>
            </label>
            <input
              className="input"
              id="tk-new-data-columns"
              onChange={(event) => setColumnsText(event.target.value)}
              placeholder="Ej.: Tarjeta, Titular, Límite"
              value={columnsText}
            />
            {columns.length ? (
              <div className="tk-column-chips" aria-label="Columnas">
                {columns.map((column, index) => (
                  <span className="tk-chip" key={`${column}-${index}`}>
                    {column}
                  </span>
                ))}
              </div>
            ) : (
              <small className="muted">Sepáralas con comas. También puedes pegar una tabla de Excel después.</small>
            )}
          </div>
        ) : null}

        {error ? <div className="message error">{error}</div> : null}

        <div className="tk-dialog-actions">
          <button className="button secondary" onClick={onClose} type="button">
            Cancelar
          </button>
          <button className="button" disabled={isCreating} type="submit">
            {isCreating ? <Loader2 className="spin" size={16} /> : <Check size={16} />}
            Crear
          </button>
        </div>
      </form>
    </Modal>
  );
}
