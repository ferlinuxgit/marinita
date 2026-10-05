"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { FormEvent, useState } from "react";

import { fetchJson } from "@/core/ui/api-client";
import { AutoTextarea } from "@/modules/tareas/components/auto-textarea";
import { SaveErrorBanner, SaveStatus } from "@/modules/tareas/components/save-status";
import { useSaveQueue } from "@/modules/tareas/components/use-save-queue";
import { tareasConfig } from "@/modules/tareas/config";
import { tareasApi } from "@/modules/tareas/module";

export type TodoItem = { id: string; title: string; done: boolean; position: number };

const jsonHeaders = { "Content-Type": "application/json" };

export function TodoList({ initialTodos }: { initialTodos: TodoItem[] }) {
  const [todos, setTodos] = useState(initialTodos);
  const [draft, setDraft] = useState("");
  const [showDone, setShowDone] = useState(true);
  const { enqueue, schedule, flush, cancel, isSaving, hasSaved, error } = useSaveQueue();

  const visible = showDone ? todos : todos.filter((todo) => !todo.done);
  const pending = todos.filter((todo) => !todo.done).length;

  function patch(todoId: string, values: Partial<Pick<TodoItem, "title" | "done">>) {
    return enqueue(() =>
      fetchJson(tareasApi.todo(todoId), { method: "PATCH", headers: jsonHeaders, body: JSON.stringify(values) }, "No se pudo guardar la tarea."),
    );
  }

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = draft.trim();

    if (!title) {
      return;
    }

    setDraft("");
    const created = await enqueue(() =>
      fetchJson<TodoItem>(tareasApi.todos, { method: "POST", headers: jsonHeaders, body: JSON.stringify({ title }) }, "No se pudo añadir la tarea."),
    );

    if (created) {
      setTodos((current) => [...current, created]);
    } else {
      setDraft(title);
    }
  }

  function editTitle(todoId: string, title: string) {
    setTodos((current) => current.map((todo) => (todo.id === todoId ? { ...todo, title } : todo)));
    schedule(`${todoId}:title`, () => void patch(todoId, { title }));
  }

  function toggle(todo: TodoItem) {
    setTodos((current) => current.map((item) => (item.id === todo.id ? { ...item, done: !todo.done } : item)));
    void patch(todo.id, { done: !todo.done });
  }

  function remove(todo: TodoItem) {
    if (todo.title.trim() && !window.confirm(`¿Eliminar «${todo.title.trim()}»?`)) {
      return;
    }

    cancel([`${todo.id}:`]);
    setTodos((current) => current.filter((item) => item.id !== todo.id));
    void enqueue(() => fetchJson(tareasApi.todo(todo.id), { method: "DELETE" }, "No se pudo eliminar la tarea."));
  }

  /** Moves a task among the visible ones; hidden done tasks keep their place. */
  function move(index: number, direction: -1 | 1) {
    const target = index + direction;

    if (target < 0 || target >= visible.length) {
      return;
    }

    const visibleIds = visible.map((todo) => todo.id);
    [visibleIds[index], visibleIds[target]] = [visibleIds[target], visibleIds[index]];
    const queueIds = [...visibleIds];
    const visibleSet = new Set(visibleIds);
    const ids = todos.map((todo) => (visibleSet.has(todo.id) ? queueIds.shift()! : todo.id));
    const byId = new Map(todos.map((todo) => [todo.id, todo]));
    setTodos(ids.map((id, position) => ({ ...byId.get(id)!, position })));
    void enqueue(() =>
      fetchJson(tareasApi.todosReorder, { method: "POST", headers: jsonHeaders, body: JSON.stringify({ ids }) }, "No se pudo cambiar el orden."),
    );
  }

  return (
    <div className="grid">
      <div className="tk-checklist-header">
        <div>
          <h2 className="tk-section-title">Tareas</h2>
          <p className="muted tk-subtitle">{pending === 1 ? "1 pendiente" : `${pending} pendientes`} · sin fecha</p>
        </div>
        <div className="tk-checklist-meta">
          <SaveStatus error={error} hasSaved={hasSaved} isSaving={isSaving} />
          <label className="tk-check-label">
            <input checked={showDone} onChange={(event) => setShowDone(event.target.checked)} type="checkbox" />
            Mostrar hechas
          </label>
        </div>
      </div>

      <SaveErrorBanner error={error} />

      <section className="panel">
        <form className="tk-add-form tk-todo-add" onSubmit={add}>
          <input
            aria-label="Nueva tarea"
            className="input"
            maxLength={tareasConfig.limits.titleLength}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Escribe una tarea y pulsa Enter"
            value={draft}
          />
          <button className="button" disabled={!draft.trim()} type="submit">
            <Plus size={16} />
            Añadir
          </button>
        </form>

        {visible.length > 0 ? (
          <ul className="tk-todo-list">
            {visible.map((todo, index) => (
              <li className={`tk-todo ${todo.done ? "done" : ""}`} key={todo.id}>
                <input
                  aria-label={`Hecha: ${todo.title || "tarea sin nombre"}`}
                  checked={todo.done}
                  className="tk-checkbox"
                  onChange={() => toggle(todo)}
                  type="checkbox"
                />
                <AutoTextarea
                  aria-label={`Tarea ${index + 1}`}
                  className="tk-cell-input tk-todo-title"
                  maxLength={tareasConfig.limits.titleLength}
                  onBlur={() => flush(`${todo.id}:title`)}
                  onChange={(event) => editTitle(todo.id, event.target.value.replace(/\n/g, " "))}
                  singleLine
                  value={todo.title}
                />
                <div className="tk-row-actions">
                  <button aria-label={`Subir ${todo.title}`} className="tk-row-button" disabled={index === 0} onClick={() => move(index, -1)} title="Subir" type="button">
                    <ArrowUp size={14} />
                  </button>
                  <button
                    aria-label={`Bajar ${todo.title}`}
                    className="tk-row-button"
                    disabled={index === visible.length - 1}
                    onClick={() => move(index, 1)}
                    title="Bajar"
                    type="button"
                  >
                    <ArrowDown size={14} />
                  </button>
                  <button aria-label={`Eliminar ${todo.title}`} className="tk-row-button danger" onClick={() => remove(todo)} title="Eliminar" type="button">
                    <Trash2 size={14} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="panel-body">
            <div className="message">{todos.length ? "No hay tareas pendientes." : "La lista está vacía. Añade la primera tarea."}</div>
          </div>
        )}
      </section>
    </div>
  );
}
