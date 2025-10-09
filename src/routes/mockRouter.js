// src/routes/mockRouter.js
import express from "express";
import crypto from "node:crypto";

const mockRouter = express.Router();

let mockDevices = [];

// Crea 3 dispositivos de prueba
mockRouter.post("/mock-add", (_req, res) => {
  const samples = [
    { id: crypto.randomUUID(), name: "Laptop-Andres", ip: "192.168.0.5" },
    { id: crypto.randomUUID(), name: "Galaxy-S21", ip: "192.168.0.10" },
    { id: crypto.randomUUID(), name: "SmartTV-Sala", ip: "192.168.0.22" },
  ];
  mockDevices = samples;
  res.json({ ok: true, added: samples.length, devices: samples });
});

// Lista los dispositivos simulados
mockRouter.get("/devices/latest", (req, res) => {
  const agent_id = String(req.query.agent_id || "");
  res.json({
    ok: true,
    report: { id: crypto.randomUUID(), agent_id, created_at: new Date().toISOString() },
    devices: mockDevices,
    fallback: false,
  });
});

// Simula pausa/reanuda
mockRouter.post("/devices/:action", express.json(), (req, res) => {
  const { action } = req.params;
  const { device_id, agent_id, minutes = 15 } = req.body || {};
  res.json({ ok: true, action, agent_id, device_id, minutes, time: new Date().toISOString() });
});

export default mockRouter;
