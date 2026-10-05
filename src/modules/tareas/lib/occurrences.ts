import { addDays, type IsoDate } from "@/modules/tareas/lib/dates";
import { displayDate, occurrencesBetween, occursOn, type Recurrence } from "@/modules/tareas/lib/recurrence";

export type TaskKind = "task" | "meeting";

/** A stored task. With `recurrence` it is a series that starts on `date`. */
export type TaskRecord = {
  id: string;
  title: string;
  notes: string;
  color: string | null;
  kind: TaskKind;
  /** "HH:MM" or null. */
  time: string | null;
  date: IsoDate;
  until: IsoDate | null;
  recurrence: Recurrence | null;
  /** Only used by single (non-recurring) tasks; occurrences keep their state in exceptions. */
  done: boolean;
  createdAt: Date | string;
};

/** Per-occurrence state of a series, keyed by the date the occurrence originally falls on. */
export type ExceptionRecord = {
  taskId: string;
  occurrenceDate: IsoDate;
  done: boolean;
  deleted: boolean;
  /** When true, title/notes/color/time/date replace the series values for this occurrence. */
  edited: boolean;
  title: string | null;
  notes: string | null;
  color: string | null;
  time: string | null;
  date: IsoDate | null;
};

export type Occurrence = {
  taskId: string;
  /** Original date in the series (equals `date` for single tasks). Identifies the occurrence. */
  occurrenceDate: IsoDate;
  /** Day it is shown on. */
  date: IsoDate;
  title: string;
  notes: string;
  color: string | null;
  kind: TaskKind;
  time: string | null;
  done: boolean;
  recurrence: Recurrence | null;
  seriesStart: IsoDate;
  until: IsoDate | null;
};

export function exceptionKey(taskId: string, occurrenceDate: IsoDate) {
  return `${taskId}:${occurrenceDate}`;
}

function toOccurrence(task: TaskRecord, occurrenceDate: IsoDate, exception?: ExceptionRecord): Occurrence {
  const edited = exception?.edited === true;

  return {
    taskId: task.id,
    occurrenceDate,
    date: edited && exception.date ? exception.date : displayDate(task.recurrence, occurrenceDate),
    title: edited && exception.title !== null ? exception.title : task.title,
    notes: edited && exception.notes !== null ? exception.notes : task.notes,
    color: edited ? exception.color : task.color,
    kind: task.kind,
    time: edited ? exception.time : task.time,
    done: task.recurrence ? (exception?.done ?? false) : task.done,
    recurrence: task.recurrence,
    seriesStart: task.date,
    until: task.until,
  };
}

/**
 * Every occurrence shown between `from` and `to` (inclusive): single tasks, series occurrences
 * (minus deleted ones) and occurrences moved into the range from another day.
 */
export function expandOccurrences(
  tasks: TaskRecord[],
  exceptions: ExceptionRecord[],
  from: IsoDate,
  to: IsoDate,
): Occurrence[] {
  const exceptionsByKey = new Map(exceptions.map((item) => [exceptionKey(item.taskId, item.occurrenceDate), item]));
  const result: { occurrence: Occurrence; order: number }[] = [];

  for (const task of tasks) {
    const order = new Date(task.createdAt).getTime();

    if (!task.recurrence) {
      if (task.date >= from && task.date <= to) {
        result.push({ occurrence: toOccurrence(task, task.date), order });
      }
      continue;
    }

    const rule = { start: task.date, until: task.until, recurrence: task.recurrence };
    const seen = new Set<IsoDate>();

    // Two extra days: a Saturday or Sunday occurrence may be shown on the Monday at `from`.
    for (const occurrenceDate of occurrencesBetween(rule, addDays(from, -2), to)) {
      seen.add(occurrenceDate);
      const exception = exceptionsByKey.get(exceptionKey(task.id, occurrenceDate));

      if (exception?.deleted) {
        continue;
      }

      const occurrence = toOccurrence(task, occurrenceDate, exception);

      if (occurrence.date >= from && occurrence.date <= to) {
        result.push({ occurrence, order });
      }
    }

    // Occurrences whose original date is outside the range but were moved into it.
    for (const exception of exceptions) {
      if (
        exception.taskId !== task.id ||
        exception.deleted ||
        !exception.edited ||
        !exception.date ||
        exception.date < from ||
        exception.date > to ||
        seen.has(exception.occurrenceDate) ||
        !occursOn(rule, exception.occurrenceDate)
      ) {
        continue;
      }

      result.push({ occurrence: toOccurrence(task, exception.occurrenceDate, exception), order });
    }
  }

  return result
    .sort((a, b) => a.occurrence.date.localeCompare(b.occurrence.date) || a.order - b.order)
    .map((item) => item.occurrence);
}

/**
 * Applies the manual order saved for each day. Occurrences not in the saved order (new tasks, or
 * keys that no longer exist) keep their default order after the ordered ones.
 */
export function applyDayOrders(occurrences: Occurrence[], orders: Map<IsoDate, string[]>) {
  const position = (occurrence: Occurrence) => {
    const index = orders.get(occurrence.date)?.indexOf(exceptionKey(occurrence.taskId, occurrence.occurrenceDate)) ?? -1;
    return index === -1 ? Number.POSITIVE_INFINITY : index;
  };

  return meetingsFirst(
    occurrences
      .map((occurrence, index) => ({ occurrence, index, position: position(occurrence) }))
      .sort((a, b) => a.occurrence.date.localeCompare(b.occurrence.date) || a.position - b.position || a.index - b.index)
      .map((item) => item.occurrence),
  );
}

/**
 * Within each day, meetings go first, sorted by time (meetings without time after the timed ones);
 * otherwise the given order is kept.
 */
export function meetingsFirst<T extends Pick<Occurrence, "date" | "kind" | "time">>(occurrences: T[]): T[] {
  const rank = (occurrence: T) => (occurrence.kind === "meeting" ? (occurrence.time ? 0 : 1) : 2);

  return occurrences
    .map((occurrence, index) => ({ occurrence, index }))
    .sort(
      (a, b) =>
        a.occurrence.date.localeCompare(b.occurrence.date) ||
        rank(a.occurrence) - rank(b.occurrence) ||
        (rank(a.occurrence) === 0 ? a.occurrence.time!.localeCompare(b.occurrence.time!) : 0) ||
        a.index - b.index,
    )
    .map((item) => item.occurrence);
}

/**
 * New full order of a day after reordering only the visible tasks (done tasks may be hidden):
 * hidden tasks keep their slots and the visible ones fill the rest in their new order.
 */
export function mergeVisibleOrder(allKeys: string[], visibleKeys: string[]) {
  const visible = new Set(visibleKeys);
  const queue = [...visibleKeys];
  return allKeys.map((key) => (visible.has(key) ? (queue.shift() ?? key) : key));
}
