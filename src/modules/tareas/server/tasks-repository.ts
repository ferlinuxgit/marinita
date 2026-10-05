import "server-only";

import { randomUUID } from "node:crypto";

import { and, between, eq, gte, inArray, isNotNull, isNull, or } from "drizzle-orm";

import { db } from "@/core/db";
import { NotFoundError, UserFacingError } from "@/core/http/errors";
import { tareasDayOrders, tareasTaskExceptions, tareasTasks } from "@/modules/tareas/db/schema";
import { addDays, diffDays, type IsoDate } from "@/modules/tareas/lib/dates";
import { applyDayOrders, expandOccurrences, type TaskRecord } from "@/modules/tareas/lib/occurrences";
import { displayDate, normalizeRecurrence, occursOn } from "@/modules/tareas/lib/recurrence";
import type { EditScope, TaskInput } from "@/modules/tareas/lib/validation";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type TaskRow = typeof tareasTasks.$inferSelect;

function toRecord(row: TaskRow): TaskRecord {
  return {
    id: row.id,
    title: row.title,
    notes: row.notes,
    color: row.color,
    kind: row.kind,
    time: row.time,
    date: row.date,
    until: row.untilDate,
    recurrence: row.recurrence,
    done: row.done,
    createdAt: row.createdAt,
  };
}

/** Task columns from the form, with the recurrence completed for its start date. */
function taskValues(input: TaskInput, start: IsoDate) {
  const recurrence = input.recurrence ? normalizeRecurrence(input.recurrence, start) : null;

  if (recurrence && input.until && input.until < start) {
    throw new UserFacingError("La fecha de finalización no puede ser anterior a la de inicio de la repetición.");
  }

  return {
    title: input.title,
    notes: input.notes,
    color: input.color,
    kind: input.kind,
    // Only meetings have a time.
    time: input.kind === "meeting" ? input.time : null,
    date: start,
    recurrence,
    untilDate: recurrence ? input.until : null,
    updatedAt: new Date(),
  };
}

async function getOwnedTask(userId: string, taskId: string, tx: Transaction | typeof db = db) {
  const [task] = await tx
    .select()
    .from(tareasTasks)
    .where(and(eq(tareasTasks.id, taskId), eq(tareasTasks.userId, userId)));

  if (!task) {
    throw new NotFoundError("Tarea no encontrada.");
  }

  return task;
}

/** For recurring tasks: checks that `occurrenceDate` is an occurrence of the series. */
function requireOccurrence(task: TaskRow, occurrenceDate: IsoDate | null): IsoDate {
  if (
    !task.recurrence ||
    !occurrenceDate ||
    !occursOn({ start: task.date, until: task.untilDate, recurrence: task.recurrence }, occurrenceDate)
  ) {
    throw new UserFacingError("Esa aparición no pertenece a la tarea.");
  }

  return occurrenceDate;
}

async function upsertException(
  tx: Transaction | typeof db,
  taskId: string,
  occurrenceDate: IsoDate,
  values: Partial<typeof tareasTaskExceptions.$inferInsert>,
) {
  await tx
    .insert(tareasTaskExceptions)
    .values({ id: randomUUID(), taskId, occurrenceDate, ...values })
    .onConflictDoUpdate({
      target: [tareasTaskExceptions.taskId, tareasTaskExceptions.occurrenceDate],
      set: values,
    });
}

export async function listOccurrences(userId: string, from: IsoDate, to: IsoDate) {
  const singles = await db
    .select()
    .from(tareasTasks)
    .where(and(eq(tareasTasks.userId, userId), isNull(tareasTasks.recurrence), between(tareasTasks.date, from, to)));
  // Every series is loaded: an occurrence may have been moved into this range from far away.
  const series = await db
    .select()
    .from(tareasTasks)
    .where(and(eq(tareasTasks.userId, userId), isNotNull(tareasTasks.recurrence)));
  const exceptions = series.length
    ? await db
        .select()
        .from(tareasTaskExceptions)
        .where(
          and(
            inArray(
              tareasTaskExceptions.taskId,
              series.map((task) => task.id),
            ),
            or(
              between(tareasTaskExceptions.occurrenceDate, addDays(from, -2), to),
              and(eq(tareasTaskExceptions.edited, true), between(tareasTaskExceptions.date, from, to)),
            ),
          ),
        )
    : [];

  const orders = await db
    .select({ date: tareasDayOrders.date, keys: tareasDayOrders.keys })
    .from(tareasDayOrders)
    .where(and(eq(tareasDayOrders.userId, userId), between(tareasDayOrders.date, from, to)));
  const occurrences = expandOccurrences([...singles, ...series].map(toRecord), exceptions, from, to);

  return applyDayOrders(occurrences, new Map(orders.map((order) => [order.date, order.keys])));
}

/** Saves the manual order of the tasks of one day. */
export async function saveDayOrder(userId: string, date: IsoDate, keys: string[]) {
  const uniqueKeys = [...new Set(keys)];

  await db
    .insert(tareasDayOrders)
    .values({ userId, date, keys: uniqueKeys })
    .onConflictDoUpdate({ target: [tareasDayOrders.userId, tareasDayOrders.date], set: { keys: uniqueKeys } });
}

