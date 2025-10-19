// server.notify.pg.js — ApagaNet Backend (Postgres persistence + notifications)
// Requisitos: Node 18+, "type": "module" en package.json
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { customAlphabet } from 'nanoid';
import Stripe from 'stripe';
import fetch from 'node-fetch';
import nodemailer from 'nodemailer';
import pkg from 'pg';

dotenv.config();
const { Pool } = pkg;

const app = express();
app.use(morgan('dev'));

// CORS
const allowed = process.env.ALLOWED_ORIGINS ? JSON.parse(process.env.ALLOWED_ORIGINS) : ["*"];
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowed.includes('*') || allowed.includes(origin)) return cb(null, true);
    return cb(new Error('CORS: Origin not allowed: ' + origin));
  },
  credentials: true
}));
app.options('*', cors());

// ENV / Stripe
const JWT_SECRET = process.env.JWT_SECRET || 'demo_jwt_secret_change_me';
const STRIPE_SECRET_KEY   = process.env.STRIPE_SECRET_KEY   || '';
const STRIPE_PRICE_ID     = process.env.STRIPE_PRICE_ID     || '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' }) : null;

// Notifications ENV
const NOTIFY_WEBHOOK_URL = process.env.NOTIFY_WEBHOOK_URL || '';
const SLACK_WEBHOOK_URL  = process.env.SLACK_WEBHOOK_URL  || '';
const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = +(process.env.SMTP_PORT || 587);
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_FROM = process.env.SMTP_FROM || 'ApagaNet <no-reply@apaganet.local>';
const EMAIL_TO_DEFAULT = process.env.EMAIL_TO_DEFAULT || '';

let transporter = null;
if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

const nanoid = customAlphabet('1234567890abcdefghijklmnopqrstuvwxyz', 10);
const pool = new Pool();

// Helpers
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
async function ensureHome(homeId){
  await pool.query('INSERT INTO homes(id) VALUES($1) ON CONFLICT (id) DO NOTHING', [homeId]);
}

// Health
app.get(['/','/api/health','/api/ping'], (req,res)=>{
  res.json({ ok:true, time:new Date().toISOString(), service:'ApagaNet Backend (pg+notify)' });
});

// Stripe webhook (raw)
app.post('/webhooks/stripe', express.raw({ type:'application/json' }), (req,res)=>{
  try {
    if (stripe && STRIPE_WEBHOOK_SECRET) {
      const sig = req.headers['stripe-signature'];
      stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
    }
  } catch(e) {
    console.error('webhook error', e.message);
    return res.status(400).send(`Webhook Error: ${e.message}`);
  }
  res.json({ received:true });
});

app.use(express.json({ limit:'1mb' }));

// Auth demo
app.post('/auth/demo-token', async (req,res)=>{
  const { homeId='HOME-DEMO-1' } = req.body || {};
  await ensureHome(homeId);
  const token = jwt.sign({ role:'admin', homeId }, JWT_SECRET, { expiresIn:'2h' });
  res.json({ token, homeId });
});

// Devices
app.get('/devices', authJWT, async (req,res)=>{
  const { rows } = await pool.query(
    'SELECT id as mac, name, online, EXTRACT(EPOCH FROM last_seen)*1000 as lastSeen, COALESCE(EXTRACT(EPOCH FROM paused_until)*1000,0) as pausedUntil FROM devices WHERE home_id=$1 ORDER BY last_seen DESC',
    [req.user.homeId]
  );
  res.json({ devices: rows });
});

// Alerts
app.get('/alerts', authJWT, async (req,res)=>{
  const { rows } = await pool.query(
    'SELECT id, type, message, EXTRACT(EPOCH FROM created_at)*1000 as createdAt, read FROM alerts WHERE home_id=$1 ORDER BY created_at DESC LIMIT 200',
    [req.user.homeId]
  );
  res.json({ alerts: rows });
});

