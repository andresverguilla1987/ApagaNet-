// src/routes/schedules.js
import express from "express";
import { mem, create, listBy, updateById, removeById } from "../lib/dbMem.js";
const router = express.Router();
router.get("/", (req, res) => {
  const userId = req.headers["x-user-id"];
  if (!userId) return res.status(401).json({ ok: false, error: "x-user-id requerido" });
  res.json({ ok: true, schedules: listBy("schedules", { userId }) });
});
router.post("/", (req, res) => {
  const userId = req.headers["x-user-id"];
  const { deviceId, blockFrom, blockTo, days, active } = req.body || {};
  if (!userId) return res.status(401).json({ ok: false, error: "x-user-id requerido" });
  if (!deviceId || !blockFrom || !blockTo) return res.status(400).json({ ok: false, error: "faltan campos" });
  const s = create("schedules", { userId, deviceId, blockFrom, blockTo, days: days || [1,2,3,4,5,6,7], active: active ?? true });
  res.json({ ok: true, schedule: s });
});
router.patch("/:id", (req, res) => {
  const userId = req.headers["x-user-id"];
  const { id } = req.params;
  const row = mem.schedules.find(r => r.id === id);
  if (!row || row.userId !== userId) return res.status(404).json({ ok: false, error: "no encontrado" });
  const out = updateById("schedules", id, req.body || {});
  res.json({ ok: true, schedule: out });
});
router.delete("/:id", (req, res) => {
  const userId = req.headers["x-user-id"];
  const { id } = req.params;
  const row = mem.schedules.find(r => r.id === id);
  if (!row || row.userId !== userId) return res.status(404).json({ ok: false, error: "no encontrado" });
  const ok = removeById("schedules", id);
  res.json({ ok });
});
export default router;
