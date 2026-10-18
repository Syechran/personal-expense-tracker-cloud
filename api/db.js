import { readFileSync } from "node:fs";
import pg from "pg";

const { Pool } = pg;

pg.types.setTypeParser(20, (value) => Number(value));

if (!process.env.DATABASE_URL) {
  console.warn(
    "[db] DATABASE_URL belum diset. Salin .env.example menjadi .env lalu sesuaikan nilainya."
  );
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.DATABASE_SSL === "true"
      ? { rejectUnauthorized: false }
      : undefined,
  max: Number(process.env.PG_POOL_MAX || 10),
  idleTimeoutMillis: 30_000,
});

export async function ensureSchema() {
  const schema = readFileSync(new URL("./schema.sql", import.meta.url), "utf8");
  await pool.query(schema);
}

export async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export const DEFAULT_ACCOUNTS = [
  { name: "Bank", type: "bank" },
  { name: "Cash", type: "cash" },
  { name: "E-Wallet", type: "ewallet" },
];

export const DEFAULT_CATEGORIES = [
  "Food",
  "Shoppings",
  "Utilities",
  "Transport",
  "Entertainment",
  "Other",
];
