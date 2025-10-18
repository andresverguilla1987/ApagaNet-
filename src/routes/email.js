// src/routes/email.js
import { Router } from "express";
import crypto from "node:crypto";
import emailSvc from "../lib/emailSvc.js";

const r = Router();

function requireAdmin(req, res, next) {
  const admin = (req.headers["x-admin-secret"] || "").toString().trim();
  const expected = (process.env.TASK_SECRET || "").trim();
  if (!expected) return res.status(500).json({ ok:false, error:"TASK_SECRET no configurado" });
  if (!admin || admin !== expected) return res.status(401).json({ ok:false, error:"unauthorized" });
  next();
}

r.get("/api/email/verify", requireAdmin, (req, res) => {
  res.json({ ok:true, info:"ok info" });
});

r.post("/api/email/test", requireAdmin, async (req, res) => {
  try {
    const { to } = req.body || {};
    if (!to) return res.status(400).json({ ok:false, error:"missing to" });
    const id = await emailSvc.sendPlain(to, "Test ApagaNet", "Hola 👋 — prueba SMTP desde ApagaNet.");
    res.json({ ok:true, id });
  } catch (e) {
    res.status(500).json({ ok:false, error: e?.message || String(e) });
  }
});

r.post("/api/email/alert-demo", requireAdmin, async (req, res) => {
  try {
    const { to, title="Actividad inusual", level="info", deviceName="Dispositivo", timeISO=new Date().toISOString(), detailsUrl="#" } = req.body || {};
    if (!to) return res.status(400).json({ ok:false, error:"missing to" });
    const subject = `[ApagaNet] ${level}: ${title}`;
    const text = [
      `Alerta: ${title}`,
      `Nivel: ${level}`,
      `Equipo: ${deviceName}`,
      `Hora: ${timeISO}`,
      `Detalles: ${detailsUrl}`
    ].join("\n");
    const id = await emailSvc.sendPlain(to, subject, text);
    res.json({ ok:true, id });
  } catch (e) {
    res.status(500).json({ ok:false, error: e?.message || String(e) });
  }
});

export default r;
