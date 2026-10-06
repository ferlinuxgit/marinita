"use client";

import { AlignLeft, ArrowDown, ArrowUp, ChevronRight, ClipboardPaste, Download, Plus, Table2, Trash2, X } from "lucide-react";
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
  DATA_LIMITS,
  newTableBlock,
  newTextBlock,
  parseClipboardGrid,
  pasteIntoTable,
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

/** Text or table cells, ignoring column names (a new table may already have them). */
function hasBodyContent(block: DataBlock) {
  return block.type === "text" ? block.text.trim() !== "" : block.rows.flat().some((cell) => cell.trim());
}

function hasContent(block: DataBlock) {
  return block.type === "text" ? block.text.trim() !== "" : [...block.columns, ...block.rows.flat()].some((cell) => cell.trim());
}

export function DataEntryEditor({ entry }: DataEntryEditorProps) {
  const router = useRouter();
  const [doc, setDoc] = useState<EntryDoc>({ title: entry.title, description: entry.description, blocks: entry.blocks });
  // A sheet just created from the dialog has empty blocks: start typing in the first one.
  const [focusBlockId, setFocusBlockId] = useState<string | null>(() =>
    entry.blocks.length && !entry.blocks.some(hasBodyContent) ? entry.blocks[0].id : null,
  );
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
    <div className="grid tk-data-page">
      <nav className="tk-breadcrumb" aria-label="Ruta">
        <Link href={tareasRoutes.data}>Datos</Link>
        <ChevronRight size={14} />
        <span>{doc.title || "Sin título"}</span>
      </nav>

      <section className="tk-data-hero">
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
          placeholder="Añade una descripción breve (opcional)"
          value={doc.description}
        />
        {!doc.title.trim() ? <span className="message error">El título es obligatorio para guardar.</span> : null}
        <div className="tk-data-hero-actions">
          <SaveStatus error={error} hasSaved={hasSaved} isSaving={isSaving} />
          <a className="button secondary" download href={tareasApi.dataExport(entry.id)} onClick={() => flush("doc")}>
            <Download size={16} />
            Exportar Excel
          </a>
          <button className="button secondary tk-delete" onClick={deleteEntry} type="button">
            <Trash2 size={16} />
            Eliminar
          </button>
        </div>
      </section>

      <SaveErrorBanner error={error} />

      {doc.blocks.map((block, index) => (
        <section className="panel tk-block" key={block.id}>
          <div className="tk-block-toolbar">
            <span className="tk-block-type">
              {block.type === "text" ? <AlignLeft size={14} /> : <Table2 size={14} />}
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
              placeholder="Escribe aquí la explicación, los pasos a seguir, notas…"
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

      <div className={`tk-block-add ${doc.blocks.length === 0 ? "empty" : ""}`}>
        <span>{doc.blocks.length === 0 ? "Empieza añadiendo contenido:" : "Añadir"}</span>
        <button className="tk-add-choice" onClick={() => addBlock("text")} type="button">
          <AlignLeft size={18} />
          <span>
            <strong>Texto</strong>
            <small>Explicaciones y notas</small>
          </span>
        </button>
        <button className="tk-add-choice" onClick={() => addBlock("table")} type="button">
          <Table2 size={18} />
          <span>
            <strong>Tabla</strong>
            <small>Listados con columnas</small>
          </span>
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
  // New tables start on the header; tables created with column names start on the first cell.
  const focusHeader = autoFocus && !table.columns[0];

  /** Pasting several cells copied from Excel fills the table from that cell. */
  function onPaste(event: React.ClipboardEvent<HTMLTextAreaElement>, row: number, column: number) {
    const grid = parseClipboardGrid(event.clipboardData.getData("text/plain"));

    if (grid) {
      event.preventDefault();
      onChange((current) => pasteIntoTable(current, row, column, grid), true);
    }
  }

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
                      autoFocus={focusHeader && columnIndex === 0}
                      className="tk-cell-input"
                      onBlur={onBlur}
                      onChange={(event) => onChange((current) => setTableHeader(current, columnIndex, event.target.value.replace(/\n/g, " ")))}
                      onPaste={(event) => onPaste(event, -1, columnIndex)}
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
              <th className="tk-data-actions-col">
                {table.columns.length < DATA_LIMITS.columns ? (
                  <button
                    aria-label="Añadir columna"
                    className="tk-row-button tk-add-column"
                    onClick={() => onChange(addTableColumn, true)}
                    title="Añadir columna"
                    type="button"
                  >
                    <Plus size={15} />
                  </button>
                ) : null}
              </th>
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, columnIndex) => (
                  <td key={columnIndex}>
                    <AutoTextarea
                      aria-label={`Fila ${rowIndex + 1}, ${table.columns[columnIndex] || `columna ${columnIndex + 1}`}`}
                      autoFocus={autoFocus && !focusHeader && rowIndex === 0 && columnIndex === 0}
                      className="tk-cell-input"
                      onBlur={onBlur}
                      onChange={(event) => onChange((current) => setTableCell(current, rowIndex, columnIndex, event.target.value))}
                      onPaste={(event) => onPaste(event, rowIndex, columnIndex)}
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
        <button className="tk-add-row" onClick={() => onChange(addTableRow, true)} type="button">
          <Plus size={15} /> Añadir fila
        </button>
        <span className="tk-paste-hint">
          <ClipboardPaste aria-hidden="true" size={13} />
          Puedes pegar celdas copiadas de Excel
        </span>
      </div>
    </>
  );
}
