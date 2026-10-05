import {
  addDays,
  addMonths,
  dateParts,
  eachDay,
  endOfMonth,
  formatDate,
  startOfMonth,
  startOfWeek,
  type IsoDate,
} from "@/modules/tareas/lib/dates";

export type CalendarView = "week" | "twoWeeks" | "month";

export const CALENDAR_VIEWS: { value: CalendarView; label: string }[] = [
  { value: "week", label: "Semana" },
  { value: "twoWeeks", label: "Dos semanas" },
  { value: "month", label: "Mes" },
];

export function isCalendarView(value: unknown): value is CalendarView {
  return value === "week" || value === "twoWeeks" || value === "month";
}

export type CalendarPeriod = {
  start: IsoDate;
  end: IsoDate;
  /** Whole weeks, Monday to Sunday. */
  weeks: IsoDate[][];
  /** Month view only: the month being shown, to dim days of the previous/next month. */
  month: { start: IsoDate; end: IsoDate } | null;
};

export function getPeriod(view: CalendarView, anchor: IsoDate): CalendarPeriod {
  let start: IsoDate;
  let end: IsoDate;
  let month: CalendarPeriod["month"] = null;

  if (view === "month") {
    month = { start: startOfMonth(anchor), end: endOfMonth(anchor) };
    start = startOfWeek(month.start);
    end = addDays(startOfWeek(month.end), 6);
  } else {
    start = startOfWeek(anchor);
    end = addDays(start, view === "week" ? 6 : 13);
  }

  const days = eachDay(start, end);
  const weeks: IsoDate[][] = [];

  for (let index = 0; index < days.length; index += 7) {
    weeks.push(days.slice(index, index + 7));
  }

  return { start, end, weeks, month };
}

/** Anchor of the previous (`-1`) or next (`1`) period. */
export function shiftAnchor(view: CalendarView, anchor: IsoDate, direction: 1 | -1) {
  if (view === "month") {
    return addMonths(startOfMonth(anchor), direction);
  }

  return addDays(anchor, direction * (view === "week" ? 7 : 14));
}

export function periodLabel(period: CalendarPeriod, today: IsoDate) {
  if (period.month) {
    return formatDate(period.month.start, { month: "long", year: "numeric" });
  }

  const startYear = dateParts(period.start).year;
  const endYear = dateParts(period.end).year;
  const showYear = startYear !== endYear || endYear !== dateParts(today).year;
  const startLabel = formatDate(period.start, { day: "numeric", month: "short", ...(startYear !== endYear ? { year: "numeric" } : {}) });
  const endLabel = formatDate(period.end, { day: "numeric", month: "short", ...(showYear ? { year: "numeric" } : {}) });

  return `${startLabel} – ${endLabel}`;
}