// Notifications prefs
app.get('/notifications/prefs', authJWT, async (req,res)=>{
  const { deviceId } = req.query;
  if (!deviceId) return res.status(400).json({ error:'deviceId required' });
  const { rows } = await pool.query('SELECT notify_home_enter, notify_home_exit FROM devices WHERE id=$1 AND home_id=$2',[deviceId, req.user.homeId]);
  if (!rows.length) return res.status(404).json({ error:'device not found' });
  res.json({ deviceId, notifyHomeEnter: rows[0].notify_home_enter, notifyHomeExit: rows[0].notify_home_exit });
});
app.post('/notifications/prefs', authJWT, async (req,res)=>{
  const { deviceId, notifyHomeEnter=null, notifyHomeExit=null } = req.body || {};
  if (!deviceId) return res.status(400).json({ error:'deviceId required' });
  await ensureHome(req.user.homeId);
  // upsert device
  await pool.query('INSERT INTO devices(id, home_id, name) VALUES($1,$2,$1) ON CONFLICT (id) DO NOTHING', [deviceId, req.user.homeId]);
  if (typeof notifyHomeEnter === 'boolean') {
    await pool.query('UPDATE devices SET notify_home_enter=$1 WHERE id=$2 AND home_id=$3', [notifyHomeEnter, deviceId, req.user.homeId]);
  }
  if (typeof notifyHomeExit === 'boolean') {
    await pool.query('UPDATE devices SET notify_home_exit=$1 WHERE id=$2 AND home_id=$3', [notifyHomeExit, deviceId, req.user.homeId]);
  }
  const { rows } = await pool.query('SELECT id as deviceId, notify_home_enter as notifyHomeEnter, notify_home_exit as notifyHomeExit FROM devices WHERE id=$1 AND home_id=$2',[deviceId, req.user.homeId]);
  res.json({ ok:true, device: rows[0] });
});

// Notify pipeline
async function sendNotification(homeId, { id, type, message, createdAt, deviceId=null }) {
  if (NOTIFY_WEBHOOK_URL) {
    try{ await fetch(NOTIFY_WEBHOOK_URL, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id, type, message, createdAt, deviceId, homeId })}); }catch(e){}
  }
  if (SLACK_WEBHOOK_URL) {
    try{ await fetch(SLACK_WEBHOOK_URL, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ text: message })}); }catch(e){}
  }
  if (transporter && EMAIL_TO_DEFAULT) {
    try{ await transporter.sendMail({ from: SMTP_FROM, to: EMAIL_TO_DEFAULT, subject: 'ApagaNet — Notificación', text: message }); }catch(e){}
  }
}

const HYST_ENTER = 20;
const HYST_EXIT  = 50;
const MIN_ACC    = 100;
const MIN_SAMPLES = 3;

function distMeters(lat1,lng1,lat2,lng2){
  const R=6371000,toRad=d=>d*Math.PI/180;
  const dLat=toRad(lat2-lat1), dLng=toRad(lng2-lng1);
  const a=Math.sin(dLat/2)**2+Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLng/2)**2;
  return 2*R*Math.asin(Math.sqrt(a));
}

// Report location
app.post('/locations/report', async (req,res)=>{
  const { homeId, deviceId, lat, lng, accuracy=30, at=null } = req.body || {};
  if (!homeId || !deviceId || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ error:'homeId, deviceId, lat, lng required' });
  }
  if (accuracy != null && accuracy > MIN_ACC) return res.json({ ok:true, ignored:true, reason:'low_accuracy' });

  await ensureHome(homeId);
  const t = at ? new Date(+at) : new Date();
  const id = nanoid();
  await pool.query('INSERT INTO devices(id, home_id, name, last_seen) VALUES($1,$2,$1,NOW()) ON CONFLICT (id) DO UPDATE SET last_seen=NOW()', [deviceId, homeId]);
  await pool.query('INSERT INTO locations(id, home_id, device_id, lat, lng, accuracy, at) VALUES($1,$2,$3,$4,$5,$6,$7)', [id, homeId, deviceId, lat, lng, accuracy, t]);

  // geofence "Casa"
  const { rows: fences } = await pool.query('SELECT * FROM geofences WHERE home_id=$1 AND LOWER(name)=LOWER($2) LIMIT 1', [homeId, 'Casa']);
  if (fences.length){
    const gf = fences[0];
    const d = distMeters(lat,lng,gf.lat,gf.lng);
    const { rows: prevRows } = await pool.query('SELECT * FROM geofence_state WHERE device_id=$1', [deviceId]);
    const prev = prevRows[0] || { inside: null, counter: 0, fence_id: gf.id };
    const insideNow  = d <= (gf.radius_meters - HYST_ENTER);
    const outsideNow = d >= (gf.radius_meters + HYST_EXIT);
    let newInside = prev.inside;
    if (prev.inside === true) { if (outsideNow) newInside = false; }
    else if (prev.inside === false) { if (insideNow) newInside = true; }
    else { newInside = d <= gf.radius_meters; }

    let counter = prev.counter || 0;
    let event = null;
    if (newInside !== prev.inside) {
      counter += 1;
      if (counter >= MIN_SAMPLES) {
        event = newInside ? 'geofence_enter' : 'geofence_exit';
        counter = 0;
      }
    } else {
      counter = 0;
    }
    await pool.query(`INSERT INTO geofence_state(device_id, fence_id, inside, counter, updated_at)
                      VALUES($1,$2,$3,$4,NOW())
                      ON CONFLICT (device_id) DO UPDATE SET fence_id=$2, inside=$3, counter=$4, updated_at=NOW()`,
                      [deviceId, gf.id, newInside, counter]);

    if (event){
      const alertId = nanoid();
      const message = newInside ? `${deviceId} llegó a Casa` : `${deviceId} salió de Casa`;
      await pool.query('INSERT INTO alerts(id, home_id, type, message) VALUES($1,$2,$3,$4)', [alertId, homeId, event, message]);

      // delivery respect prefs
      const { rows: pref } = await pool.query('SELECT notify_home_enter, notify_home_exit FROM devices WHERE id=$1 AND home_id=$2', [deviceId, homeId]);
      const wantEnter = !!pref[0]?.notify_home_enter;
      const wantExit  = !!pref[0]?.notify_home_exit;
      const allowed = (event==='geofence_enter' && wantEnter) || (event==='geofence_exit' && wantExit);
      if (allowed) {
        await sendNotification(homeId, { id: alertId, type: event, message, createdAt: Date.now(), deviceId });
      }
    }
  }

  res.json({ ok:true });
});

