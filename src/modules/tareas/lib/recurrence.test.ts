import { describe, expect, it } from "vitest";

import { addMonths, todayIn, weekday } from "@/modules/tareas/lib/dates";
import {
  describeRecurrence,
  normalizeRecurrence,
  occurrencesBetween,
  occursOn,
  type Recurrence,
} from "@/modules/tareas/lib/recurrence";

const MON = 0;
const THU = 3;

function rule(recurrence: Partial<Recurrence> & Pick<Recurrence, "freq">, start: string, until: string | null = null) {
  return {
    start,
    until,
    recurrence: normalizeRecurrence({ interval: 1, weekdays: [], monthDay: null, ...recurrence }, start),
  };
}

describe("dates", () => {
  it("uses Monday as the first weekday", () => {
    expect(weekday("2026-10-05")).toBe(0); // lunes
    expect(weekday("2026-10-11")).toBe(6); // domingo
  });

  it("clamps addMonths to the last day of shorter months", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2028-01-31", 1)).toBe("2028-02-29");
    expect(addMonths("2026-12-15", 1)).toBe("2027-01-15");
  });

  it("computes today in the app time zone, not UTC", () => {
    // 23:30 UTC on 4 Oct is already 5 Oct in Madrid (UTC+2).
    expect(todayIn("Europe/Madrid", new Date("2026-10-04T23:30:00Z"))).toBe("2026-10-05");
    expect(todayIn("UTC", new Date("2026-10-04T23:30:00Z"))).toBe("2026-10-04");
  });
});

describe("occurrencesBetween", () => {
  it("every day", () => {
    expect(occurrencesBetween(rule({ freq: "daily" }, "2026-10-05"), "2026-10-03", "2026-10-08")).toEqual([
      "2026-10-05",
      "2026-10-06",
      "2026-10-07",
      "2026-10-08",
    ]);
  });

  it("every 3 days", () => {
    expect(
      occurrencesBetween(rule({ freq: "daily", interval: 3 }, "2026-10-05"), "2026-10-06", "2026-10-15"),
    ).toEqual(["2026-10-08", "2026-10-11", "2026-10-14"]);
  });

  it("all Mondays", () => {
    expect(
      occurrencesBetween(rule({ freq: "weekly", weekdays: [MON] }, "2026-10-01"), "2026-10-01", "2026-10-31"),
    ).toEqual(["2026-10-05", "2026-10-12", "2026-10-19", "2026-10-26"]);
  });

  it("Mondays and Thursdays", () => {
    expect(
      occurrencesBetween(rule({ freq: "weekly", weekdays: [MON, THU] }, "2026-10-05"), "2026-10-01", "2026-10-18"),
    ).toEqual(["2026-10-05", "2026-10-08", "2026-10-12", "2026-10-15"]);
  });

  it("every two weeks keeps the cadence from the start week", () => {
    const series = rule({ freq: "weekly", interval: 2, weekdays: [MON] }, "2026-10-05");
    expect(occurrencesBetween(series, "2026-10-01", "2026-11-30")).toEqual([
      "2026-10-05",
      "2026-10-19",
      "2026-11-02",
      "2026-11-16",
      "2026-11-30",
    ]);
    // Far in the future the cadence still holds (no drift, no duplicates).
    expect(occursOn(series, "2027-10-04")).toBe(true);
    expect(occursOn(series, "2027-10-11")).toBe(false);
  });

  it("the 5th of every month", () => {
    expect(
      occurrencesBetween(rule({ freq: "monthly", monthDay: 5 }, "2026-10-01"), "2026-10-01", "2027-01-31"),
    ).toEqual(["2026-10-05", "2026-11-05", "2026-12-05", "2027-01-05"]);
  });

  it("skips the first month when the start is after the day", () => {
    expect(
      occurrencesBetween(rule({ freq: "monthly", monthDay: 5 }, "2026-10-20"), "2026-10-01", "2026-11-30"),
    ).toEqual(["2026-11-05"]);
  });

  it("every three months", () => {
    expect(
      occurrencesBetween(rule({ freq: "monthly", interval: 3, monthDay: 15 }, "2026-01-15"), "2026-01-01", "2026-12-31"),
    ).toEqual(["2026-01-15", "2026-04-15", "2026-07-15", "2026-10-15"]);
  });

  it("uses the last day of the month when the day does not exist", () => {
    const series = rule({ freq: "monthly", monthDay: 31 }, "2026-01-31");
    expect(occurrencesBetween(series, "2026-01-01", "2026-06-30")).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
      "2026-04-30",
      "2026-05-31",
      "2026-06-30",
    ]);
    expect(occurrencesBetween(rule({ freq: "monthly", monthDay: 30 }, "2028-01-30"), "2028-02-01", "2028-02-29")).toEqual([
      "2028-02-29",
    ]);
    expect(occurrencesBetween(rule({ freq: "monthly", monthDay: 29 }, "2026-01-29"), "2026-02-01", "2026-03-31")).toEqual([
      "2026-02-28",
      "2026-03-29",
    ]);
  });

  it("stops at the end date and never before the start", () => {
    const series = rule({ freq: "daily" }, "2026-10-05", "2026-10-07");
    expect(occurrencesBetween(series, "2026-10-01", "2026-10-31")).toEqual(["2026-10-05", "2026-10-06", "2026-10-07"]);
    expect(occurrencesBetween(series, "2026-11-01", "2026-11-30")).toEqual([]);
  });
});

