import { migrate } from "drizzle-orm/node-postgres/migrator";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required to run migrations");
}

const pool = new pg.Pool({
  connectionString,
  max: 1,
});

try {
  const db = drizzle(pool);
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Database migrations applied");
} finally {
  await pool.end();
}
