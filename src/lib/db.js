// src/lib/db.js — PG Pool
import pkg from "pg";
const { Pool } = pkg;

const connectionString = process.env.DATABASE_URL;
const ssl = process.env.PGSSL === "disable" ? false : { rejectUnauthorized: false };

export const pool = new Pool({
  connectionString,
  ssl
});

pool.on("error", (err) => {
  console.error("[pg] pool error", err);
});
