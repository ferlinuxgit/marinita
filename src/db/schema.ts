import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("emailVerified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expiresAt", { mode: "date" }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
    ipAddress: text("ipAddress"),
    userAgent: text("userAgent"),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_user_id_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("accountId").notNull(),
    providerId: text("providerId").notNull(),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("accessToken"),
    refreshToken: text("refreshToken"),
    idToken: text("idToken"),
    accessTokenExpiresAt: timestamp("accessTokenExpiresAt", { mode: "date" }),
    refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt", { mode: "date" }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("account_user_id_idx").on(table.userId)],
);

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expiresAt", { mode: "date" }).notNull(),
  createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
});

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

export const userRelations = relations(user, ({ many }) => ({
  reports: many(reports),
}));

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

export type ReportRow = typeof reportRows.$inferSelect;
