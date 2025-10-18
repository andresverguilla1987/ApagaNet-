// routes/email.js (ESM)
// Admin endpoints to verify and test SMTP, and to demo an alert email.
// Protect with TASK_SECRET compatible header: x-admin-secret (o Bearer/x-task-secret via mapping en server.js)

import express from "express";
import mailerPkg from "../email/mailer.js";

const { verify, sendTest, sendAlertEmail } = mailerPkg.default || mailerPkg;
const router = express.Router();

function requireAdmin(req, res, next) {
  const expected = (process.env.TASK_SECRET || "").trim();
  const provided =
    (req.get("x-admin-secret") || "").trim() ||
    (req.get("x-task-secret") || "").trim() ||
    (() => {
      const h = req.get("authorization") || "";
      return h.startsWith("Bearer ") ? h.slice(7).trim() : "";
    })();

  if (!expected) {
    return res.status(500).json({ ok: false, error: "TASK_SECRET no configurado" });
  }
  if (!provided || provided !== expected) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }
  next();
}

// OJO: server.js monta en /api/email y /email
// Aquí las rutas internas son /verify, /test y /alert-demo
router.get("/verify", requireAdmin, async (_req, res) => {
  try {
    const ok = await verify();
    res.json({ ok: true, info: ok });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

router.post("/test", requireAdmin, async (req, res) => {
  const { to } = req.body || {};
  if (!to) return res.status(400).json({ ok: false, error: "Missing to" });
  try {
    const info = await sendTest(to);
    res.json({ ok: true, id: info?.messageId });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

router.post("/alert-demo", requireAdmin, async (req, res) => {
  const {
    to,
    title,
    level = "warning",
    deviceName = "Dispositivo",
    timeISO = new Date().toISOString(),
    detailsUrl = "https://apaganet.example/app/alerts/1",
  } = req.body || {};
  if (!to) return res.status(400).json({ ok: false, error: "Missing to" });
  try {
    const info = await sendAlertEmail(to, {
      title: title || "Actividad inusual detectada",
      level,
      deviceName,
      timeISO,
      detailsUrl,
    });
    res.json({ ok: true, id: info?.messageId });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

export default router;
