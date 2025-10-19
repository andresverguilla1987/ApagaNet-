// server.js (ApagaNet Backend PRO — SIMPLE)
// Requisitos: Node 18+, "type": "module" en package.json

import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { customAlphabet } from 'nanoid';
import Stripe from 'stripe';

dotenv.config();
const app = express();
app.use(morgan('dev'));

// ──────────────────────────────────────────────────────────────────────────────
// CORS
// ALLOWED_ORIGINS debe ser JSON array. Ej:
// ["https://resplendent-biscotti-14ad94.netlify.app", "http://localhost:5173"]
// Usa ["*"] para permitir todo (solo para pruebas).
// ──────────────────────────────────────────────────────────────────────────────
const allowed = process.env.ALLOWED_ORIGINS ? JSON.parse(process.env.ALLOWED_ORIGINS) : ["*"];
app.use(cors({
  origin: (origin, cb) => {
    // Permite null/undefined (curl, apps nativas) y "*"
    if (!origin || allowed.includes('*') || allowed.includes(origin)) return cb(null, true);
    return cb(new Error('CORS: Origin not allowed: ' + origin));
  },
  credentials: true
}));
app.options('*', cors()); // preflight

// ──────────────────────────────────────────────────────────────────────────────
// Estado en memoria (demo). En producción, reemplazar con DB.
// ──────────────────────────────────────────────────────────────────────────────
const state = {
  homes: new Map(), // homeId -> { devices: Map, alerts:[], geofences:[], locations: Map(deviceId -> [points]), guard: Map(deviceId -> guardState) }
  actions: [],
  signups: [],
  customers: new Map(),
  subscriptions: []
};
const nanoid = customAlphabet('1234567890abcdefghijklmnopqrstuvwxyz', 10);

// Stripe / ENV
const JWT_SECRET = process.env.JWT_SECRET || 'demo_jwt_secret_change_me';
const TASK_SECRET = process.env.TASK_SECRET || 'demo_task_secret_change_me';
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_PRICE_ID   = process.env.STRIPE_PRICE_ID   || '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' }) : null;