describe("normalizeRecurrence / describeRecurrence", () => {
  it("defaults weekly to the start weekday and monthly to the start day", () => {
    expect(normalizeRecurrence({ freq: "weekly", interval: 1, weekdays: [], monthDay: null }, "2026-10-08").weekdays).toEqual([THU]);
    expect(normalizeRecurrence({ freq: "monthly", interval: 1, weekdays: [], monthDay: null }, "2026-10-08").monthDay).toBe(8);
  });

  it("only keeps the weekend shift for monthly and every-N-days series", () => {
    const base = { interval: 1, weekdays: [], monthDay: null, weekendShift: true };
    expect(normalizeRecurrence({ ...base, freq: "monthly" }, "2026-10-05").weekendShift).toBe(true);
    expect(normalizeRecurrence({ ...base, freq: "daily", interval: 3 }, "2026-10-05").weekendShift).toBe(true);
    expect(normalizeRecurrence({ ...base, freq: "daily" }, "2026-10-05").weekendShift).toBe(false);
    expect(normalizeRecurrence({ ...base, freq: "weekly" }, "2026-10-05").weekendShift).toBeUndefined();
    expect(describeRecurrence(normalizeRecurrence({ ...base, freq: "monthly", monthDay: 5 }, "2026-10-05"))).toBe(
      "El día 5 de cada mes (si cae en fin de semana, el lunes siguiente)",
    );
  });

  it("describes in Spanish", () => {
    const describe = (recurrence: Partial<Recurrence> & Pick<Recurrence, "freq">) =>
      describeRecurrence(normalizeRecurrence({ interval: 1, weekdays: [], monthDay: null, ...recurrence }, "2026-10-05"));

    expect(describe({ freq: "daily" })).toBe("Todos los días");
    expect(describe({ freq: "weekly", weekdays: [MON] })).toBe("Todos los lunes");
    expect(describe({ freq: "weekly", weekdays: [MON, THU] })).toBe("Todos los lunes y jueves");
    expect(describe({ freq: "weekly", weekdays: [5, 6] })).toBe("Todos los sábados y domingos");
    expect(describe({ freq: "weekly", interval: 2, weekdays: [MON] })).toBe("Cada 2 semanas: lunes");
    expect(describe({ freq: "monthly", monthDay: 5 })).toBe("El día 5 de cada mes");
    expect(describe({ freq: "monthly", interval: 3, monthDay: 5 })).toBe("Cada 3 meses, el día 5");
  });
});
