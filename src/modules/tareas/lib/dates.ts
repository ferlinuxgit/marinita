// Calendar days are handled as "YYYY-MM-DD" strings and converted to UTC day numbers for arithmetic,
// so no local time zone can shift a task to the previous or next day.

const DAY_MS = 24 * 60 * 60 * 1000;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export type IsoDate = string;

export function isIsoDate(value: string) {
  const match = ISO_DATE.exec(value);

  if (!match) {
    return false;
  }

  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function parts(date: IsoDate) {
  const match = ISO_DATE.exec(date);

  if (!match) {
    throw new Error(`Fecha no válida: ${date}`);
  }

  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

function fromUtc(date: Date): IsoDate {
  return date.toISOString().slice(0, 10);
}

/** Days since 1970-01-01. */
export function toDayNumber(date: IsoDate) {
  const { year, month, day } = parts(date);
  return Date.UTC(year, month - 1, day) / DAY_MS;
}

export function fromDayNumber(dayNumber: number): IsoDate {
  return fromUtc(new Date(dayNumber * DAY_MS));
}

export function addDays(date: IsoDate, days: number) {
  return fromDayNumber(toDayNumber(date) + days);
}

export function diffDays(from: IsoDate, to: IsoDate) {
  return toDayNumber(to) - toDayNumber(from);
}

export function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Same day `months` later, clamped to the last day of the target month. */
export function addMonths(date: IsoDate, months: number) {
  const { year, month, day } = parts(date);
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const targetYear = target.getUTCFullYear();
  const targetMonth = target.getUTCMonth() + 1;
  return fromUtc(new Date(Date.UTC(targetYear, targetMonth - 1, Math.min(day, daysInMonth(targetYear, targetMonth)))));
}

/** 0 = Monday … 6 = Sunday. */
export function weekday(date: IsoDate) {
  return (new Date(toDayNumber(date) * DAY_MS).getUTCDay() + 6) % 7;
}

export function startOfWeek(date: IsoDate) {
  return addDays(date, -weekday(date));
}

export function startOfMonth(date: IsoDate) {
  const { year, month } = parts(date);
  return fromUtc(new Date(Date.UTC(year, month - 1, 1)));
}

export function endOfMonth(date: IsoDate) {
  const { year, month } = parts(date);
  return fromUtc(new Date(Date.UTC(year, month - 1, daysInMonth(year, month))));
}

export function dateParts(date: IsoDate) {
  return parts(date);
}

/** Absolute month number; the difference between two dates' values is the months between them. */
export function monthIndex(date: IsoDate) {
  const { year, month } = parts(date);
  return year * 12 + month - 1;
}

export function eachDay(from: IsoDate, to: IsoDate) {
  const days: IsoDate[] = [];

  for (let day = toDayNumber(from); day <= toDayNumber(to); day += 1) {
    days.push(fromDayNumber(day));
  }

  return days;
}

/** Today's calendar day in the given IANA time zone. */
export function todayIn(timeZone: string, now = new Date()): IsoDate {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function utcDate(date: IsoDate) {
  return new Date(toDayNumber(date) * DAY_MS);
}

export function formatDate(date: IsoDate, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("es-ES", { ...options, timeZone: "UTC" }).format(utcDate(date));
}

export const WEEKDAY_SHORT = ["L", "M", "X", "J", "V", "S", "D"];
export const WEEKDAY_NAMES = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
