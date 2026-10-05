// Relative imports on purpose: drizzle-kit loads this file without the `@/` path alias.
import { relations } from "drizzle-orm";
import { index, integer, numeric, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

import { user } from "../../../core/db/auth-schema";

// Table names predate the module convention (`<moduleId>_<table>`); renaming them needs a migration.
export const reports = pgTable(
  "reports",
  {
    id: text("id").primaryKey(),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    fileName: text("fileName").notNull(),
    sourceRowCount: integer("sourceRowCount").notNull(),
    filteredRowCount: integer("filteredRowCount").notNull(),
    groupCount: integer("groupCount").notNull(),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("reports_user_id_idx").on(table.userId),
    index("reports_created_at_idx").on(table.createdAt),
  ],
);

export const reportRows = pgTable(
  "report_rows",
  {
    id: text("id").primaryKey(),
    reportId: text("reportId")
      .notNull()
      .references(() => reports.id, { onDelete: "cascade" }),
    accountCode: text("accountCode").notNull(),
    teamsExternalId: text("teamsExternalId").notNull(),
    expenseOwnerId: text("expenseOwnerId").notNull(),
    expenseOwner: text("expenseOwner").notNull(),
    totalAgrupadoEur: numeric("totalAgrupadoEur", { precision: 14, scale: 2 }).notNull(),
  },
  (table) => [
    index("report_rows_report_id_idx").on(table.reportId),
    uniqueIndex("report_rows_unique_group_idx").on(
      table.reportId,
      table.accountCode,
      table.teamsExternalId,
      table.expenseOwnerId,
      table.expenseOwner,
    ),
  ],
);

export const reportsRelations = relations(reports, ({ one, many }) => ({
  user: one(user, {
    fields: [reports.userId],
    references: [user.id],
  }),
  rows: many(reportRows),
}));

export const reportRowsRelations = relations(reportRows, ({ one }) => ({
  report: one(reports, {
    fields: [reportRows.reportId],
    references: [reports.id],
  }),
}));
