import express from "express";
import { pool } from "../lib/db.js";
const router = express.Router();

router.get("/next-actions", async (req, res) => {
  const homeId = req.query.homeId || req.query.home_id;
  if (!homeId) return res.status(400).json({ ok: false, error: "homeId required" });
  res.json({ ok: true, homeId, actions: [] });
});

router.post("/report", async (req, res) => {
  res.json({ ok: true, stored: (req.body?.events || []).length });
});

export default router;
