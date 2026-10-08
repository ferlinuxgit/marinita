"use client";

import { Check, ChevronLeft, ChevronRight, CircleAlert, GripVertical, Loader2, Plus, Repeat, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { errorMessage, fetchJson } from "@/core/ui/api-client";
import { TaskDialog, type TaskDialogTarget } from "@/modules/tareas/components/task-dialog";
import { tareasConfig } from "@/modules/tareas/config";
import { dateParts, formatDate, WEEKDAY_NAMES, type IsoDate } from "@/modules/tareas/lib/dates";
import { meetingsFirst, mergeVisibleOrder, type Occurrence } from "@/modules/tareas/lib/occurrences";
import { CALENDAR_VIEWS, getPeriod, periodLabel, shiftAnchor, type CalendarView } from "@/modules/tareas/lib/periods";
import { tareasApi } from "@/modules/tareas/module";

type CalendarProps = {
  today: IsoDate;
  initialView: CalendarView;
  initialAnchor: IsoDate;
  initialShowDone: boolean;
};

/** Color of meetings that have no color of their own. */
const MEETING_COLOR = "#4f46e5";

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
  /** Receives the keys of the visible tasks in their new order. */
  onReorder: (keys: string[]) => void;
};

/** `shift`: height of the dragged task plus the gap, used to slide the others. */
type DragState = { from: number; to: number; offset: number; shift: number };

