// routes/locations.routes.js
import express from "express";

// util: haversine (metros)
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function locationsRoutes({ pool, auth, createAlert }) {
  const r = express.Router();

  // Reportar ubicación
  r.post("/report", auth, async (req, res) => {
    try {
      const { device_id, lat, lng, accuracy } = req.body || {};
      if (!device_id || !Number.isFinite(lat) || !Number.isFinite(lng)) {
        return res.status(400).json({ ok: false, error: "device_id, lat, lng requeridos" });
      }
      const user_id = req.user?.id || null;
      const q = `INSERT INTO locations(device_id, user_id, lat, lng, accuracy) VALUES($1,$2,$3,$4,$5) RETURNING *`;
      const { rows } = await pool.query(q, [device_id, user_id, lat, lng, accuracy ?? null]);
      const location = rows[0];
      res.json({ ok: true, location });

      // Trigger geofence alerts (best-effort, no await on response)
      try {
        const { rows: fences } = await pool.query(
          `SELECT * FROM geofences WHERE (user_id=$1 OR user_id IS NULL) AND active=TRUE`,
          [user_id]
        );
        for (const f of fences) {
          const d = haversine(lat, lng, f.lat, f.lng); // meters
          if (d > f.radius_m) {
            if (typeof createAlert === "function") {
              await createAlert({
                user_id,
                device_id,
                type: "geofence_exit",
                message: `Fuera de zona segura: ${f.name} (${Math.round(d)}m > ${f.radius_m}m)`
              });
            } else {
              console.log("[locations] geofence_exit", { user_id, device_id, fence: f.name, distance_m: Math.round(d) });
            }
          }
        }
      } catch (e) {
        console.warn("[locations] geofence check error:", e.message);
      }
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: "internal_error" });
    }
  });

  // Última ubicación por device_id
  r.get("/latest", auth, async (req, res) => {
    try {
      const { device_id } = req.query;
      if (!device_id) return res.status(400).json({ ok: false, error: "device_id requerido" });
      const q = `SELECT * FROM locations WHERE device_id=$1 ORDER BY ts DESC LIMIT 1`;
      const { rows } = await pool.query(q, [device_id]);
      res.json({ ok: true, location: rows[0] || null });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: "internal_error" });
    }
  });

  return r;
}
