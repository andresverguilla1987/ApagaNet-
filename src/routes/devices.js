// src/routes/devices.js
import express from "express";
import { mem, create, listBy, updateById, removeById } from "../lib/dbMem.js";
const router = express.Router();
router.get("/", (req, res) => {
  const userId = req.headers["x-user-id"];
  if (!userId) return res.status(401).json({ ok: false, error: "x-user-id requerido" });
  res.json({ ok: true, devices: listBy("devices", { userId }) });
});
router.post("/", (req, res) => {
  const userId = req.headers["x-user-id"];
  const { name, mac, vendor } = req.body || {};
  if (!userId) return res.status(401).json({ ok: false, error: "x-user-id requerido" });
  if (!name || !mac) return res.status(400).json({ ok: false, error: "name y mac requeridos" });
  const d = create("devices", { userId, name, mac: mac.toUpperCase(), vendor: vendor || null });
  res.json({ ok: true, device: d });
});
router.patch("/:id", (req, res) => {
  const userId = req.headers["x-user-id"];
  const { id } = req.params;
  const device = mem.devices.find(d => d.id === id);
  if (!device || device.userId !== userId) return res.status(404).json({ ok: false, error: "no encontrado" });
  const out = updateById("devices", id, req.body || {});
  res.json({ ok: true, device: out });
});
router.delete("/:id", (req, res) => {
  const userId = req.headers["x-user-id"];
  const { id } = req.params;
  const device = mem.devices.find(d => d.id === id);
  if (!device || device.userId !== userId) return res.status(404).json({ ok: false, error: "no encontrado" });
  const ok = removeById("devices", id);
  res.json({ ok });
});
export default router;
