// routes/geofences.routes.js
import express from "express";

// util: haversine (metros)
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function geofencesRoutes({ pool, auth }) {
  const r = express.Router();

  r.get("/", auth, async (req, res) => {
    try {
      const user_id = req.user?.id || null;
      const { rows } = await pool.query(
        `SELECT * FROM geofences WHERE (user_id=$1 OR user_id IS NULL) ORDER BY id DESC`,
        [user_id]
      );
      res.json({ ok: true, geofences: rows });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: "internal_error" });
    }
  });

  r.post("/", auth, async (req, res) => {
    try {
      const user_id = req.user?.id || null;
      const { name, lat, lng, radius_m, active = true } = req.body || {};
      if (!name || !Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(radius_m)) {
        return res.status(400).json({ ok: false, error: "name, lat, lng, radius_m requeridos" });
      }
      const { rows } = await pool.query(
        `INSERT INTO geofences(user_id,name,lat,lng,radius_m,active) VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,
        [user_id, name, lat, lng, radius_m, !!active]
      );
      res.json({ ok: true, geofence: rows[0] });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: "internal_error" });
    }
  });

  r.delete("/:id", auth, async (req, res) => {
    try {
      const user_id = req.user?.id || null;
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ ok: false, error: "id inválido" });
      await pool.query(`DELETE FROM geofences WHERE id=$1 AND (user_id=$2 OR user_id IS NULL)`, [id, user_id]);
      res.json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: "internal_error" });
    }
  });

  // Check manual: evalúa lat/lng contra geofences activas
  r.post("/check", auth, async (req, res) => {
    try {
      const user_id = req.user?.id || null;
      const { lat, lng } = req.body || {};
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return res.status(400).json({ ok: false, error: "lat, lng requeridos" });
      }
      const { rows: fences } = await pool.query(
        `SELECT * FROM geofences WHERE (user_id=$1 OR user_id IS NULL) AND active=TRUE`,
        [user_id]
      );
      const evals = fences.map(f => {
        const d = haversine(lat, lng, f.lat, f.lng);
        return { id: f.id, name: f.name, distance_m: d, inside: d <= f.radius_m };
      });
      res.json({ ok: true, results: evals });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: "internal_error" });
    }
  });

  return r;
}
