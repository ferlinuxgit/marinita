import {
  addDays,
  addMonths,
  dateParts,
  eachDay,
  endOfMonth,
  formatDate,
  startOfMonth,
  startOfWeek,
  weekday,
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
  /** Weeks from Monday, with 7 days or 5 (Monday to Friday) when weekends are hidden. */
  weeks: IsoDate[][];
  /** Month view only: the month being shown, to dim days of the previous/next month. */
  month: { start: IsoDate; end: IsoDate } | null;
};

/** First Monday–Friday day on or after `date`. */
function nextWorkday(date: IsoDate) {
  return weekday(date) >= 5 ? addDays(date, 7 - weekday(date)) : date;
}

/** Last Monday–Friday day on or before `date`. */
function previousWorkday(date: IsoDate) {
  return weekday(date) >= 5 ? addDays(date, 4 - weekday(date)) : date;
}

export function getPeriod(view: CalendarView, anchor: IsoDate, showWeekends = true): CalendarPeriod {
  const daysPerWeek = showWeekends ? 7 : 5;
  const weekStarts: IsoDate[] = [];
  let month: CalendarPeriod["month"] = null;

  if (view === "month") {
    month = { start: startOfMonth(anchor), end: endOfMonth(anchor) };
    // Without weekends, skip a first or last row that would only show days of another month.
    const first = showWeekends ? month.start : nextWorkday(month.start);
    const last = showWeekends ? month.end : previousWorkday(month.end);

    for (let monday = startOfWeek(first); monday <= last; monday = addDays(monday, 7)) {
      weekStarts.push(monday);
    }
  } else {
    weekStarts.push(startOfWeek(anchor));

    if (view === "twoWeeks") {
      weekStarts.push(addDays(weekStarts[0], 7));
    }
  }

  const weeks = weekStarts.map((monday) => eachDay(monday, addDays(monday, daysPerWeek - 1)));
  const lastWeek = weeks[weeks.length - 1];

  return { start: weeks[0][0], end: lastWeek[lastWeek.length - 1], weeks, month };
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