function moveItem<T>(items: T[], from: number, to: number) {
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

function DayCell({ day, label, tasks, isToday, outside, togglingKey, onCreate, onEdit, onToggle, onReorder }: DayCellProps) {
  const listRef = useRef<HTMLUListElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragStart = useRef<{ y: number; rects: DOMRect[] } | null>(null);
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const canReorder = tasks.length > 1;
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

  // Keep keyboard focus on the handle of the task that was just moved.
  useEffect(() => {
    if (focusKey) {
      listRef.current?.querySelector<HTMLElement>(`[data-key="${focusKey}"] .tk-task-handle`)?.focus();
    }
  }, [focusKey, tasks]);

  function reorder(from: number, to: number) {
    if (from !== to && to >= 0 && to < tasks.length) {
      onReorder(moveItem(tasks.map(occurrenceKey), from, to));
    }
  }

  function onDragStart(event: React.PointerEvent<HTMLButtonElement>, index: number) {
    if (!listRef.current || (event.pointerType === "mouse" && event.button !== 0)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const rects = [...listRef.current.children].map((item) => item.getBoundingClientRect());
    dragStart.current = { y: event.clientY, rects };
    setDrag({ from: index, to: index, offset: 0, shift: rects[index].height + 3 });
  }

  function onDragMove(event: React.PointerEvent<HTMLButtonElement>) {
    if (!drag || !dragStart.current) {
      return;
    }

    const { y, rects } = dragStart.current;
    const offset = event.clientY - y;
    const dragged = rects[drag.from];
    const center = dragged.top + dragged.height / 2 + offset;
    const to = rects.filter((rect, index) => index !== drag.from && rect.top + rect.height / 2 < center).length;
    setDrag({ ...drag, to, offset });
  }

  function onDragEnd() {
    if (drag) {
      reorder(drag.from, drag.to);
    }

    dragStart.current = null;
    setDrag(null);
  }

  /** While dragging, the other tasks slide to show where the dragged one will land. */
  function itemStyle(index: number): React.CSSProperties | undefined {
    if (!drag) {
      return undefined;
    }

    if (index === drag.from) {
      return { transform: `translateY(${drag.offset}px)`, zIndex: 2, position: "relative" };
    }

    const { shift } = drag;

    if (drag.from < drag.to && index > drag.from && index <= drag.to) {
      return { transform: `translateY(${-shift}px)` };
    }

    if (drag.to < drag.from && index >= drag.to && index < drag.from) {
      return { transform: `translateY(${shift}px)` };
    }

    return { transform: "translateY(0)" };
  }

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

      <ul className={`tk-task-list ${drag ? "dragging" : ""}`} ref={listRef}>
        {tasks.map((occurrence, index) => {
          const key = occurrenceKey(occurrence);

          return (
            <li data-key={key} key={key} style={itemStyle(index)}>
              <div
                className={`tk-task ${occurrence.kind === "meeting" ? "meeting" : ""} ${occurrence.important ? "important" : ""} ${occurrence.done ? "done" : ""} ${occurrence.color || occurrence.kind === "meeting" ? "colored" : ""} ${drag?.from === index ? "is-dragged" : ""} ${canReorder ? "sortable" : ""}`}
                style={
                  occurrence.color || occurrence.kind === "meeting"
                    ? ({ "--tk-color": occurrence.color ?? MEETING_COLOR } as React.CSSProperties)
                    : undefined
                }
                title={[
                  occurrence.important ? "¡Muy importante!" : null,
                  occurrence.kind === "meeting" ? `Reunión${occurrence.time ? ` · ${occurrence.time}` : ""}` : null,
                  occurrence.title,
                  occurrence.notes ? `\n${occurrence.notes}` : null,
                ]
                  .filter(Boolean)
                  .join("\n")}
              >
                {canReorder ? (
                  <button
                    aria-label={`Mover «${occurrence.title}» (flechas arriba y abajo)`}
                    className="tk-task-handle"
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={(event) => {
                      const target = event.key === "ArrowUp" ? index - 1 : event.key === "ArrowDown" ? index + 1 : null;

                      if (target !== null) {
                        event.preventDefault();
                        setFocusKey(key);
                        reorder(index, target);
                      }
                    }}
                    onLostPointerCapture={onDragEnd}
                    onPointerDown={(event) => onDragStart(event, index)}
                    onPointerMove={onDragMove}
                    title="Arrastra para ordenar"
                    type="button"
                  >
                    <GripVertical size={12} />
                  </button>
                ) : null}
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
                  {occurrence.important ? (
                    <CircleAlert aria-label="Muy importante" className="tk-important-icon" size={14} strokeWidth={2.75} />
                  ) : null}
                  {occurrence.kind === "meeting" ? (
                    <>
                      <span className="tk-meeting-meta">
                        <Users aria-hidden="true" size={12} />
                        Reunión{occurrence.time ? ` · ${occurrence.time}` : ""}
                      </span>
                      <span className="tk-meeting-title">{occurrence.title}</span>
                    </>
                  ) : (
                    <span className="tk-task-text">{occurrence.title}</span>
                  )}
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

  const period = useMemo(() => getPeriod(view, anchor, tareasConfig.showWeekends), [view, anchor]);
  const range = `${period.start}:${period.end}`;
  const isLoading = loadedRange !== range;

  // Keep the URL in sync so a reload shows the same period.
  useEffect(() => {
    const params = new URLSearchParams({ view, date: anchor });

    // Done tasks are hidden by default; the URL only records when they are shown.
    if (showDone) {
      params.set("done", "1");
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

  async function reorderDay(day: IsoDate, visibleKeys: string[]) {
    const previous = occurrences;
    const dayOccurrences = occurrences.filter((occurrence) => occurrence.date === day);
    const byKey = new Map(dayOccurrences.map((occurrence) => [occurrenceKey(occurrence), occurrence]));
    // Meetings always stay on top, so a task dropped above them goes back below.
    const ordered = meetingsFirst(
      mergeVisibleOrder(dayOccurrences.map(occurrenceKey), visibleKeys).map((key) => byKey.get(key)!),
    );
    const keys = ordered.map(occurrenceKey);
    setOccurrences([...occurrences.filter((occurrence) => occurrence.date !== day), ...ordered]);

    try {
      await fetchJson(
        tareasApi.dayOrder,
        { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date: day, keys }) },
        "No se pudo guardar el orden.",
      );
    } catch (requestError) {
      setOccurrences(previous);
      setError(errorMessage(requestError, "No se pudo guardar el orden."));
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

      <div className={`tk-calendar tk-view-${view}`} style={{ "--tk-columns": period.weeks[0].length } as React.CSSProperties}>
        <div className="tk-weekday-row" aria-hidden="true">
          {WEEKDAY_NAMES.slice(0, period.weeks[0].length).map((name) => (
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
                onReorder={(keys) => void reorderDay(day, keys)}
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