// Helpers
function ensureHome(homeId) {
  if (!state.homes.has(homeId)) {
    state.homes.set(homeId, {
      devices: new Map(),
      alerts: [],
      geofences: [],                    // {id,name,lat,lng,radiusMeters}
      locations: new Map(),             // deviceId -> [{lat,lng,accuracy,at}]
      guard: new Map()                  // deviceId -> {inside?, counter}
    });
  }
  return state.homes.get(homeId);
}
function authTask(req, res, next) {
  const header = req.get('x-task-secret');
  if (header && header === TASK_SECRET) return next();
  res.status(401).json({ error: 'Unauthorized (task)' });
}
function authJWT(req, res, next) {
  const auth = req.get('authorization') || '';
  if (!auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing bearer token' });
  try {
    const token = auth.slice(7);
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// Health
app.get(['/', '/api/health', '/api/ping'], (req, res) => {
  res.json({ ok: true, time: new Date().toISOString(), service: 'ApagaNet Backend PRO (simple/locations)' });
});

// ──────────────────────────────────────────────────────────────────────────────
// 1) Webhook Stripe (raw body antes de json)
// ──────────────────────────────────────────────────────────────────────────────
app.post('/webhooks/stripe', express.raw({ type: 'application/json' }), (req, res) => {
  try {
    if (stripe && STRIPE_WEBHOOK_SECRET) {
      const sig = req.headers['stripe-signature'];
      stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET); // valida firma
    }
    console.log('Stripe webhook ok');
  } catch (e) {
    console.error('stripe webhook error:', e.message);
    return res.status(400).send(`Webhook Error: ${e.message}`);
  }
  res.json({ received: true });
});

// A partir de aquí parseamos JSON normal
app.use(express.json({ limit: '1mb' }));

// ──────────────────────────────────────────────────────────────────────────────
// Auth demo (admin)
// ──────────────────────────────────────────────────────────────────────────────
app.post('/auth/demo-token', (req, res) => {
  const { homeId = 'HOME-DEMO-1' } = req.body || {};
  const token = jwt.sign({ role: 'admin', homeId }, JWT_SECRET, { expiresIn: '2h' });
  res.json({ token, homeId });
});

// ──────────────────────────────────────────────────────────────────────────────
// Devices (demo)
// ──────────────────────────────────────────────────────────────────────────────
app.get('/devices', authJWT, (req, res) => {
  const home = ensureHome(req.user.homeId);
  const devices = Array.from(home.devices.values()).sort((a, b) => b.lastSeen - a.lastSeen);
  res.json({ devices });
});

// Pausar / Reanudar
app.post('/control/pause', authJWT, (req, res) => {
  const { mac, minutes = 15 } = req.body || {};
  if (!mac) return res.status(400).json({ error: 'mac required' });
  const home = ensureHome(req.user.homeId);
  const dev = home.devices.get(mac);
  if (!dev) return res.status(404).json({ error: 'device not found' });
  const until = Date.now() + minutes * 60 * 1000;
  dev.pausedUntil = until;
  home.alerts.unshift({
    id: nanoid(), homeId: req.user.homeId, type: 'pause',
    message: `Se pausó ${dev.name || mac} por ${minutes} min`,
    createdAt: Date.now(), read: false
  });
  res.json({ ok: true, until });
});
app.post('/control/resume', authJWT, (req, res) => {
  const { mac } = req.body || {};
  if (!mac) return res.status(400).json({ error: 'mac required' });
  const home = ensureHome(req.user.homeId);
  const dev = home.devices.get(mac);
  if (!dev) return res.status(404).json({ error: 'device not found' });
  dev.pausedUntil = 0;
  res.json({ ok: true });
});

// Alerts
app.get('/alerts', authJWT, (req, res) => {
  const home = ensureHome(req.user.homeId);
  res.json({ alerts: home.alerts });
});

// ──────────────────────────────────────────────────────────────────────────────
// Locations & Geofences (modo simple)
// - accuracy > 100 m se ignora (ruido)
// - hysteresis: salir si d > r+50, entrar si d < r-20
// - 3 muestras consecutivas para confirmar enter/exit
// ──────────────────────────────────────────────────────────────────────────────
const HYST_ENTER = 20;   // m
const HYST_EXIT  = 50;   // m
const MIN_ACC    = 100;  // m
const MIN_SAMPLES = 3;   // consecutivas

// Haversine
function distMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Reportar punto (abierto para el agente/app)
app.post('/locations/report', (req, res) => {
  const { homeId, deviceId, lat, lng, accuracy = 30, battery = null, at = null } = req.body || {};
  if (!homeId || !deviceId || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ error: 'homeId, deviceId, lat, lng required' });
  }
  if (accuracy != null && accuracy > MIN_ACC) {
    return res.json({ ok: true, ignored: true, reason: 'low_accuracy' });
  }

  const home = ensureHome(homeId);
  const t = at ? +at : Date.now();
  const point = { id: nanoid(), deviceId, lat, lng, accuracy, battery, at: t };

  if (!home.locations.has(deviceId)) home.locations.set(deviceId, []);
  const list = home.locations.get(deviceId);
  list.push(point);
  if (list.length > 1000) list.splice(0, list.length - 1000);

  // Eval geocerca primaria: "Casa" (si existe)
  const homeFence = home.geofences.find(g => (g.name || '').toLowerCase() === 'casa');
  if (homeFence) {
    const d = distMeters(lat, lng, homeFence.lat, homeFence.lng);
    const guard = home.guard.get(deviceId) || { inside: null, counter: 0 };

    const insideNow  = d <= (homeFence.radiusMeters - HYST_ENTER);
    const outsideNow = d >= (homeFence.radiusMeters + HYST_EXIT);
    let newInside = guard.inside;

    if (guard.inside === true) { if (outsideNow) newInside = false; }
    else if (guard.inside === false) { if (insideNow) newInside = true; }
    else { newInside = d <= homeFence.radiusMeters; }

    if (newInside !== guard.inside) {
      guard.counter += 1;
      if (guard.counter >= MIN_SAMPLES) {
        // Confirmado enter/exit
        guard.inside = newInside;
        guard.counter = 0;
        home.alerts.unshift({
          id: nanoid(), homeId,
          type: newInside ? 'geofence_enter' : 'geofence_exit',
          message: newInside ? `${deviceId} llegó a Casa` : `${deviceId} salió de Casa`,
          createdAt: t, read: false
        });
      }
    } else {
      guard.counter = 0;
    }
    home.guard.set(deviceId, guard);
  }

  res.json({ ok: true });
});

// Último punto (protegido)
app.get('/locations/live', authJWT, (req, res) => {
  const home = ensureHome(req.user.homeId);
  const { deviceId } = req.query;
  if (!deviceId) return res.status(400).json({ error: 'deviceId required' });
  const list = home.locations.get(deviceId) || [];
  res.json({ live: list[list.length - 1] || null });
});

