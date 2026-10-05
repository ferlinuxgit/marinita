import {
  dateParts,
  daysInMonth,
  diffDays,
  eachDay,
  monthIndex,
  startOfWeek,
  weekday,
  WEEKDAY_NAMES,
  type IsoDate,
} from "@/modules/tareas/lib/dates";

export type RecurrenceFrequency = "daily" | "weekly" | "monthly";

export type Recurrence = {
  freq: RecurrenceFrequency;
  /** Every `interval` days / weeks / months. */
  interval: number;
  /** Weekly only: 0 = Monday … 6 = Sunday. */
  weekdays: number[];
  /** Monthly only: 1–31. Months without that day use their last day. */
  monthDay: number | null;
};

export type SeriesRule = {
  start: IsoDate;
  until: IsoDate | null;
  recurrence: Recurrence;
};

/** Fills the fields a frequency needs from the start date and drops the ones it does not use. */
export function normalizeRecurrence(recurrence: Recurrence, start: IsoDate): Recurrence {
  const interval = Math.max(1, Math.trunc(recurrence.interval) || 1);

  if (recurrence.freq === "weekly") {
    const weekdays = [...new Set(recurrence.weekdays.filter((day) => day >= 0 && day <= 6))].sort();
    return { freq: "weekly", interval, weekdays: weekdays.length ? weekdays : [weekday(start)], monthDay: null };
  }

  if (recurrence.freq === "monthly") {
    const monthDay = recurrence.monthDay && recurrence.monthDay >= 1 && recurrence.monthDay <= 31
      ? Math.trunc(recurrence.monthDay)
      : dateParts(start).day;
    return { freq: "monthly", interval, weekdays: [], monthDay };
  }

  return { freq: "daily", interval, weekdays: [], monthDay: null };
}

export function occursOn({ start, until, recurrence }: SeriesRule, date: IsoDate) {
  if (date < start || (until && date > until)) {
    return false;
  }

  const { interval } = recurrence;

  switch (recurrence.freq) {
    case "daily":
      return diffDays(start, date) % interval === 0;
    case "weekly": {
      const weeks = diffDays(startOfWeek(start), startOfWeek(date)) / 7;
      return weeks % interval === 0 && recurrence.weekdays.includes(weekday(date));
    }
    case "monthly": {
      const months = monthIndex(date) - monthIndex(start);

      if (months % interval !== 0) {
        return false;
      }

      const { year, month, day } = dateParts(date);
      const monthDay = recurrence.monthDay ?? dateParts(start).day;
      return day === Math.min(monthDay, daysInMonth(year, month));
    }
  }
}

export function occurrencesBetween(rule: SeriesRule, from: IsoDate, to: IsoDate) {
  const first = from > rule.start ? from : rule.start;
  const last = rule.until && rule.until < to ? rule.until : to;

  if (first > last) {
    return [];
  }

  return eachDay(first, last).filter((date) => occursOn(rule, date));
}

const WEEKDAY_PLURAL = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábados", "domingos"];

function joinSpanish(items: string[]) {
  return items.length > 1 ? `${items.slice(0, -1).join(", ")} y ${items.at(-1)}` : (items[0] ?? "");
}

export function describeRecurrence(recurrence: Recurrence) {
  const { interval } = recurrence;

  switch (recurrence.freq) {
    case "daily":
      return interval === 1 ? "Todos los días" : `Cada ${interval} días`;
    case "weekly": {
      const names = interval === 1 ? WEEKDAY_PLURAL : WEEKDAY_NAMES;
      const days = joinSpanish(recurrence.weekdays.map((day) => names[day]));
      return interval === 1 ? `Todos los ${days}` : `Cada ${interval} semanas: ${days}`;
    }
    case "monthly":
      return interval === 1
        ? `El día ${recurrence.monthDay} de cada mes`
        : `Cada ${interval} meses, el día ${recurrence.monthDay}`;
  }
}
