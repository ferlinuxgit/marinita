"use client";

import { Check, CircleAlert, ListChecks, Loader2, Repeat, Trash2, Users } from "lucide-react";
import { FormEvent, useState } from "react";

import { errorMessage, fetchJson } from "@/core/ui/api-client";
import { Modal } from "@/core/ui/modal";
import { tareasConfig } from "@/modules/tareas/config";
import { dateParts, formatDate, WEEKDAY_NAMES, WEEKDAY_SHORT, weekday, type IsoDate } from "@/modules/tareas/lib/dates";
import type { Occurrence, TaskKind } from "@/modules/tareas/lib/occurrences";
import {
  describeRecurrence,
  normalizeRecurrence,
  supportsWeekendShift,
  type Recurrence,
  type RecurrenceFrequency,
} from "@/modules/tareas/lib/recurrence";
import type { EditScope } from "@/modules/tareas/lib/validation";
import { tareasApi } from "@/modules/tareas/module";

export type TaskDialogTarget = { mode: "create"; date: IsoDate } | { mode: "edit"; occurrence: Occurrence };

type RepeatMode = "none" | "daily" | "weekly" | "monthly" | "custom";

type FormState = {
  kind: TaskKind;
  important: boolean;
  /** "HH:MM" or "" (meetings only). */
  time: string;
  title: string;
  date: IsoDate;
  notes: string;
  color: string | null;
  repeat: RepeatMode;
  interval: number;
  unit: RecurrenceFrequency;
  weekdays: number[];
  monthDay: number;
  weekendShift: boolean;
  until: string;
};

const UNIT_LABELS: Record<RecurrenceFrequency, string> = { daily: "días", weekly: "semanas", monthly: "meses" };

const SCOPE_OPTIONS: { value: EditScope; label: string }[] = [
  { value: "this", label: "Solo esta aparición" },
  { value: "following", label: "Esta aparición y las siguientes" },
  { value: "all", label: "Toda la serie" },
];

function initialForm(target: TaskDialogTarget): FormState {
  if (target.mode === "create") {
    return {
      kind: "task",
      important: false,
      time: "",
      title: "",
      date: target.date,
      notes: "",
      color: null,
      repeat: "none",
      interval: 1,
      unit: "weekly",
      weekdays: [weekday(target.date)],
      monthDay: dateParts(target.date).day,
      weekendShift: true,
      until: "",
    };
  }

  const { occurrence } = target;
  const recurrence = occurrence.recurrence;
  const repeat: RepeatMode = !recurrence ? "none" : recurrence.interval > 1 ? "custom" : recurrence.freq;

  return {
    kind: occurrence.kind,
    important: occurrence.important,
    time: occurrence.time ?? "",
    title: occurrence.title,
    date: occurrence.date,
    notes: occurrence.notes,
    color: occurrence.color,
    repeat,
    interval: recurrence?.interval ?? 1,
    unit: recurrence?.freq ?? "weekly",
    weekdays: recurrence?.weekdays.length ? recurrence.weekdays : [weekday(occurrence.date)],
    monthDay: recurrence?.monthDay ?? dateParts(occurrence.date).day,
    weekendShift: recurrence ? Boolean(recurrence.weekendShift) : true,
    until: occurrence.until ?? "",
  };
}

function toRecurrence(form: FormState): Recurrence | null {
  if (form.repeat === "none") {
    return null;
  }

  const freq = form.repeat === "custom" ? form.unit : form.repeat;
  const interval = form.repeat === "custom" ? form.interval : 1;
  return normalizeRecurrence(
    { freq, interval, weekdays: form.weekdays, monthDay: form.monthDay, weekendShift: form.weekendShift },
    form.date,
  );
}

function repetitionKey(form: FormState) {
  // Kind and importance belong to the whole series, like the repetition settings.
  return JSON.stringify([
    form.kind,
    form.important,
    form.repeat === "none" ? null : toRecurrence({ ...form, date: "2000-01-03" }),
    form.repeat === "none" ? "" : form.until,
  ]);
}

type TaskDialogProps = {
  target: TaskDialogTarget;
  onClose: () => void;
  /** Called after any change so the calendar reloads. */
  onChanged: () => void;
};

