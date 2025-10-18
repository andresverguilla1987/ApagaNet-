import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { customAlphabet } from 'nanoid';

dotenv.config();
const app = express();
app.use(express.json());
app.use(morgan('dev'));

// CORS
const allowed = process.env.ALLOWED_ORIGINS ? JSON.parse(process.env.ALLOWED_ORIGINS) : ["*"];
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowed.includes("*") || allowed.includes(origin)) return cb(null, true);
    return cb(new Error("CORS: Origin not allowed: " + origin));
  },
  credentials: true
}));

// Demo in-memory stores
const state = {
  homes: new Map(),   // homeId -> { devices: Map(mac -> device), modem, alerts: [] }
  actions: []         // queued actions for agents
};
const nanoid = customAlphabet('1234567890abcdefghijklmnopqrstuvwxyz', 10);

const JWT_SECRET = process.env.JWT_SECRET || 'demo_jwt_secret_change_me';
const TASK_SECRET = process.env.TASK_SECRET || 'demo_task_secret_change_me';

function ensureHome(homeId) {
  if (!state.homes.has(homeId)) {
    state.homes.set(homeId, { devices: new Map(), modem: null, alerts: [] });
  }
  return state.homes.get(homeId);
}

function authTask(req, res, next) {
  const header = req.get('x-task-secret');
  if (header && header === TASK_SECRET) return next();
  res.status(401).json({ error: 'Unauthorized (task)' });
}

function authJWT(req, res, next) {
  const auth = req.get('authorization');
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing bearer token' });
  try {
    const token = auth.slice(7);
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (e) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// Issue a demo admin token (no users/db for this demo)
app.post('/auth/demo-token', (req, res) => {
  const { homeId = 'HOME-DEMO-1' } = req.body || {};
  const token = jwt.sign({ role: 'admin', homeId }, JWT_SECRET, { expiresIn: '2h' });
  res.json({ token, homeId });
});

// Health
app.get(['/','/api/health','/api/ping'], (req, res) => {
  res.json({ ok: true, time: new Date().toISOString(), service: 'ApagaNet Demo Backend' });
});

// Agent reports devices + modem
app.post('/agents/report', authTask, (req, res) => {
  const { homeId, devices = [], modem = null } = req.body || {};
  if (!homeId) return res.status(400).json({ error: 'homeId required' });
  const home = ensureHome(homeId);
  if (modem) home.modem = modem;
  const now = Date.now();
  devices.forEach(d => {
    const mac = (d.mac || '').toUpperCase();
    if (!mac) return;
    const prev = home.devices.get(mac) || {};
    home.devices.set(mac, {
      mac,
      ip: d.ip || prev.ip || null,
      name: d.name || prev.name || 'Unknown',
      online: typeof d.online === 'boolean' ? d.online : true,
      lastSeen: now,
      pausedUntil: prev.pausedUntil || 0
    });
  });
  return res.json({ ok: true, deviceCount: home.devices.size });
});

// Agent polls actions
app.get('/agents/next-actions', authTask, (req, res) => {
  const { homeId } = req.query;
  if (!homeId) return res.status(400).json({ error: 'homeId required' });
  const out = state.actions.filter(a => a.homeId === homeId);
  // Empty queue after delivering (demo behavior)
  state.actions = state.actions.filter(a => a.homeId !== homeId);
  res.json({ actions: out });
});

// List devices for dashboard (admin)
app.get('/devices', authJWT, (req, res) => {
  const homeId = req.user.homeId;
  const home = ensureHome(homeId);
  const devices = Array.from(home.devices.values()).sort((a,b) => b.lastSeen - a.lastSeen);
  res.json({ devices });
});

// Issue "pause internet" action and create alert
app.post('/control/pause', authJWT, (req, res) => {
  const homeId = req.user.homeId;
  const { mac, minutes = 15 } = req.body || {};
  if (!mac) return res.status(400).json({ error: 'mac required' });
  const home = ensureHome(homeId);
  const dev = home.devices.get(mac.toUpperCase());
  if (!dev) return res.status(404).json({ error: 'device not found' });
  const until = Date.now() + minutes*60*1000;
  dev.pausedUntil = until;
  // Queue action for agent (router)
  state.actions.push({ id: nanoid(), homeId, kind: 'PAUSE', mac: dev.mac, until });
  // Create alert
  const alert = { id: nanoid(), homeId, type: 'pause', message: `Internet pausado para ${dev.name} (${dev.mac}) por ${minutes} min`, createdAt: Date.now(), read: false };
  home.alerts.unshift(alert);
  res.json({ ok: true, actionQueued: true, alert });
});

// Alerts (list & mark read) - admin
app.get('/alerts', authJWT, (req, res) => {
  const homeId = req.user.homeId;
  const home = ensureHome(homeId);
  res.json({ alerts: home.alerts });
});
app.patch('/alerts/:id/read', authJWT, (req, res) => {
  const homeId = req.user.homeId;
  const { id } = req.params;
  const home = ensureHome(homeId);
  const a = home.alerts.find(x => x.id === id);
  if (!a) return res.status(404).json({ error: 'not found' });
  a.read = true;
  res.json({ ok: true });
});

// A tiny seeded scenario for immediate demo
function seed() {
  const homeId = 'HOME-DEMO-1';
  const home = ensureHome(homeId);
  const now = Date.now();
  const sample = [
    { mac:'AA:BB:CC:11:22:33', ip:'192.168.0.10', name:'Tablet de Diego', online:true },
    { mac:'DE:AD:BE:EF:00:01', ip:'192.168.0.11', name:'Nintendo Switch', online:true },
    { mac:'CA:FE:BA:BE:12:34', ip:'192.168.0.12', name:'Laptop Mamá', online:true }
  ];
  sample.forEach(d => home.devices.set(d.mac, { ...d, lastSeen: now, pausedUntil: 0 }));
  home.modem = { brand:'TP-Link', model:'Archer AX50' };
  home.alerts = [ { id: nanoid(), homeId, type:'info', message:'Demo lista — conecta el agente cuando quieras.', createdAt: now, read:false } ];
}
seed();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('ApagaNet Demo Backend listening on :' + PORT);
});