// Historial simple (24h por defecto)
app.get('/locations/history', authJWT, (req, res) => {
  const home = ensureHome(req.user.homeId);
  const { deviceId, hours = 24 } = req.query;
  if (!deviceId) return res.status(400).json({ error: 'deviceId required' });
  const since = Date.now() - Number(hours) * 60 * 60 * 1000;
  const list = (home.locations.get(deviceId) || [])
    .filter(p => p.at >= since && (p.accuracy == null || p.accuracy <= MIN_ACC));
  res.json({ points: list });
});

// Geocercas
app.get('/geofences', authJWT, (req, res) => {
  const home = ensureHome(req.user.homeId);
  res.json({ geofences: home.geofences });
});
app.post('/geofences', authJWT, (req, res) => {
  const { name, lat, lng, radiusMeters = 200 } = req.body || {};
  if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ error: 'name, lat, lng required' });
  }
  const home = ensureHome(req.user.homeId);
  const gf = { id: nanoid(), name, lat, lng, radiusMeters };
  home.geofences.push(gf);
  res.json({ ok: true, geofence: gf });
});
app.delete('/geofences/:id', authJWT, (req, res) => {
  const home = ensureHome(req.user.homeId);
  const { id } = req.params;
  home.geofences = home.geofences.filter(g => g.id !== id);
  res.json({ ok: true });
});

// Upsert rápido de "Casa" moviendo el mapa (para UI simple)
app.post('/geofences/upsert-home', authJWT, (req, res) => {
  const { lat, lng, radiusMeters = 200 } = req.body || {};
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ error: 'lat, lng required' });
  }
  const home = ensureHome(req.user.homeId);
  const idx = home.geofences.findIndex(g => (g.name || '').toLowerCase() === 'casa');
  const gf = { id: nanoid(), name: 'Casa', lat, lng, radiusMeters };
  if (idx >= 0) home.geofences[idx] = { ...gf, id: home.geofences[idx].id };
  else home.geofences.push(gf);
  res.json({ ok: true, geofence: idx >= 0 ? home.geofences[idx] : gf });
});

// ──────────────────────────────────────────────────────────────────────────────
// Público: signup + billing (Checkout)
// ──────────────────────────────────────────────────────────────────────────────
app.post('/public/signup', (req, res) => {
  const { email, family } = req.body || {};
  if (!email) return res.status(400).json({ error: 'email required' });
  state.signups.push({ email, family: family || '', createdAt: Date.now() });
  res.json({ ok: true });
});

app.post('/billing/checkout', async (req, res) => {
  try {
    if (!stripe || !STRIPE_PRICE_ID) return res.status(503).json({ error: 'billing not configured' });
    const { email, origin } = req.body || {};
    if (!email) return res.status(400).json({ error: 'email required' });

    const base = (origin || process.env.PUBLIC_ORIGIN || '').replace(/\/$/, '');
    const success = base ? `${base}/?status=success` : 'https://example.com/?status=success';
    const cancel  = base ? `${base}/?status=cancel`  : 'https://example.com/?status=cancel';

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }],
      customer_email: email,
      success_url: success,
      cancel_url: cancel,
      metadata: { product: 'ApagaNet Single Plan' }
    });
    res.json({ url: session.url });
  } catch (e) {
    console.error('checkout error', e);
    res.status(500).json({ error: 'checkout_failed' });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// Seed demo
// ──────────────────────────────────────────────────────────────────────────────
(function seed() {
  const homeId = 'HOME-DEMO-1';
  const h = ensureHome(homeId);
  const now = Date.now();
  ['AA:BB:CC:11:22:33', 'DE:AD:BE:EF:00:01', 'CA:FE:BA:BE:12:34'].forEach((mac, i) => {
    h.devices.set(mac, {
      mac,
      name: ['Tablet Diego', 'Nintendo Switch', 'Laptop Mamá'][i],
      ip: '192.168.0.' + (10 + i),
      online: true,
      lastSeen: now,
      pausedUntil: 0
    });
  });
  // Geocerca ejemplo (Escuela)
  h.geofences.push({ id: nanoid(), name: 'Escuela', lat: 19.4326, lng: -99.1332, radiusMeters: 250 });
})();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('ApagaNet Backend PRO (simple/locations) on :' + PORT));
