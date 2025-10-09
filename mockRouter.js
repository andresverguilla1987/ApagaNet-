// --- MOCK ENDPOINT: agrega equipos de prueba ---
import express from "express";
import crypto from "node:crypto";

const mockRouter = express.Router();

let mockDevices = [];

// Endpoint para agregar dispositivos de prueba
mockRouter.post("/mock-add", (req, res) => {
  const samples = [
    { id: crypto.randomUUID(), name: "Laptop-Andres", ip: "192.168.0.5" },
    { id: crypto.randomUUID(), name: "Galaxy-S21", ip: "192.168.0.10" },
    { id: crypto.randomUUID(), name: "SmartTV-Sala", ip: "192.168.0.22" },
  ];
  mockDevices = samples;
  res.json({ ok: true, added: samples.length, devices: samples });
});

// Endpoint para devolver dispositivos actuales simulados
mockRouter.get("/devices/latest", (req, res) => {
  const agent_id = String(req.query.agent_id || "");
  res.json({
    ok: true,
    report: { id: crypto.randomUUID(), agent_id, created_at: new Date().toISOString() },
    devices: mockDevices,
    fallback: false,
  });
});

// Endpoint para pausar / reanudar dispositivos simulados
mockRouter.post("/devices/:action", express.json(), (req, res) => {
  const { action } = req.params;
  const { device_id } = req.body;
  res.json({ ok: true, action, device_id, time: new Date().toISOString() });
});

export default mockRouter;
