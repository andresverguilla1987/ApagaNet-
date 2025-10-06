// scripts/migrate.js — simple migration runner
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "../src/lib/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  const sql = await readFile(path.join(__dirname, "../src/migrations/001_init.sql"), "utf8");
  await pool.query(sql);
  console.log("✅ Migration applied");
  process.exit(0);
}

run().catch(err => {
  console.error("❌ Migration failed", err);
  process.exit(1);
});
