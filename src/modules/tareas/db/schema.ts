// Relative imports on purpose: drizzle-kit loads this file without the `@/` path alias.
import { relations } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

import { user } from "../../../core/db/auth-schema";
import type { Recurrence } from "../lib/recurrence";

// Calendar dates use `date` columns in string mode ("YYYY-MM-DD"): no time zone conversions.

/** A single task, or a recurring series starting on `date` when `recurrence` is set. */
export const tareasTasks = pgTable(
  "tareas_tasks",
  {
    id: text("id").primaryKey(),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    notes: text("notes").notNull().default(""),
    color: text("color"),
    date: date("date", { mode: "string" }).notNull(),
    recurrence: jsonb("recurrence").$type<Recurrence>(),
    untilDate: date("untilDate", { mode: "string" }),
    done: boolean("done").notNull().default(false),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("tareas_tasks_user_date_idx").on(table.userId, table.date)],
);

/** Per-occurrence state of a series: done, deleted or edited (and possibly moved). */
export const tareasTaskExceptions = pgTable(
  "tareas_task_exceptions",
  {
    id: text("id").primaryKey(),
    taskId: text("taskId")
      .notNull()
      .references(() => tareasTasks.id, { onDelete: "cascade" }),
    occurrenceDate: date("occurrenceDate", { mode: "string" }).notNull(),
    done: boolean("done").notNull().default(false),
    deleted: boolean("deleted").notNull().default(false),
    edited: boolean("edited").notNull().default(false),
    title: text("title"),
    notes: text("notes"),
    color: text("color"),
    date: date("date", { mode: "string" }),
  },
  (table) => [uniqueIndex("tareas_task_exceptions_occurrence_idx").on(table.taskId, table.occurrenceDate)],
);

/** Manual order of the tasks shown on one day, as occurrence keys (`taskId:occurrenceDate`). */
export const tareasDayOrders = pgTable(
  "tareas_day_orders",
  {
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    date: date("date", { mode: "string" }).notNull(),
    keys: jsonb("keys").$type<string[]>().notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.date] })],
);

export const tareasCompanies = pgTable(
  "tareas_companies",
  {
    id: text("id").primaryKey(),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("tareas_companies_user_idx").on(table.userId)],
);

export const tareasClosings = pgTable(
  "tareas_closings",
  {
    id: text("id").primaryKey(),
    companyId: text("companyId")
      .notNull()
      .references(() => tareasCompanies.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("tareas_closings_company_idx").on(table.companyId)],
);

/** Checklist rows. Rows with `parentId` are subtasks of that row. */
export const tareasClosingItems = pgTable(
  "tareas_closing_items",
  {
    id: text("id").primaryKey(),
    closingId: text("closingId")
      .notNull()
      .references(() => tareasClosings.id, { onDelete: "cascade" }),
    parentId: text("parentId").references((): AnyPgColumn => tareasClosingItems.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    name: text("name").notNull().default(""),
    done: boolean("done").notNull().default(false),
    notes: text("notes").notNull().default(""),
  },
  (table) => [index("tareas_closing_items_closing_idx").on(table.closingId)],
);

export const tareasTasksRelations = relations(tareasTasks, ({ many }) => ({
  exceptions: many(tareasTaskExceptions),
}));

export const tareasTaskExceptionsRelations = relations(tareasTaskExceptions, ({ one }) => ({
  task: one(tareasTasks, { fields: [tareasTaskExceptions.taskId], references: [tareasTasks.id] }),
}));

export const tareasCompaniesRelations = relations(tareasCompanies, ({ many }) => ({
  closings: many(tareasClosings),
}));

export const tareasClosingsRelations = relations(tareasClosings, ({ one, many }) => ({
  company: one(tareasCompanies, { fields: [tareasClosings.companyId], references: [tareasCompanies.id] }),
  items: many(tareasClosingItems),
}));

export const tareasClosingItemsRelations = relations(tareasClosingItems, ({ one }) => ({
  closing: one(tareasClosings, { fields: [tareasClosingItems.closingId], references: [tareasClosings.id] }),
}));