// live
app.get('/locations/live', authJWT, async (req,res)=>{
  const { deviceId } = req.query;
  if (!deviceId) return res.status(400).json({ error:'deviceId required' });
  const { rows } = await pool.query('SELECT lat, lng, accuracy, EXTRACT(EPOCH FROM at)*1000 as at FROM locations WHERE device_id=$1 ORDER BY at DESC LIMIT 1',[deviceId]);
  res.json({ live: rows[0] || null });
});

// history
app.get('/locations/history', authJWT, async (req,res)=>{
  const { deviceId, hours=24 } = req.query;
  if (!deviceId) return res.status(400).json({ error:'deviceId required' });
  const { rows } = await pool.query(
    'SELECT lat, lng, accuracy, EXTRACT(EPOCH FROM at)*1000 as at FROM locations WHERE device_id=$1 AND at > NOW() - ($2||' hours')::interval AND (accuracy IS NULL OR accuracy <= 100) ORDER BY at ASC',
    [deviceId, hours]
  );
  res.json({ points: rows });
});

// geofences
app.get('/geofences', authJWT, async (req,res)=>{
  const { rows } = await pool.query('SELECT id, name, lat, lng, radius_meters FROM geofences WHERE home_id=$1 ORDER BY created_at DESC', [req.user.homeId]);
  res.json({ geofences: rows });
});
app.post('/geofences', authJWT, async (req,res)=>{
  const { name, lat, lng, radiusMeters=200 } = req.body || {};
  if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) return res.status(400).json({ error:'name, lat, lng required' });
  const id = nanoid();
  await pool.query('INSERT INTO geofences(id, home_id, name, lat, lng, radius_meters) VALUES($1,$2,$3,$4,$5,$6)', [id, req.user.homeId, name, lat, lng, radiusMeters]);
  res.json({ ok:true, geofence: { id, name, lat, lng, radius_meters: radiusMeters } });
});
app.post('/geofences/upsert-home', authJWT, async (req,res)=>{
  const { lat, lng, radiusMeters=200 } = req.body || {};
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return res.status(400).json({ error:'lat,lng required' });
  const { rows } = await pool.query('SELECT id FROM geofences WHERE home_id=$1 AND LOWER(name)=LOWER($2) LIMIT 1', [req.user.homeId, 'Casa']);
  if (rows.length){
    await pool.query('UPDATE geofences SET lat=$1, lng=$2, radius_meters=$3 WHERE id=$4',[lat,lng,radiusMeters, rows[0].id]);
    res.json({ ok:true, geofence: { id: rows[0].id, name:'Casa', lat, lng, radius_meters: radiusMeters } });
  } else {
    const id = nanoid();
    await pool.query('INSERT INTO geofences(id, home_id, name, lat, lng, radius_meters) VALUES($1,$2,$3,$4,$5,$6)', [id, req.user.homeId, 'Casa', lat, lng, radiusMeters]);
    res.json({ ok:true, geofence: { id, name:'Casa', lat, lng, radius_meters: radiusMeters } });
  }
});

// public signup
app.post('/public/signup', async (req,res)=>{
  res.json({ ok:true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=> console.log('ApagaNet Backend (pg+notify) on :' + PORT));
