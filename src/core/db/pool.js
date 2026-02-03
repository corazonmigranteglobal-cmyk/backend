import pg from "pg";
const { Pool } = pg;

function pick(...vals) {
  for (const v of vals) {
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return undefined;
}

const host = pick(process.env.PGHOST, process.env.DB_HOST);
const port = Number(pick(process.env.PGPORT, process.env.DB_PORT, 5432));
const user = pick(process.env.PGUSER, process.env.DB_USER);
const database = pick(process.env.PGDATABASE, process.env.DB_NAME);

const passwordRaw = pick(process.env.PGPASSWORD, process.env.DB_PASSWORD);
const password = passwordRaw !== undefined ? String(passwordRaw) : "";

if (!host) throw new Error("Missing env: PGHOST/DB_HOST");
if (!user) throw new Error("Missing env: PGUSER/DB_USER");
if (!database) throw new Error("Missing env: PGDATABASE/DB_NAME");
if (!password) throw new Error("Missing env: PGPASSWORD/DB_PASSWORD");

export const pool = new Pool({
  host,
  port,
  user,
  password,
  database,
  max: Number(process.env.PGPOOL_MAX || 10),
  idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT || 30000),
  connectionTimeoutMillis: Number(process.env.PG_CONN_TIMEOUT || 7500),
  ssl:
    String(process.env.PGSSL ?? process.env.DB_SSL ?? "true").toLowerCase() === "true"
      ? { rejectUnauthorized: false }
      : undefined,
});