export function TaskDialog({ target, onClose, onChanged }: TaskDialogProps) {
  const [form, setForm] = useState(() => initialForm(target));
  const [originalRepetition] = useState(() => repetitionKey(initialForm(target)));
  const [done, setDone] = useState(target.mode === "edit" && target.occurrence.done);
  const [pendingAction, setPendingAction] = useState<"save" | "delete" | null>(null);
  const [scope, setScope] = useState<EditScope>("this");
  const [error, setError] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  const occurrence = target.mode === "edit" ? target.occurrence : null;
  const isSeries = Boolean(occurrence?.recurrence);
  const repetitionChanged = repetitionKey(form) !== originalRepetition;
  const recurrence = toRecurrence(form);

  function update<Key extends keyof FormState>(key: Key, value: FormState[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function toggleWeekday(day: number) {
    setForm((current) => {
      const weekdays = current.weekdays.includes(day)
        ? current.weekdays.filter((item) => item !== day)
        : [...current.weekdays, day].sort();
      return { ...current, weekdays: weekdays.length ? weekdays : current.weekdays };
    });
  }

  function taskPayload() {
    return {
      kind: form.kind,
      important: form.important,
      time: form.kind === "meeting" && form.time ? form.time : null,
      title: form.title.trim(),
      date: form.date,
      notes: form.notes,
      color: form.color,
      recurrence,
      until: recurrence && form.until ? form.until : null,
    };
  }

  async function run(action: () => Promise<unknown>, fallback: string) {
    setError("");
    setIsBusy(true);

    try {
      await action();
      onChanged();
      onClose();
    } catch (requestError) {
      setError(errorMessage(requestError, fallback));
      setIsBusy(false);
    }
  }

  function save(selectedScope: EditScope) {
    return run(async () => {
      if (!occurrence) {
        await fetchJson(
          tareasApi.tasks,
          { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(taskPayload()) },
          "No se pudo crear la tarea.",
        );
        return;
      }

      await fetchJson(
        tareasApi.task(occurrence.taskId),
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scope: selectedScope, occurrenceDate: occurrence.occurrenceDate, task: taskPayload() }),
        },
        "No se pudo guardar la tarea.",
      );
    }, "No se pudo guardar la tarea.");
  }

  function remove(selectedScope: EditScope) {
    if (!occurrence) {
      return;
    }

    const query = new URLSearchParams({ scope: selectedScope, occurrenceDate: occurrence.occurrenceDate });
    return run(
      () => fetchJson(`${tareasApi.task(occurrence.taskId)}?${query}`, { method: "DELETE" }, "No se pudo eliminar la tarea."),
      "No se pudo eliminar la tarea.",
    );
  }

  async function toggleDone(nextDone: boolean) {
    if (!occurrence) {
      return;
    }

    setDone(nextDone);
    setError("");

    try {
      await fetchJson(
        tareasApi.taskDone(occurrence.taskId),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ occurrenceDate: occurrence.occurrenceDate, done: nextDone }),
        },
        "No se pudo actualizar la tarea.",
      );
      onChanged();
    } catch (requestError) {
      setDone(!nextDone);
      setError(errorMessage(requestError, "No se pudo actualizar la tarea."));
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.title.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }

    if (recurrence && form.until && form.until < form.date) {
      setError("La fecha de finalización no puede ser anterior a la fecha de inicio.");
      return;
    }

    if (isSeries) {
      setScope(repetitionChanged ? "following" : "this");
      setPendingAction("save");
      return;
    }

    void save("all");
  }

  function onDelete() {
    if (isSeries) {
      setScope("this");
      setPendingAction("delete");
      return;
    }

    if (window.confirm(`¿Eliminar la tarea «${occurrence?.title}»?`)) {
      void remove("all");
    }
  }

  if (pendingAction && occurrence) {
    const isDelete = pendingAction === "delete";

    return (
      <Modal onClose={onClose} title={isDelete ? "Eliminar tarea repetida" : "Guardar tarea repetida"}>
        <form
          className="stack"
          onSubmit={(event) => {
            event.preventDefault();
            void (isDelete ? remove(scope) : save(scope));
          }}
        >
          <p className="muted tk-scope-intro">
            «{occurrence.title}» se repite. ¿A qué apariciones se aplica{isDelete ? " la eliminación" : "n los cambios"}?
          </p>
          <div className="tk-scope-options" role="radiogroup">
            {SCOPE_OPTIONS.map((option) => {
              const disabled = !isDelete && option.value === "this" && repetitionChanged;

              return (
                <label className={`tk-scope-option ${disabled ? "disabled" : ""}`} key={option.value}>
                  <input
                    checked={scope === option.value}
                    disabled={disabled}
                    name="scope"
                    onChange={() => setScope(option.value)}
                    type="radio"
                  />
                  <span>
                    {option.label}
                    {disabled ? <small>El tipo, la importancia y la repetición solo se pueden cambiar para varias apariciones.</small> : null}
                  </span>
                </label>
              );
            })}
          </div>
          {error ? <div className="message error">{error}</div> : null}
          <div className="tk-dialog-actions">
            <button className="button secondary" onClick={() => setPendingAction(null)} type="button">
              Volver
            </button>
            <button className={`button ${isDelete ? "danger" : ""}`} disabled={isBusy} type="submit">
              {isBusy ? <Loader2 className="spin" size={16} /> : isDelete ? <Trash2 size={16} /> : <Check size={16} />}
              {isDelete ? "Eliminar" : "Guardar"}
            </button>
          </div>
        </form>
      </Modal>
    );
  }

  return (
    <Modal
      onClose={onClose}
      title={`${occurrence ? "Editar" : "Nueva"} ${form.kind === "meeting" ? "reunión" : "tarea"}`}
    >
      <form className="stack tk-task-form" onSubmit={onSubmit}>
        <div className="tk-segmented tk-kind" role="radiogroup" aria-label="Tipo">
          <button
            aria-checked={form.kind === "task"}
            className={form.kind === "task" ? "active" : ""}
            onClick={() => update("kind", "task")}
            role="radio"
            type="button"
          >
            <ListChecks size={16} />
            Tarea
          </button>
          <button
            aria-checked={form.kind === "meeting"}
            className={form.kind === "meeting" ? "active" : ""}
            onClick={() => update("kind", "meeting")}
            role="radio"
            type="button"
          >
            <Users size={16} />
            Reunión
          </button>
        </div>

        <div className="field">
          <label htmlFor="tk-title">Nombre</label>
          <textarea
            data-autofocus
            className="input tk-title-input"
            id="tk-title"
            maxLength={tareasConfig.limits.titleLength}
            onChange={(event) => update("title", event.target.value.replace(/\n/g, " "))}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            required
            rows={2}
            value={form.title}
          />
        </div>

        <button
          aria-pressed={form.important}
          className={`tk-important-toggle ${form.important ? "on" : ""}`}
          onClick={() => update("important", !form.important)}
          type="button"
        >
          <CircleAlert aria-hidden="true" size={18} />
          <span>
            <strong>Muy importante</strong>
            <small>Se verá destacada en rojo en el calendario</small>
          </span>
          <span aria-hidden="true" className="tk-switch" />
        </button>

        <div className="tk-form-row">
          <div className="field">
            <label htmlFor="tk-date">{form.repeat !== "none" && !occurrence ? "Fecha de inicio" : "Fecha"}</label>
            <input
              className="input"
              id="tk-date"
              onChange={(event) => event.target.value && update("date", event.target.value)}
              required
              type="date"
              value={form.date}
            />
          </div>
          {form.kind === "meeting" ? (
            <div className="field tk-time-field">
              <label htmlFor="tk-time">Hora (opcional)</label>
              <input
                className="input"
                id="tk-time"
                onChange={(event) => update("time", event.target.value)}
                step={300}
                type="time"
                value={form.time}
              />
            </div>
          ) : null}
          {occurrence ? (
            <label className="tk-done-toggle">
              <input checked={done} onChange={(event) => void toggleDone(event.target.checked)} type="checkbox" />
              Realizada
            </label>
          ) : null}
        </div>

        <div className="field">
          <span className="tk-label">Color</span>
          <div className="tk-swatches" role="radiogroup" aria-label="Color">
            <button
              aria-checked={form.color === null}
              className={`tk-swatch tk-swatch-none ${form.color === null ? "selected" : ""}`}
              onClick={() => update("color", null)}
              role="radio"
              title="Sin color"
              type="button"
            >
              Sin color
            </button>
            {tareasConfig.colors.map((color) => (
              <button
                aria-checked={form.color === color.value}
                aria-label={color.label}
                className={`tk-swatch ${form.color === color.value ? "selected" : ""}`}
                key={color.value}
                onClick={() => update("color", color.value)}
                role="radio"
                style={{ background: color.value }}
                title={color.label}
                type="button"
              />
            ))}
          </div>
        </div>

        <div className="field">
          <label htmlFor="tk-repeat">
            <Repeat size={13} /> Repetición
          </label>
          <select
            className="input"
            id="tk-repeat"
            onChange={(event) => update("repeat", event.target.value as RepeatMode)}
            value={form.repeat}
          >
            <option value="none">Sin repetición</option>
            <option value="daily">Diariamente</option>
            <option value="weekly">Semanalmente</option>
            <option value="monthly">Mensualmente</option>
            <option value="custom">Personalizada</option>
          </select>
        </div>

        {form.repeat !== "none" ? (
          <div className="tk-repeat-box">
            {form.repeat === "custom" ? (
              <div className="tk-inline-field">
                <span>Cada</span>
                <input
                  aria-label="Intervalo"
                  className="input tk-number"
                  max={tareasConfig.limits.interval}
                  min={1}
                  onChange={(event) => update("interval", Math.max(1, Number(event.target.value) || 1))}
                  type="number"
                  value={form.interval}
                />
                <select
                  aria-label="Unidad"
                  className="input tk-unit"
                  onChange={(event) => update("unit", event.target.value as RecurrenceFrequency)}
                  value={form.unit}
                >
                  {Object.entries(UNIT_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {form.repeat === "weekly" || (form.repeat === "custom" && form.unit === "weekly") ? (
              <div className="tk-weekdays" role="group" aria-label="Días de la semana">
                {WEEKDAY_SHORT.map((label, day) => (
                  <button
                    aria-label={WEEKDAY_NAMES[day]}
                    aria-pressed={form.weekdays.includes(day)}
                    className={`tk-weekday ${form.weekdays.includes(day) ? "selected" : ""}`}
                    key={label}
                    onClick={() => toggleWeekday(day)}
                    title={WEEKDAY_NAMES[day]}
                    type="button"
                  >
                    {label}
                  </button>
                ))}
              </div>
            ) : null}

            {form.repeat === "monthly" || (form.repeat === "custom" && form.unit === "monthly") ? (
              <div className="stack tk-tight">
                <div className="tk-inline-field">
                  <span>El día</span>
                  <input
                    aria-label="Día del mes"
                    className="input tk-number"
                    max={31}
                    min={1}
                    onChange={(event) => update("monthDay", Math.min(31, Math.max(1, Number(event.target.value) || 1)))}
                    type="number"
                    value={form.monthDay}
                  />
                  <span>del mes</span>
                </div>
                <small className="muted">
                  Si un mes no tiene ese día (29, 30 o 31), la tarea aparece el último día de ese mes.
                </small>
              </div>
            ) : null}

            {recurrence && supportsWeekendShift(recurrence) ? (
              <label className="tk-check-label tk-weekend-shift">
                <input
                  checked={form.weekendShift}
                  onChange={(event) => update("weekendShift", event.target.checked)}
                  type="checkbox"
                />
                Si cae en sábado o domingo, pasarla al lunes siguiente
              </label>
            ) : null}

            <div className="tk-inline-field">
              <label htmlFor="tk-until">Hasta</label>
              <input
                className="input tk-until"
                id="tk-until"
                min={form.date}
                onChange={(event) => update("until", event.target.value)}
                type="date"
                value={form.until}
              />
              {form.until ? (
                <button className="tk-link-button" onClick={() => update("until", "")} type="button">
                  Sin fin
                </button>
              ) : (
                <span className="muted">Sin fecha de fin</span>
              )}
            </div>

            {recurrence ? (
              <p className="tk-repeat-summary">
                {describeRecurrence(recurrence)}, desde el {formatDate(form.date, { day: "numeric", month: "long", year: "numeric" })}
                {form.until ? ` hasta el ${formatDate(form.until, { day: "numeric", month: "long", year: "numeric" })}` : ""}.
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="field">
          <label htmlFor="tk-notes">Observaciones</label>
          <textarea
            className="input tk-notes"
            id="tk-notes"
            maxLength={tareasConfig.limits.notesLength}
            onChange={(event) => update("notes", event.target.value)}
            rows={3}
            value={form.notes}
          />
        </div>

        {error ? <div className="message error">{error}</div> : null}

        <div className="tk-dialog-actions">
          {occurrence ? (
            <button className="button secondary tk-delete" disabled={isBusy} onClick={onDelete} type="button">
              <Trash2 size={16} />
              Eliminar
            </button>
          ) : null}
          <button className="button secondary" onClick={onClose} type="button">
            Cancelar
          </button>
          <button className="button" disabled={isBusy} type="submit">
            {isBusy ? <Loader2 className="spin" size={16} /> : <Check size={16} />}
            Guardar
          </button>
        </div>
      </form>
    </Modal>
  );
}
