"use client";

import { Check, ChevronLeft, ChevronRight, Loader2, Plus, Repeat } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { errorMessage, fetchJson } from "@/core/ui/api-client";
import { TaskDialog, type TaskDialogTarget } from "@/modules/tareas/components/task-dialog";
import { dateParts, formatDate, WEEKDAY_NAMES, type IsoDate } from "@/modules/tareas/lib/dates";
import type { Occurrence } from "@/modules/tareas/lib/occurrences";
import { CALENDAR_VIEWS, getPeriod, periodLabel, shiftAnchor, type CalendarView } from "@/modules/tareas/lib/periods";
import { tareasApi } from "@/modules/tareas/module";

type CalendarProps = {
  today: IsoDate;
  initialView: CalendarView;
  initialAnchor: IsoDate;
  initialShowDone: boolean;
};

const occurrenceKey = (occurrence: Occurrence) => `${occurrence.taskId}:${occurrence.occurrenceDate}`;

type DayCellProps = {
  day: IsoDate;
  label: string;
  tasks: Occurrence[];
  isToday: boolean;
  outside: boolean;
  togglingKey: string | null;
  onCreate: () => void;
  onEdit: (occurrence: Occurrence) => void;
  onToggle: (occurrence: Occurrence) => void;
};

function DayCell({ day, label, tasks, isToday, outside, togglingKey, onCreate, onEdit, onToggle }: DayCellProps) {
  const listRef = useRef<HTMLUListElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const longLabel = formatDate(day, { weekday: "long", day: "numeric", month: "long" });

  // Detect when the tasks do not fit, to offer expanding the day (they can also be scrolled).
  useEffect(() => {
    const list = listRef.current;

    if (!list) {
      return;
    }

    const observer = new ResizeObserver(() => setIsOverflowing(list.scrollHeight > list.clientHeight + 1));
    observer.observe(list);
    list.childNodes.forEach((child) => observer.observe(child as Element));
    return () => observer.disconnect();
  }, [tasks.length]);

  return (
    <div className={`tk-day ${isToday ? "today" : ""} ${outside ? "outside" : ""} ${isExpanded ? "expanded" : ""}`} onClick={onCreate}>
      <div className="tk-day-header">
        <button
          aria-label={`Nueva tarea el ${longLabel}`}
          className="tk-day-number"
          onClick={(event) => {
            event.stopPropagation();
            onCreate();
          }}
          title="Nueva tarea"
          type="button"
        >
          <span className="tk-day-mobile-name">{formatDate(day, { weekday: "short" })}</span>
          {label}
        </button>
        {tasks.length > 0 ? (
          <span className="tk-day-count" title={tasks.length === 1 ? "1 tarea" : `${tasks.length} tareas`}>
            {tasks.length}
          </span>
        ) : null}
      </div>

      <ul className="tk-task-list" ref={listRef}>
        {tasks.map((occurrence) => {
          const key = occurrenceKey(occurrence);

          return (
            <li key={key}>
              <div
                className={`tk-task ${occurrence.done ? "done" : ""} ${occurrence.color ? "colored" : ""}`}
                style={occurrence.color ? ({ "--tk-color": occurrence.color } as React.CSSProperties) : undefined}
                title={occurrence.notes ? `${occurrence.title}\n\n${occurrence.notes}` : occurrence.title}
              >
                <button
                  aria-label={occurrence.done ? `Marcar «${occurrence.title}» como pendiente` : `Marcar «${occurrence.title}» como realizada`}
                  aria-pressed={occurrence.done}
                  className="tk-task-check"
                  disabled={togglingKey === key}
                  onClick={(event) => {
                    event.stopPropagation();
                    onToggle(occurrence);
                  }}
                  type="button"
                >
                  {occurrence.done ? <Check size={12} strokeWidth={3} /> : null}
                </button>
                <button
                  className="tk-task-title"
                  onClick={(event) => {
                    event.stopPropagation();
                    onEdit(occurrence);
                  }}
                  type="button"
                >
                  {occurrence.title}
                </button>
                {occurrence.recurrence ? <Repeat aria-label="Se repite" className="tk-task-repeat" size={11} /> : null}
              </div>
            </li>
          );
        })}
      </ul>

      {isOverflowing || isExpanded ? (
        <button
          className="tk-day-more"
          onClick={(event) => {
            event.stopPropagation();
            setIsExpanded((expanded) => !expanded);
          }}
          type="button"
        >
          {isExpanded ? "Ver menos" : `Ver todas (${tasks.length})`}
        </button>
      ) : null}
    </div>
  );
}

