"use client";

import { ArrowDown, ArrowUp, ChevronRight, Columns3, Plus, Rows3, Table2, Trash2, Type, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { errorMessage, fetchJson } from "@/core/ui/api-client";
import { AutoTextarea } from "@/modules/tareas/components/auto-textarea";
import { SaveErrorBanner, SaveStatus } from "@/modules/tareas/components/save-status";
import { useSaveQueue } from "@/modules/tareas/components/use-save-queue";
import { tareasConfig } from "@/modules/tareas/config";
import {
  addTableColumn,
  addTableRow,
  newTableBlock,
  newTextBlock,
  removeTableColumn,
  removeTableRow,
  setTableCell,
  setTableHeader,
  type DataBlock,
  type TableBlock,
} from "@/modules/tareas/lib/data-blocks";
import { tareasApi, tareasRoutes } from "@/modules/tareas/module";

type EntryDoc = { title: string; description: string; blocks: DataBlock[] };

type DataEntryEditorProps = {
  entry: EntryDoc & { id: string };
};

function hasContent(block: DataBlock) {
  return block.type === "text" ? block.text.trim() !== "" : [...block.columns, ...block.rows.flat()].some((cell) => cell.trim());
}

export function DataEntryEditor({ entry }: DataEntryEditorProps) {
  const router = useRouter();
  const [doc, setDoc] = useState<EntryDoc>({ title: entry.title, description: entry.description, blocks: entry.blocks });
  const [focusBlockId, setFocusBlockId] = useState<string | null>(null);
  const { enqueue, schedule, flush, isSaving, hasSaved, error, setError } = useSaveQueue();

  /** Applies a change and schedules saving the whole sheet (the latest version wins). */
  function change(next: EntryDoc, immediate = false) {
    setDoc(next);

    if (!next.title.trim()) {
      return;
    }

    schedule("doc", () =>
      void enqueue(() =>
        fetchJson(
          tareasApi.dataEntry(entry.id),
          { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...next, title: next.title.trim() }) },
          "No se pudo guardar el dato.",
        ),
      ),
    );

    if (immediate) {
      flush("doc");
    }
  }

  function updateBlock(id: string, update: (block: DataBlock) => DataBlock, immediate = false) {
    change({ ...doc, blocks: doc.blocks.map((block) => (block.id === id ? update(block) : block)) }, immediate);
  }

  function updateTable(id: string, update: (table: TableBlock) => TableBlock, immediate = false) {
    updateBlock(id, (block) => (block.type === "table" ? update(block) : block), immediate);
  }

  function addBlock(type: DataBlock["type"]) {
    const block = type === "text" ? newTextBlock(crypto.randomUUID()) : newTableBlock(crypto.randomUUID());
    change({ ...doc, blocks: [...doc.blocks, block] }, true);
    setFocusBlockId(block.id);
  }

  function moveBlock(index: number, direction: -1 | 1) {
    const target = index + direction;
    const blocks = [...doc.blocks];
    [blocks[index], blocks[target]] = [blocks[target], blocks[index]];
    change({ ...doc, blocks }, true);
  }

  function removeBlock(block: DataBlock) {
    if (hasContent(block) && !window.confirm(block.type === "text" ? "¿Eliminar este texto?" : "¿Eliminar esta tabla?")) {
      return;
    }

    change({ ...doc, blocks: doc.blocks.filter((item) => item.id !== block.id) }, true);
  }

  async function deleteEntry() {
    if (!window.confirm(`¿Eliminar «${doc.title}» y todo su contenido? No se puede deshacer.`)) {
      return;
    }

    try {
      await fetchJson(tareasApi.dataEntry(entry.id), { method: "DELETE" }, "No se pudo eliminar el dato.");
      router.push(tareasRoutes.data);
      router.refresh();
    } catch (requestError) {
      setError(errorMessage(requestError, "No se pudo eliminar el dato."));
    }
  }

  return (
    <div className="grid">
      <nav className="tk-breadcrumb" aria-label="Ruta">
        <Link href={tareasRoutes.data}>Datos</Link>
        <ChevronRight size={14} />
        <span>{doc.title || "Sin título"}</span>
      </nav>

      <div className="tk-checklist-header">
        <div className="tk-data-heading">
          <input
            aria-label="Título"
            className="tk-cell-input tk-data-title"
            maxLength={tareasConfig.limits.nameLength}
            onBlur={() => flush("doc")}
            onChange={(event) => change({ ...doc, title: event.target.value })}
            placeholder="Título"
            value={doc.title}
          />
          <input
            aria-label="Descripción"
            className="tk-cell-input tk-data-description"
            maxLength={tareasConfig.limits.notesLength}
            onBlur={() => flush("doc")}
            onChange={(event) => change({ ...doc, description: event.target.value })}
            placeholder="Descripción breve (opcional)"
            value={doc.description}
          />
          {!doc.title.trim() ? <span className="message error">El título es obligatorio para guardar.</span> : null}
        </div>
        <div className="tk-checklist-meta">
          <SaveStatus error={error} hasSaved={hasSaved} isSaving={isSaving} />
          <button className="button secondary tk-delete" onClick={deleteEntry} type="button">
            <Trash2 size={16} />
            Eliminar
          </button>
        </div>
      </div>

      <SaveErrorBanner error={error} />

      {doc.blocks.length === 0 ? (
        <div className="message">Añade texto o una tabla para empezar.</div>
      ) : null}

      {doc.blocks.map((block, index) => (
        <section className="panel tk-block" key={block.id}>
          <div className="tk-block-toolbar">
            <span className="tk-block-type">
              {block.type === "text" ? <Type size={14} /> : <Table2 size={14} />}
              {block.type === "text" ? "Texto" : "Tabla"}
            </span>
            <div className="tk-row-actions">
              <button aria-label="Subir bloque" className="tk-row-button" disabled={index === 0} onClick={() => moveBlock(index, -1)} title="Subir" type="button">
                <ArrowUp size={14} />
              </button>
              <button
                aria-label="Bajar bloque"
                className="tk-row-button"
                disabled={index === doc.blocks.length - 1}
                onClick={() => moveBlock(index, 1)}
                title="Bajar"
                type="button"
              >
                <ArrowDown size={14} />
              </button>
              <button aria-label="Eliminar bloque" className="tk-row-button danger" onClick={() => removeBlock(block)} title="Eliminar bloque" type="button">
                <Trash2 size={14} />
              </button>
            </div>
          </div>

          {block.type === "text" ? (
            <AutoTextarea
              aria-label="Texto"
              autoFocus={focusBlockId === block.id}
              className="tk-cell-input tk-data-text"
              onBlur={() => flush("doc")}
              onChange={(event) => updateBlock(block.id, (current) => ({ ...current, text: event.target.value }))}
              placeholder="Escribe aquí…"
              value={block.text}
            />
          ) : (
            <TableEditor
              autoFocus={focusBlockId === block.id}
              onBlur={() => flush("doc")}
              onChange={(update, immediate) => updateTable(block.id, update, immediate)}
              table={block}
            />
          )}
        </section>
      ))}

      <div className="tk-block-add">
        <button className="button secondary" onClick={() => addBlock("text")} type="button">
          <Plus size={16} />
          <Type size={16} />
          Texto
        </button>
        <button className="button secondary" onClick={() => addBlock("table")} type="button">
          <Plus size={16} />
          <Table2 size={16} />
          Tabla
        </button>
      </div>
    </div>
  );
}

