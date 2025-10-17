// agent.js — compatible con /agents/next-actions (primario) y fallback a /agents/commands
import 'dotenv/config';
import cron from 'cron';

// ====== ENV ======
const API_URL    = process.env.API_URL || 'http://localhost:10000';
const AGENT_ID   = process.env.HOME_ID || process.env.AGENT_ID; // usa HOME_ID si existe
const AGENT_TOKEN = process.env.AGENT_TOKEN || '';              // opcional
const MODE       = (process.env.MODE || 'daemon').toLowerCase();
const INTERVAL_MS = Math.max(5000, Number(process.env.INTERVAL_MS || 60000));
const CRON_EXPR  = process.env.CRON_EXPR || '* * * * *';

if (!AGENT_ID) {
  console.error('❌ Falta HOME_ID o AGENT_ID en env.');
  process.exit(1);
}

const authHeaders = {
  'Content-Type': 'application/json',
  ...(AGENT_TOKEN ? { 'Authorization': `Bearer ${AGENT_TOKEN}` } : {}),
};

// ====== HELPERS ======
async function apiFetch(path, options = {}) {
  const url = `${API_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: { ...(options.headers || {}), ...authHeaders },
  });
  return res;
}

async function checkHealth() {
  try {
    const res = await fetch(`${API_URL}/ping`);
    if (!res.ok) {
      console.error('❌ /ping status', res.status);
      return false;
    }
    const data = await res.json().catch(() => ({}));
    console.log('✅ /ping', data);
    return true;
  } catch (e) {
    console.error('❌ /ping error', e.message);
    return false;
  }
}

// ====== NEXT ACTIONS (con fallback) ======
let warned404Next = false;
async function fetchNextActions() {
  // 1) Intento: /agents/next-actions?homeId=...
  try {
    const res = await apiFetch(`/agents/next-actions?homeId=${encodeURIComponent(AGENT_ID)}`);
    if (res.status === 404) {
      if (!warned404Next) {
        console.warn('⚠️  /agents/next-actions no existe. Haré fallback a /agents/commands.');
        warned404Next = true;
      }
    } else if (!res.ok) {
      console.warn('⚠️  /agents/next-actions non-OK', res.status);
    } else {
      const data = await res.json().catch(() => ({}));
      const actions = Array.isArray(data?.actions) ? data.actions : (Array.isArray(data) ? data : []);
      if (actions.length) return actions;
    }
  } catch (e) {
    console.warn('⚠️  /agents/next-actions error', e.message);
  }

  // 2) Fallback: /agents/commands?agent_id=...
  try {
    const res = await apiFetch(`/agents/commands?agent_id=${encodeURIComponent(AGENT_ID)}`);
    if (!res.ok) {
      console.warn('⚠️  /agents/commands non-OK', res.status);
      return [];
    }
    const data = await res.json().catch(() => []);
    // data es array o []
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.warn('⚠️  /agents/commands error', e.message);
    return [];
  }
}

// ====== EXECUTOR (placeholder) ======
async function executeAction(action) {
  // action puede venir en formatos distintos; no lo transformamos todavía.
  console.log('👉 Ejecutando acción:', JSON.stringify(action));
  // TODO: aquí integras con OpenWrt/UniFi/etc
  return { ok: true, executedAt: new Date().toISOString(), echo: action };
}

// ====== REPORT (con fallback) ======
let warned404Report = false;
async function reportResults(results) {
  // 1) Intento: /agents/report
  try {
    const res = await apiFetch('/agents/report', {
      method: 'POST',
      body: JSON.stringify({ homeId: AGENT_ID, results }),
    });
    if (res.status === 404) {
      if (!warned404Report) {
        console.warn('⚠️  /agents/report no existe. Haré fallback a /agents/commands (report_result).');
        warned404Report = true;
      }
    } else if (!res.ok) {
      console.warn('⚠️  /agents/report non-OK', res.status);
      return;
    } else {
      const data = await res.json().catch(() => ({ ok: true }));
      console.log('📬 Reported /agents/report', data);
      return;
    }
  } catch (e) {
    console.warn('⚠️  /agents/report error', e.message);
  }

  // 2) Fallback: postear un “report_result” a /agents/commands
  try {
    const res = await apiFetch('/agents/commands', {
      method: 'POST',
      body: JSON.stringify({
        agent_id: AGENT_ID,
        type: 'report_result',
        device_id: null,
        minutes: undefined,
        results,
      }),
    });
    if (!res.ok) {
      console.warn('⚠️  fallback report (/agents/commands) non-OK', res.status);
    } else {
      console.log('📬 Reported como report_result en /agents/commands');
    }
  } catch (e) {
    console.warn('⚠️  fallback report error', e.message);
  }
}

// ====== CICLO ======
async function cycle() {
  const ok = await checkHealth();
  if (!ok) return;

  const actions = await fetchNextActions();
  if (!actions.length) {
    console.log('😴 No hay acciones.');
    return;
  }

  const results = [];
  for (const a of actions) {
    try {
      const r = await executeAction(a);
      results.push({ action: a, result: r });
    } catch (e) {
      results.push({ action: a, result: { ok: false, error: e.message } });
    }
  }
  await reportResults(results);
}

// ====== MAIN ======
async function main() {
  console.log(`ApagaNet Agent @${API_URL} (agent_id=${AGENT_ID}) — mode=${MODE}`);
  if (MODE === 'cron') {
    console.log('⏱  CRON_EXPR:', CRON_EXPR);
    new cron.CronJob(CRON_EXPR, () => cycle()).start();
  } else {
    console.log('🔁 INTERVAL_MS:', INTERVAL_MS);
    await cycle();
    setInterval(cycle, INTERVAL_MS);
  }
}

process.on('SIGINT',  () => { console.log('bye'); process.exit(0); });
process.on('SIGTERM', () => { console.log('bye'); process.exit(0); });

main().catch(err => {
  console.error('Fatal agent error:', err);
  process.exit(1);
});
