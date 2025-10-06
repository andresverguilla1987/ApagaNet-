import pg from "pg";
const { Pool } = pg;

const cn = process.env.DATABASE_URL;
if (!cn) throw new Error("Missing DATABASE_URL");

export const pool = new Pool({
  connectionString: cn,
  ssl: cn.includes("render.com") ? { rejectUnauthorized: false } : undefined
});
