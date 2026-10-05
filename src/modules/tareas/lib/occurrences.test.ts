import { describe, expect, it } from "vitest";

import { buildChecklist, cloneStructure, countProgress, type ChecklistItem } from "@/modules/tareas/lib/checklist";
import {
  applyDayOrders,
  expandOccurrences,
  mergeVisibleOrder,
  type ExceptionRecord,
  type TaskRecord,
} from "@/modules/tareas/lib/occurrences";
import { getPeriod, periodLabel, shiftAnchor } from "@/modules/tareas/lib/periods";

const weeklyMonday: TaskRecord = {
  id: "s1",
  title: "Revisar bancos",
  notes: "",
  color: "#2563eb",
  date: "2026-10-05",
  until: null,
  recurrence: { freq: "weekly", interval: 1, weekdays: [0], monthDay: null },
  done: false,
  createdAt: "2026-10-01T10:00:00Z",
};

function exception(partial: Partial<ExceptionRecord> & Pick<ExceptionRecord, "occurrenceDate">): ExceptionRecord {
  return { taskId: "s1", done: false, deleted: false, edited: false, title: null, notes: null, color: null, date: null, ...partial };
}

describe("expandOccurrences", () => {
  it("keeps the done state of each occurrence independent", () => {
    const result = expandOccurrences([weeklyMonday], [exception({ occurrenceDate: "2026-10-05", done: true })], "2026-10-01", "2026-10-31");

    expect(result.map((item) => [item.date, item.done])).toEqual([
      ["2026-10-05", true],
      ["2026-10-12", false],
      ["2026-10-19", false],
      ["2026-10-26", false],
    ]);
  });

  it("hides deleted occurrences and applies per-occurrence edits", () => {
    const result = expandOccurrences(
      [weeklyMonday],
      [
        exception({ occurrenceDate: "2026-10-12", deleted: true }),
        exception({ occurrenceDate: "2026-10-19", edited: true, title: "Solo esta", notes: "nota", color: null, date: "2026-10-19" }),
      ],
      "2026-10-01",
      "2026-10-25",
    );

    expect(result.map((item) => [item.date, item.title, item.color])).toEqual([
      ["2026-10-05", "Revisar bancos", "#2563eb"],
      ["2026-10-19", "Solo esta", null],
    ]);
  });

  it("shows a moved occurrence only on its new day, also across ranges", () => {
    const moved = exception({ occurrenceDate: "2026-10-12", edited: true, title: "Revisar bancos", notes: "", color: null, date: "2026-11-03" });

    const october = expandOccurrences([weeklyMonday], [moved], "2026-10-12", "2026-10-18");
    const november = expandOccurrences([weeklyMonday], [moved], "2026-11-02", "2026-11-08");

    expect(october).toEqual([]);
    expect(november.map((item) => [item.occurrenceDate, item.date])).toEqual([
      ["2026-11-02", "2026-11-02"],
      ["2026-10-12", "2026-11-03"],
    ]);
  });

  it("ignores exceptions that no longer belong to the series", () => {
    const ended = { ...weeklyMonday, until: "2026-10-10" };
    const orphan = exception({ occurrenceDate: "2026-10-12", edited: true, title: "x", notes: "", color: null, date: "2026-10-06" });

    expect(expandOccurrences([ended], [orphan], "2026-10-01", "2026-10-31").map((item) => item.date)).toEqual(["2026-10-05"]);
  });

  it("includes single tasks in range with their own state, sorted by day then creation", () => {
    const single: TaskRecord = { ...weeklyMonday, id: "t1", title: "Pagar", recurrence: null, date: "2026-10-05", done: true, createdAt: "2026-09-01T00:00:00Z" };

    expect(expandOccurrences([weeklyMonday, single], [], "2026-10-05", "2026-10-05").map((item) => [item.title, item.done])).toEqual([
      ["Pagar", true],
      ["Revisar bancos", false],
    ]);
  });
});

