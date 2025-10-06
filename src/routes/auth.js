// src/routes/auth.js
import express from "express";
import { mem, create } from "../lib/dbMem.js";
const router = express.Router();
router.post("/login", (req, res) => {
  const { email, name } = req.body || {};
  if (!email) return res.status(400).json({ ok: false, error: "email requerido" });
  let user = mem.users.find(u => u.email === email);
  if (!user) user = create("users", { email, name: name || email.split("@")[0], plan: "free", trialEndsAt: null });
  res.json({ ok: true, user });
});
export default router;
