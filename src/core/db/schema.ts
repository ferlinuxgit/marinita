// Full database schema: core auth tables plus the tables of every module.
// Used by the runtime `db` client and by drizzle-kit to generate migrations.
// When a module adds tables, export its `db/schema.ts` here (relative path: drizzle-kit has no `@/`).
export * from "./auth-schema";
export * from "../../modules/gastos/db/schema";
export * from "../../modules/tareas/db/schema";
