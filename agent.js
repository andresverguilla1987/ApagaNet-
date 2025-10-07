import 'dotenv/config';
import cron from 'cron';

const API_URL = process.env.API_URL || 'http://localhost:10000';
const AGENT_TOKEN = process.env.AGENT_TOKEN;
const HOME_ID = process.env.HOME_ID;
const MODE = (process.env.MODE || 'daemon').toLowerCase();
const INTERVAL_MS = Number(process.env.INTERVAL_MS || 60000);
const CRON_EXPR = process.env.CRON_EXPR || '* * * * *';

if (!AGENT_TOKEN || !HOME_ID) {
  console.error('❌ Missing AGENT_TOKEN or HOME_ID in env.');
  process.exit(1);
}

const authHeaders = { 'Authorization': `Bearer ${AGENT_TOKEN}`, 'Content-Type': 'application/json' };

async function apiFetch(path, options={}) {
  const url = `${API_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: { ...(options.headers||{}), ...authHeaders },
  });
  return res;
}

async function checkAuth() {
  try {
    const res = await apiFetch('/ping');
    if (res.ok) {
      const data = await res.json().catch(()=>({}));
      console.log('✅ Auth OK /ping', data);
      return true;
    } else {
      console.error('❌ /ping failed', res.status);
      return false;
    }
  } catch (e) {
    console.error('❌ /ping error', e.message);
    return false;
  }
}

let warned404Next=false, warned404Report=false;

async function fetchNextActions() {
  try {
    const res = await apiFetch(`/agents/next-actions?homeId=${encodeURIComponent(HOME_ID)}`);
    if (res.status === 404) {
      if (!warned404Next) {
        console.warn('⚠️  /agents/next-actions not implemented on server yet. No-op.');
        warned404Next = true;
      }
      return [];
    }
    if (!res.ok) {
      console.warn('⚠️  next-actions non-OK', res.status);
      return [];
    }
    const data = await res.json().catch(()=>({}));
    return Array.isArray(data.actions) ? data.actions : (data || []);
  } catch (e) {
    console.warn('⚠️  next-actions error', e.message);
    return [];
  }
}

// Placeholder executor — replace with real OpenWrt/UniFi integrations
async function executeAction(action) {
  const { type, target, params } = action;
  console.log('👉 Executing action:', JSON.stringify(action));
  // TODO: call local router APIs here
  return { ok: true, type, target, params, executedAt: new Date().toISOString() };
}

async function reportResults(results) {
  try {
    const res = await apiFetch('/agents/report', { method:'POST', body: JSON.stringify({ homeId: HOME_ID, results }) });
    if (res.status === 404) {
      if (!warned404Report) {
        console.warn('⚠️  /agents/report not implemented on server yet. Skipping report.');
        warned404Report = true;
      }
      return;
    }
    if (!res.ok) {
      console.warn('⚠️  report non-OK', res.status);
    } else {
      console.log('📬 Reported', await res.json().catch(()=>({ok:true})));
    }
  } catch (e) {
    console.warn('⚠️  report error', e.message);
  }
}

async function cycle() {
  const authed = await checkAuth();
  if (!authed) return;

  const actions = await fetchNextActions();
  if (!actions.length) {
    console.log('😴 No actions right now.');
    return;
  }
  const results = [];
  for (const a of actions) {
    try {
      const r = await executeAction(a);
      results.push({ action: a, result: r });
    } catch (e) {
      results.push({ action: a, result: { ok:false, error: e.message } });
    }
  }
  await reportResults(results);
}

async function main() {
  console.log(`ApagaNet Agent starting in ${MODE} mode → ${API_URL}`);
  if (MODE === 'cron') {
    console.log('⏱  Using CRON_EXPR:', CRON_EXPR);
    const job = new cron.CronJob(CRON_EXPR, () => cycle());
    job.start();
  } else {
    const interval = Math.max(5000, INTERVAL_MS);
    console.log('🔁 Using INTERVAL_MS:', interval);
    await cycle();
    setInterval(cycle, interval);
  }
}

process.on('SIGINT', () => { console.log('bye'); process.exit(0); });
process.on('SIGTERM', () => { console.log('bye'); process.exit(0); });

main().catch(err => {
  console.error('Fatal agent error:', err);
  process.exit(1);
});