export function Calendar({ today, initialView, initialAnchor, initialShowDone }: CalendarProps) {
  const [view, setView] = useState(initialView);
  const [anchor, setAnchor] = useState(initialAnchor);
  const [showDone, setShowDone] = useState(initialShowDone);
  const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
  const [loadedRange, setLoadedRange] = useState("");
  const [error, setError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);
  const [dialog, setDialog] = useState<TaskDialogTarget | null>(null);
  const [togglingKey, setTogglingKey] = useState<string | null>(null);

  const period = useMemo(() => getPeriod(view, anchor), [view, anchor]);
  const range = `${period.start}:${period.end}`;
  const isLoading = loadedRange !== range;

  // Keep the URL in sync so a reload shows the same period.
  useEffect(() => {
    const params = new URLSearchParams({ view, date: anchor });

    if (!showDone) {
      params.set("done", "0");
    }

    window.history.replaceState(window.history.state, "", `?${params}`);
  }, [view, anchor, showDone]);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ from: period.start, to: period.end });

    fetchJson<{ occurrences: Occurrence[] }>(`${tareasApi.tasks}?${params}`, undefined, "No se pudieron cargar las tareas.")
      .then((payload) => {
        if (!cancelled) {
          setOccurrences(payload.occurrences);
          setError("");
          setLoadedRange(`${period.start}:${period.end}`);
        }
      })
      .catch((requestError: unknown) => {
        if (!cancelled) {
          setError(errorMessage(requestError, "No se pudieron cargar las tareas."));
          setLoadedRange(`${period.start}:${period.end}`);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [period.start, period.end, reloadToken]);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  const byDay = useMemo(() => {
    const map = new Map<IsoDate, Occurrence[]>();

    for (const occurrence of occurrences) {
      if (!showDone && occurrence.done) {
        continue;
      }

      map.set(occurrence.date, [...(map.get(occurrence.date) ?? []), occurrence]);
    }

    return map;
  }, [occurrences, showDone]);

  async function toggleDone(occurrence: Occurrence) {
    const key = occurrenceKey(occurrence);
    const done = !occurrence.done;
    setTogglingKey(key);
    setOccurrences((current) => current.map((item) => (occurrenceKey(item) === key ? { ...item, done } : item)));

    try {
      await fetchJson(
        tareasApi.taskDone(occurrence.taskId),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ occurrenceDate: occurrence.occurrenceDate, done }),
        },
        "No se pudo actualizar la tarea.",
      );
    } catch (requestError) {
      setOccurrences((current) => current.map((item) => (occurrenceKey(item) === key ? { ...item, done: !done } : item)));
      setError(errorMessage(requestError, "No se pudo actualizar la tarea."));
    } finally {
      setTogglingKey(null);
    }
  }

  const doneCount = occurrences.filter((occurrence) => occurrence.done).length;

  return (
    <div className="tk-calendar-page">
      <div className="tk-toolbar">
        <div className="tk-toolbar-group">
          <button aria-label="Periodo anterior" className="button secondary tk-icon-button" onClick={() => setAnchor(shiftAnchor(view, anchor, -1))} type="button">
            <ChevronLeft size={18} />
          </button>
          <button aria-label="Periodo siguiente" className="button secondary tk-icon-button" onClick={() => setAnchor(shiftAnchor(view, anchor, 1))} type="button">
            <ChevronRight size={18} />
          </button>
          <button className="button secondary" onClick={() => setAnchor(today)} type="button">
            Hoy
          </button>
          <h2 className="tk-period" aria-live="polite">
            {periodLabel(period, today)}
          </h2>
          {isLoading ? <Loader2 aria-label="Cargando" className="spin muted" size={16} /> : null}
        </div>

        <div className="tk-toolbar-group">
          <div className="tk-segmented" role="group" aria-label="Vista">
            {CALENDAR_VIEWS.map((option) => (
              <button
                aria-pressed={view === option.value}
                className={view === option.value ? "active" : ""}
                key={option.value}
                onClick={() => setView(option.value)}
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>
          <input
            aria-label="Ir a la fecha"
            className="input tk-date-jump"
            onChange={(event) => event.target.value && setAnchor(event.target.value)}
            type="date"
            value={anchor}
          />
          <label className="tk-check-label">
            <input checked={showDone} onChange={(event) => setShowDone(event.target.checked)} type="checkbox" />
            Mostrar realizadas{doneCount ? ` (${doneCount})` : ""}
          </label>
          <button className="button" onClick={() => setDialog({ mode: "create", date: today >= period.start && today <= period.end ? today : period.start })} type="button">
            <Plus size={16} />
            Nueva tarea
          </button>
        </div>
      </div>

      {error ? <div className="message error">{error}</div> : null}

      <div className={`tk-calendar tk-view-${view}`}>
        <div className="tk-weekday-row" aria-hidden="true">
          {WEEKDAY_NAMES.map((name) => (
            <div className="tk-weekday-name" key={name}>
              {name}
            </div>
          ))}
        </div>

        {period.weeks.map((week) => (
          <div className="tk-week" key={week[0]}>
            {week.map((day) => (
              <DayCell
                day={day}
                isToday={day === today}
                key={day}
                label={dateParts(day).day === 1 || (day === period.start && !period.month) ? formatDate(day, { day: "numeric", month: "short" }) : String(dateParts(day).day)}
                onCreate={() => setDialog({ mode: "create", date: day })}
                onEdit={(occurrence) => setDialog({ mode: "edit", occurrence })}
                onToggle={(occurrence) => void toggleDone(occurrence)}
                outside={Boolean(period.month && (day < period.month.start || day > period.month.end))}
                tasks={byDay.get(day) ?? []}
                togglingKey={togglingKey}
              />
            ))}
          </div>
        ))}
      </div>

      {dialog ? <TaskDialog key={dialog.mode === "edit" ? occurrenceKey(dialog.occurrence) : dialog.date} onChanged={reload} onClose={() => setDialog(null)} target={dialog} /> : null}
    </div>
  );
}
