/**
 * scripts/migrate.js
 * Ejecuta todos los .sql en src/sql/ en orden (por nombre).
 * Uso:
 *   DATABASE_URL=postgresql://user:pass@host/db node scripts/migrate.js
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dir = path.resolve(__dirname, "..", "src", "sql");
const files = fs.readdirSync(dir)
  .filter(f => f.endsWith(".sql"))
  .sort();

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL no definido");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: url });

(async () => {
  const client = await pool.connect();
  try {
    for (const f of files) {
      const p = path.join(dir, f);
      const sql = fs.readFileSync(p, "utf8");
      console.log("==> Ejecutando", f);
      await client.query(sql);
    }
    console.log("Migraciones completadas.");
  } catch (e) {
    console.error("Error en migraciones:", e);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
})();
