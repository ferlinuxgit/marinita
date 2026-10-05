"use client";

import { ArrowDown, ArrowUp, ChevronRight, ListFilter, ListPlus, Loader2, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

import { errorMessage, fetchJson } from "@/core/ui/api-client";
import { AutoTextarea } from "@/modules/tareas/components/auto-textarea";
import { InlineNameEditor } from "@/modules/tareas/components/inline-name-editor";
import { SaveErrorBanner, SaveStatus } from "@/modules/tareas/components/save-status";
import { useSaveQueue } from "@/modules/tareas/components/use-save-queue";
import { tareasConfig } from "@/modules/tareas/config";
import { buildChecklist, countProgress, type ChecklistItem, type ChecklistTask } from "@/modules/tareas/lib/checklist";
import { tareasApi, tareasRoutes } from "@/modules/tareas/module";

type ChecklistEditorProps = {
  company: { id: string; name: string };
  closing: { id: string; name: string };
  initialItems: ChecklistItem[];
};

type TextField = "name" | "notes";

const jsonHeaders = { "Content-Type": "application/json" };

export function ChecklistEditor({ company, closing, initialItems }: ChecklistEditorProps) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [closingName, setClosingName] = useState(closing.name);
  const { enqueue, schedule, flush: flushTimer, cancel, isSaving, hasSaved, error: saveError, setError: setSaveError } = useSaveQueue();
  const [focusId, setFocusId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [onlyPending, setOnlyPending] = useState(false);

  const tasks = useMemo(() => buildChecklist(items), [items]);
  const progress = countProgress(tasks);
  // "Solo pendientes": hide ticked rows; a grouping stays while it has pending subtasks.
  const shownTasks = onlyPending
    ? tasks.flatMap((task) => {
        if (task.subtasks.length === 0) {
          return task.done ? [] : [task];
        }

        const pendingSubtasks = task.subtasks.filter((subtask) => !subtask.done);
        return pendingSubtasks.length ? [{ ...task, subtasks: pendingSubtasks }] : [];
      })
    : tasks;

  const patchItem = useCallback(
    (itemId: string, values: Partial<Pick<ChecklistItem, "name" | "done" | "notes">>) =>
      enqueue(() =>
        fetchJson(
          tareasApi.closingItem(closing.id, itemId),
          { method: "PATCH", headers: jsonHeaders, body: JSON.stringify(values) },
          "No se pudo guardar el cambio.",
        ),
      ),
    [closing.id, enqueue],
  );

  function editText(itemId: string, field: TextField, value: string) {
    setItems((current) => current.map((item) => (item.id === itemId ? { ...item, [field]: value } : item)));
    schedule(`${itemId}:${field}`, () => void patchItem(itemId, { [field]: value }));
  }

  function toggleDone(item: ChecklistItem) {
    const done = !item.done;
    setItems((current) => current.map((row) => (row.id === item.id ? { ...row, done } : row)));
    void patchItem(item.id, { done });
  }

  async function addItem(parent: ChecklistTask | null) {
    if (parent) {
      // Queue the parent's pending text first: the server moves its notes to the first subtask.
      flushTimer(`${parent.id}:name`);
      flushTimer(`${parent.id}:notes`);
    }

    setIsAdding(true);
    const created = await enqueue(() =>
      fetchJson<ChecklistItem>(
        tareasApi.closingItems(closing.id),
        { method: "POST", headers: jsonHeaders, body: JSON.stringify({ parentId: parent?.id ?? null, name: "" }) },
        "No se pudo añadir la fila.",
      ),
    );
    setIsAdding(false);

    if (!created) {
      return;
    }

    setItems((current) => {
      // Mirrors the server: when a task gets its first subtask, its notes move to that subtask.
      const isFirstSubtask = parent && parent.subtasks.length === 0;
      const updated = isFirstSubtask
        ? current.map((item) => (item.id === parent.id ? { ...item, done: false, notes: "" } : item))
        : current;
      return [...updated, created];
    });
    setFocusId(created.id);
  }

  function removeItem(item: ChecklistItem, subtaskCount: number) {
    const label = item.name.trim() ? `«${item.name.trim()}»` : "esta fila";
    const extra = subtaskCount > 0 ? ` y sus ${subtaskCount} subtareas` : "";

    if (!window.confirm(`¿Eliminar ${label}${extra}?`)) {
      return;
    }

    const removedIds = [item.id, ...items.filter((row) => row.parentId === item.id).map((row) => row.id)];
    cancel(removedIds.map((id) => `${id}:`));
    setItems((current) => current.filter((row) => !removedIds.includes(row.id)));
    void enqueue(() =>
      fetchJson(tareasApi.closingItem(closing.id, item.id), { method: "DELETE" }, "No se pudo eliminar la fila."),
    );
  }

  function move(siblings: ChecklistItem[], index: number, direction: -1 | 1) {
    const target = index + direction;

    if (target < 0 || target >= siblings.length) {
      return;
    }

    const ordered = [...siblings];
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    const positions = new Map(ordered.map((item, position) => [item.id, position]));
    setItems((current) => current.map((item) => (positions.has(item.id) ? { ...item, position: positions.get(item.id)! } : item)));
    void enqueue(() =>
      fetchJson(
        tareasApi.closingReorder(closing.id),
        {
          method: "POST",
          headers: jsonHeaders,
          body: JSON.stringify({ parentId: siblings[0].parentId, ids: ordered.map((item) => item.id) }),
        },
        "No se pudo cambiar el orden.",
      ),
    );
  }

  async function renameClosing(name: string) {
    await fetchJson(
      tareasApi.closing(closing.id),
      { method: "PATCH", headers: jsonHeaders, body: JSON.stringify({ name }) },
      "No se pudo cambiar el nombre.",
    ).catch((error: unknown) => {
      setSaveError(errorMessage(error, "No se pudo cambiar el nombre."));
      throw error;
    });
    setClosingName(name);
  }

  async function deleteClosing() {
    if (!window.confirm(`¿Eliminar el cierre «${closingName}» con todo su checklist? No se puede deshacer.`)) {
      return;
    }

    try {
      await fetchJson(tareasApi.closing(closing.id), { method: "DELETE" }, "No se pudo eliminar el cierre.");
      router.push(tareasRoutes.company(company.id));
      router.refresh();
    } catch (error) {
      setSaveError(errorMessage(error, "No se pudo eliminar el cierre."));
    }
  }

  function nameField(item: ChecklistItem, placeholder: string, label: string) {
    return (
      <AutoTextarea
        aria-label={label}
        autoFocus={focusId === item.id}
        className="tk-cell-input tk-cell-name"
        maxLength={tareasConfig.limits.nameLength}
        onBlur={() => flushTimer(`${item.id}:name`)}
        onChange={(event) => editText(item.id, "name", event.target.value.replace(/\n/g, " "))}
        placeholder={placeholder}
        singleLine
        value={item.name}
      />
    );
  }

  function rowCells(item: ChecklistItem, label: string) {
    return (
      <>
        <td className="tk-col-done">
          <input
            aria-label={`Realizada: ${label}`}
            checked={item.done}
            className="tk-checkbox"
            onChange={() => toggleDone(item)}
            type="checkbox"
          />
        </td>
        <td className="tk-col-notes">
          <AutoTextarea
            aria-label={`Observaciones: ${label}`}
            className="tk-cell-input"
            maxLength={tareasConfig.limits.notesLength}
            onBlur={() => flushTimer(`${item.id}:notes`)}
            onChange={(event) => editText(item.id, "notes", event.target.value)}
            placeholder="—"
            value={item.notes}
          />
        </td>
      </>
    );
  }

  function moveButtons(siblings: ChecklistItem[], index: number, label: string) {
    return (
      <>
        <button
          aria-label={`Subir ${label}`}
          className="tk-row-button"
          disabled={onlyPending || index === 0}
          onClick={() => move(siblings, index, -1)}
          title={onlyPending ? "Quita el filtro para ordenar" : "Subir"}
          type="button"
        >
          <ArrowUp size={14} />
        </button>
        <button
          aria-label={`Bajar ${label}`}
          className="tk-row-button"
          disabled={onlyPending || index === siblings.length - 1}
          onClick={() => move(siblings, index, 1)}
          title={onlyPending ? "Quita el filtro para ordenar" : "Bajar"}
          type="button"
        >
          <ArrowDown size={14} />
        </button>
      </>
    );
  }

  return (
    <div className="grid">
      <nav className="tk-breadcrumb" aria-label="Ruta">
        <Link href={tareasRoutes.closings}>Empresas</Link>
        <ChevronRight size={14} />
        <Link href={tareasRoutes.company(company.id)}>{company.name}</Link>
        <ChevronRight size={14} />
        <span>{closingName}</span>
      </nav>

      <div className="tk-checklist-header">
        <InlineNameEditor label="nombre del cierre" onSave={renameClosing} value={closingName}>
          <h2 className="tk-section-title">{closingName}</h2>
        </InlineNameEditor>
        <div className="tk-checklist-meta">
          <SaveStatus error={saveError} hasSaved={hasSaved} isSaving={isSaving} />
          <button className="button secondary tk-delete" onClick={deleteClosing} type="button">
            <Trash2 size={16} />
            Eliminar cierre
          </button>
        </div>
      </div>

      <SaveErrorBanner error={saveError} />

      <div className="tk-progress">
        <strong>
          {progress.done} de {progress.total} tareas realizadas
        </strong>
        <div
          aria-label="Progreso"
          aria-valuemax={progress.total}
          aria-valuemin={0}
          aria-valuenow={progress.done}
          className="tk-progress-bar"
          role="progressbar"
        >
          <span style={{ width: progress.total ? `${(progress.done / progress.total) * 100}%` : 0 }} />
        </div>
        <button
          aria-pressed={onlyPending}
          className={`button secondary tk-filter ${onlyPending ? "active" : ""}`}
          onClick={() => setOnlyPending((value) => !value)}
          type="button"
        >
          <ListFilter size={16} />
          Solo pendientes
        </button>
      </div>

      <section className="panel tk-checklist-panel">
        <div className="table-wrap">
          <table className="tk-checklist">
            <colgroup>
              <col className="tk-col-task" />
              <col className="tk-col-detail" />
              <col className="tk-col-done" />
              <col className="tk-col-notes" />
            </colgroup>
            <thead>
              <tr>
                <th>Tarea</th>
                <th>Subtarea o detalle</th>
                <th className="tk-col-done">Realizada</th>
                <th>Observaciones</th>
              </tr>
            </thead>
            {shownTasks.map((task, taskIndex) => {
              const taskLabel = task.name.trim() || "tarea sin nombre";
              const taskCell = (
                <td className="tk-col-task" rowSpan={Math.max(1, task.subtasks.length)}>
                  <div className="tk-cell">
                    {nameField(task, "Nombre de la tarea", `Tarea ${taskIndex + 1}`)}
                    <div className="tk-row-actions">
                      {moveButtons(shownTasks, taskIndex, taskLabel)}
                      <button
                        aria-label={`Añadir subtarea a ${taskLabel}`}
                        className="tk-row-button"
                        disabled={isAdding}
                        onClick={() => void addItem(task)}
                        title="Añadir subtarea"
                        type="button"
                      >
                        <ListPlus size={14} />
                      </button>
                      <button
                        aria-label={`Eliminar ${taskLabel}`}
                        className="tk-row-button danger"
                        onClick={() => removeItem(task, task.subtasks.length)}
                        title="Eliminar tarea"
                        type="button"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </td>
              );

              if (task.subtasks.length === 0) {
                return (
                  <tbody className="tk-group" key={task.id}>
                    <tr className="tk-simple-row">
                      {taskCell}
                      <td className="tk-col-detail tk-no-detail" />
                      {rowCells(task, taskLabel)}
                    </tr>
                  </tbody>
                );
              }

              return (
                <tbody className="tk-group" key={task.id}>
                  {task.subtasks.map((subtask, subtaskIndex) => {
                    const subtaskLabel = `${taskLabel} – ${subtask.name.trim() || "subtarea sin nombre"}`;

                    return (
                      <tr key={subtask.id}>
                        {subtaskIndex === 0 ? taskCell : null}
                        <td className="tk-col-detail">
                          <div className="tk-cell">
                            {nameField(subtask, "Subtarea o detalle", `Subtarea ${subtaskIndex + 1} de ${taskLabel}`)}
                            <div className="tk-row-actions">
                              {moveButtons(task.subtasks, subtaskIndex, subtaskLabel)}
                              <button
                                aria-label={`Eliminar ${subtaskLabel}`}
                                className="tk-row-button danger"
                                onClick={() => removeItem(subtask, 0)}
                                title="Eliminar subtarea"
                                type="button"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        </td>
                        {rowCells(subtask, subtaskLabel)}
                      </tr>
                    );
                  })}
                </tbody>
              );
            })}
          </table>
        </div>

        {shownTasks.length === 0 ? (
          <div className="panel-body">
            <div className={`message ${tasks.length ? "ok" : ""}`}>
              {tasks.length ? "No queda nada pendiente: todo está realizado." : "El checklist está vacío. Añade la primera tarea."}
            </div>
          </div>
        ) : null}

        <div className="tk-checklist-footer">
          <button className="button secondary" disabled={isAdding} onClick={() => void addItem(null)} type="button">
            {isAdding ? <Loader2 className="spin" size={16} /> : <Plus size={16} />}
            Añadir tarea
          </button>
          <span className="muted">Usa <ListPlus aria-hidden="true" size={13} /> para desglosar una tarea en subtareas.</span>
        </div>
      </section>
    </div>
  );
}