describe("weekend shift", () => {
  // 5th of each month, moved to Monday when it falls on a weekend.
  const monthly: TaskRecord = {
    ...weeklyMonday,
    id: "m",
    title: "IVA",
    date: "2026-09-05",
    recurrence: { freq: "monthly", interval: 1, weekdays: [], monthDay: 5, weekendShift: true },
  };

  it("shows weekend occurrences on the following Monday, also at the start of the range", () => {
    // 5 Sep 2026 is a Saturday → Monday 7; 5 Oct is a Monday; 5 Dec is a Saturday → Monday 7.
    const september = expandOccurrences([monthly], [], "2026-09-07", "2026-09-11");
    expect(september.map((item) => [item.occurrenceDate, item.date])).toEqual([["2026-09-05", "2026-09-07"]]);
    expect(expandOccurrences([monthly], [], "2026-10-01", "2026-10-31").map((item) => item.date)).toEqual(["2026-10-05"]);
    expect(expandOccurrences([monthly], [], "2026-12-01", "2026-12-31").map((item) => item.date)).toEqual(["2026-12-07"]);
    // Nothing is shown on the weekend itself.
    expect(expandOccurrences([monthly], [], "2026-09-05", "2026-09-06")).toEqual([]);
  });

  it("keeps the state of a moved occurrence on its original date", () => {
    const done = { taskId: "m", occurrenceDate: "2026-09-05", done: true, deleted: false, edited: false, title: null, notes: null, color: null, date: null };
    expect(expandOccurrences([monthly], [done], "2026-09-07", "2026-09-07")[0].done).toBe(true);
  });

  it("does nothing when the option is off", () => {
    const plain = { ...monthly, recurrence: { ...monthly.recurrence!, weekendShift: false } };
    expect(expandOccurrences([plain], [], "2026-09-01", "2026-09-30").map((item) => item.date)).toEqual(["2026-09-05"]);
  });
});

describe("day order", () => {
  const task = (id: string, date: string, createdAt: string): TaskRecord => ({
    ...weeklyMonday,
    id,
    title: id,
    recurrence: null,
    date,
    createdAt,
  });
  const tasks = [
    task("a", "2026-10-05", "2026-10-01T00:00:00Z"),
    task("b", "2026-10-05", "2026-10-02T00:00:00Z"),
    task("c", "2026-10-05", "2026-10-03T00:00:00Z"),
    task("d", "2026-10-06", "2026-10-01T00:00:00Z"),
  ];

  it("applies the saved order per day; unknown tasks go after, by creation", () => {
    const occurrences = expandOccurrences([...tasks, weeklyMonday], [], "2026-10-05", "2026-10-06");
    const ordered = applyDayOrders(occurrences, new Map([["2026-10-05", ["c:2026-10-05", "s1:2026-10-05", "gone:2026-10-05", "a:2026-10-05"]]]));

    expect(ordered.map((item) => item.taskId)).toEqual(["c", "s1", "a", "b", "d"]);
  });

  it("keeps each occurrence of a series ordered on its own day", () => {
    const other = { ...weeklyMonday, id: "s2", createdAt: "2026-10-02T00:00:00Z" };
    const occurrences = expandOccurrences([weeklyMonday, other], [], "2026-10-05", "2026-10-12");
    const ordered = applyDayOrders(occurrences, new Map([["2026-10-12", ["s2:2026-10-12", "s1:2026-10-12"]]]));

    expect(ordered.map((item) => `${item.taskId}@${item.date}`)).toEqual([
      "s1@2026-10-05",
      "s2@2026-10-05",
      "s2@2026-10-12",
      "s1@2026-10-12",
    ]);
  });

  it("reorders visible tasks without moving hidden (done) ones", () => {
    expect(mergeVisibleOrder(["a", "x", "b", "c"], ["c", "a", "b"])).toEqual(["c", "x", "a", "b"]);
    expect(mergeVisibleOrder(["a", "b"], ["b", "a"])).toEqual(["b", "a"]);
  });
});