type TableEditorProps = {
  table: TableBlock;
  autoFocus: boolean;
  onChange: (update: (table: TableBlock) => TableBlock, immediate?: boolean) => void;
  onBlur: () => void;
};

function TableEditor({ table, autoFocus, onChange, onBlur }: TableEditorProps) {
  return (
    <>
      <div className="table-wrap">
        <table className="tk-data-table">
          <thead>
            <tr>
              {table.columns.map((column, columnIndex) => (
                <th key={columnIndex}>
                  <div className="tk-cell">
                    <AutoTextarea
                      aria-label={`Columna ${columnIndex + 1}`}
                      autoFocus={autoFocus && columnIndex === 0}
                      className="tk-cell-input"
                      onBlur={onBlur}
                      onChange={(event) => onChange((current) => setTableHeader(current, columnIndex, event.target.value.replace(/\n/g, " ")))}
                      placeholder={`Columna ${columnIndex + 1}`}
                      singleLine
                      value={column}
                    />
                    {table.columns.length > 1 ? (
                      <button
                        aria-label={`Eliminar columna ${column || columnIndex + 1}`}
                        className="tk-row-button danger"
                        onClick={() => {
                          const hasData = table.rows.some((row) => row[columnIndex]?.trim());

                          if (!hasData || window.confirm(`¿Eliminar la columna «${column || columnIndex + 1}» y sus datos?`)) {
                            onChange((current) => removeTableColumn(current, columnIndex), true);
                          }
                        }}
                        title="Eliminar columna"
                        type="button"
                      >
                        <X size={13} />
                      </button>
                    ) : null}
                  </div>
                </th>
              ))}
              <th aria-hidden="true" className="tk-data-actions-col" />
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, columnIndex) => (
                  <td key={columnIndex}>
                    <AutoTextarea
                      aria-label={`Fila ${rowIndex + 1}, ${table.columns[columnIndex] || `columna ${columnIndex + 1}`}`}
                      className="tk-cell-input"
                      onBlur={onBlur}
                      onChange={(event) => onChange((current) => setTableCell(current, rowIndex, columnIndex, event.target.value))}
                      value={cell}
                    />
                  </td>
                ))}
                <td className="tk-data-actions-col">
                  <button
                    aria-label={`Eliminar fila ${rowIndex + 1}`}
                    className="tk-row-button danger"
                    onClick={() => onChange((current) => removeTableRow(current, rowIndex), true)}
                    title="Eliminar fila"
                    type="button"
                  >
                    <Trash2 size={13} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="tk-block-footer">
        <button className="tk-link-button" onClick={() => onChange(addTableRow, true)} type="button">
          <Rows3 size={14} /> Añadir fila
        </button>
        <button className="tk-link-button" onClick={() => onChange(addTableColumn, true)} type="button">
          <Columns3 size={14} /> Añadir columna
        </button>
      </div>
    </>
  );
}
