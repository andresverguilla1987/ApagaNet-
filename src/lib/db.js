import pg from "pg";
const { Pool } = pg;

const cn = process.env.DATABASE_URL;
export const pool = new Pool({
  connectionString: cn,
  max: 8,
  idleTimeoutMillis: 30_000,
  ssl: cn && !cn.includes("localhost") ? { rejectUnauthorized: false } : undefined
});