describe("periods", () => {
  it("week, two weeks and month start on Monday", () => {
    expect(getPeriod("week", "2026-10-08")).toMatchObject({ start: "2026-10-05", end: "2026-10-11" });
    expect(getPeriod("twoWeeks", "2026-10-08")).toMatchObject({ start: "2026-10-05", end: "2026-10-18" });
    expect(getPeriod("twoWeeks", "2026-10-08").weeks).toHaveLength(2);

    const month = getPeriod("month", "2026-02-10");
    expect(month).toMatchObject({ start: "2026-01-26", end: "2026-03-01", month: { start: "2026-02-01", end: "2026-02-28" } });
    expect(month.weeks).toHaveLength(5);
    expect(getPeriod("month", "2026-03-10").weeks).toHaveLength(6);
  });

  it("hides Saturday and Sunday when weekends are off", () => {
    const week = getPeriod("week", "2026-10-08", false);
    expect(week).toMatchObject({ start: "2026-10-05", end: "2026-10-09" });
    expect(week.weeks).toEqual([["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09"]]);
    expect(periodLabel(week, "2026-10-05")).toBe("5 oct – 9 oct");

    const twoWeeks = getPeriod("twoWeeks", "2026-10-08", false);
    expect(twoWeeks).toMatchObject({ start: "2026-10-05", end: "2026-10-16" });
    expect(twoWeeks.weeks.map((days) => days.length)).toEqual([5, 5]);
    expect(periodLabel(twoWeeks, "2026-10-05")).toBe("5 oct – 16 oct");
  });

  it("month without weekends skips rows that only had weekend days of the month", () => {
    // August 2026 starts on Saturday and ends on Monday the 31st.
    const august = getPeriod("month", "2026-08-15", false);
    expect(august.start).toBe("2026-08-03");
    expect(august.end).toBe("2026-09-04");
    expect(august.weeks).toHaveLength(5);
    expect(august.weeks.every((days) => days.length === 5)).toBe(true);

    // May 2027 ends on Monday the 31st; that week is kept.
    expect(getPeriod("month", "2027-05-10", false).end).toBe("2027-06-04");
    // October 2026 (1st is a Thursday).
    expect(getPeriod("month", "2026-10-10", false)).toMatchObject({ start: "2026-09-28", end: "2026-10-30" });
  });

  it("navigates by period", () => {
    expect(shiftAnchor("week", "2026-10-08", 1)).toBe("2026-10-15");
    expect(shiftAnchor("twoWeeks", "2026-10-08", -1)).toBe("2026-09-24");
    expect(shiftAnchor("month", "2026-01-31", 1)).toBe("2026-02-01");
  });

  it("labels the visible period in Spanish", () => {
    expect(periodLabel(getPeriod("twoWeeks", "2026-10-05"), "2026-10-05")).toBe("5 oct – 18 oct");
    expect(periodLabel(getPeriod("month", "2026-10-05"), "2026-10-05")).toBe("octubre de 2026");
    expect(periodLabel(getPeriod("week", "2026-12-30"), "2026-10-05")).toBe("28 dic 2026 – 3 ene 2027");
  });
});

describe("checklist", () => {
  const items: ChecklistItem[] = [
    { id: "b", parentId: null, position: 0, name: "Bancos", done: false, notes: "" },
    { id: "b2", parentId: "b", position: 1, name: "Santander", done: true, notes: "Revisado manualmente" },
    { id: "b1", parentId: "b", position: 0, name: "BBVA", done: true, notes: "" },
    { id: "a", parentId: null, position: 1, name: "Amortización", done: true, notes: "ok" },
    { id: "p", parentId: null, position: 2, name: "Personal", done: false, notes: "" },
    { id: "p1", parentId: "p", position: 0, name: "465", done: false, notes: "Revisar importe" },
  ];

  it("groups subtasks under their task in order", () => {
    const tree = buildChecklist(items);
    expect(tree.map((task) => [task.name, task.subtasks.map((sub) => sub.name)])).toEqual([
      ["Bancos", ["BBVA", "Santander"]],
      ["Amortización", []],
      ["Personal", ["465"]],
    ]);
  });

  it("counts simple tasks and subtasks, not groupings", () => {
    expect(countProgress(buildChecklist(items))).toEqual({ done: 3, total: 4 });
  });

  it("copies the structure unticked, without notes and with new ids", () => {
    let next = 0;
    const copy = cloneStructure(items, () => `n${next++}`);
    const tree = buildChecklist(copy);

    expect(tree.map((task) => [task.name, task.subtasks.map((sub) => sub.name)])).toEqual([
      ["Bancos", ["BBVA", "Santander"]],
      ["Amortización", []],
      ["Personal", ["465"]],
    ]);
    expect(copy.every((item) => !item.done && item.notes === "")).toBe(true);
    expect(copy.some((item) => items.some((original) => original.id === item.id))).toBe(false);
  });
});