export async function createTask(userId: string, input: TaskInput) {
  const id = randomUUID();
  await db.insert(tareasTasks).values({ id, userId, ...taskValues(input, input.date) });
  return { id };
}

export async function updateTask(
  userId: string,
  taskId: string,
  scope: EditScope,
  occurrenceDate: IsoDate | null,
  input: TaskInput,
) {
  await db.transaction(async (tx) => {
    const task = await getOwnedTask(userId, taskId, tx);

    if (!task.recurrence) {
      await tx.update(tareasTasks).set(taskValues(input, input.date)).where(eq(tareasTasks.id, task.id));
      return;
    }

    const occurrence = requireOccurrence(task, occurrenceDate);

    if (scope === "this") {
      await upsertException(tx, task.id, occurrence, {
        edited: true,
        deleted: false,
        title: input.title,
        notes: input.notes,
        color: input.color,
        time: input.kind === "meeting" ? input.time : null,
        date: input.date,
      });
      return;
    }

    // Changing the date of several occurrences moves them by the same number of days, measured from
    // the day this occurrence is shown on (it may have been moved on its own before).
    const [exception] = await tx
      .select({ edited: tareasTaskExceptions.edited, date: tareasTaskExceptions.date })
      .from(tareasTaskExceptions)
      .where(and(eq(tareasTaskExceptions.taskId, task.id), eq(tareasTaskExceptions.occurrenceDate, occurrence)));
    const shownDate = exception?.edited && exception.date ? exception.date : displayDate(task.recurrence, occurrence);
    const shift = diffDays(shownDate, input.date);

    if (scope === "all" || occurrence === task.date) {
      const start = addDays(task.date, shift);
      const values = taskValues(input, start);
      await tx.update(tareasTasks).set(values).where(eq(tareasTasks.id, task.id));

      if (values.recurrence) {
        // The new values apply to every occurrence; done/deleted states are kept.
        await tx
          .update(tareasTaskExceptions)
          .set({ edited: false, title: null, notes: null, color: null, time: null, date: null })
          .where(eq(tareasTaskExceptions.taskId, task.id));
      } else {
        await tx.delete(tareasTaskExceptions).where(eq(tareasTaskExceptions.taskId, task.id));
      }
      return;
    }

    // "This and following": the original series ends the day before, keeping its history, and a
    // new series (or single task) starts from this occurrence.
    const newTaskId = randomUUID();
    const newStart = addDays(occurrence, shift);
    await tx
      .update(tareasTasks)
      .set({ untilDate: addDays(occurrence, -1), updatedAt: new Date() })
      .where(eq(tareasTasks.id, task.id));
    await tx.insert(tareasTasks).values({ id: newTaskId, userId, ...taskValues(input, newStart) });

    const futureExceptions = and(
      eq(tareasTaskExceptions.taskId, task.id),
      gte(tareasTaskExceptions.occurrenceDate, occurrence),
    );

    if (input.recurrence && newStart === occurrence) {
      // Same start day: keep the done/deleted state of the following occurrences.
      await tx
        .update(tareasTaskExceptions)
        .set({ taskId: newTaskId, edited: false, title: null, notes: null, color: null, time: null, date: null })
        .where(futureExceptions);
    } else {
      await tx.delete(tareasTaskExceptions).where(futureExceptions);
    }
  });
}

export async function deleteTask(userId: string, taskId: string, scope: EditScope, occurrenceDate: IsoDate | null) {
  await db.transaction(async (tx) => {
    const task = await getOwnedTask(userId, taskId, tx);

    if (!task.recurrence || scope === "all") {
      await tx.delete(tareasTasks).where(eq(tareasTasks.id, task.id));
      return;
    }

    const occurrence = requireOccurrence(task, occurrenceDate);

    if (scope === "this") {
      await upsertException(tx, task.id, occurrence, { deleted: true });
      return;
    }

    if (occurrence === task.date) {
      await tx.delete(tareasTasks).where(eq(tareasTasks.id, task.id));
      return;
    }

    await tx
      .update(tareasTasks)
      .set({ untilDate: addDays(occurrence, -1), updatedAt: new Date() })
      .where(eq(tareasTasks.id, task.id));
    await tx
      .delete(tareasTaskExceptions)
      .where(and(eq(tareasTaskExceptions.taskId, task.id), gte(tareasTaskExceptions.occurrenceDate, occurrence)));
  });
}

export async function setTaskDone(userId: string, taskId: string, occurrenceDate: IsoDate | null, done: boolean) {
  const task = await getOwnedTask(userId, taskId);

  if (!task.recurrence) {
    await db.update(tareasTasks).set({ done, updatedAt: new Date() }).where(eq(tareasTasks.id, task.id));
    return;
  }

  await upsertException(db, task.id, requireOccurrence(task, occurrenceDate), { done });
}
