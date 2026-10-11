import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

export const isDbConfigured = Boolean(process.env.DATABASE_URL);

export const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL || "postgresql://localhost:5432/ideaforge",
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 3_000,
});

pool.on("error", () => {
  // Prevent unhandled pool idle client errors from crashing the process
});

export const db = drizzle(pool, { schema });

export * from "./schema";
