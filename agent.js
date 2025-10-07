
import 'dotenv/config';
import { exec } from 'node:child_process';

const API_URL     = process.env.API_URL || 'http://localhost:10000';
const AGENT_TOKEN = process.env.AGENT_TOKEN || '';
const HOME_ID     = process.env.HOME_ID || '';
const ROUTER_TYPE = process.env.ROUTER_TYPE || 'mock';   // openwrt | mock
const INTERVAL_MS = Number(process.env.INTERVAL_MS || 30000);
const DRY_RUN     = String(process.env.DRY_RUN || 'true').toLowerCase() === 'true';

console.log('ApagaNet Agent boot', { API_URL, HOME_ID, ROUTER_TYPE, DRY_RUN, INTERVAL_MS });

function shell(cmd){
  return new Promise(resolve => {
    console.log(`$ ${cmd}`);
    if (DRY_RUN) { console.log('[DRY_RUN] no-op'); return resolve(true); }
    exec(cmd, { timeout: 20_000 }, (err, stdout, stderr) => {
      if (err) { console.error('[shell] error', err.message); console.error(stderr); return resolve(false); }
      if (stdout) console.log(stdout.trim());
      resolve(true);
    });
  });
}

export async function applyBlock(mac){
  if (ROUTER_TYPE === 'openwrt'){
    const user = process.env.ROUTER_USER || 'root';
    const host = process.env.ROUTER_HOST || '192.168.1.1';
    return shell(`scripts/openwrt_block.sh ${user} ${host} ${mac}`);
  }
  console.log('[mock] BLOCK', mac); return true;
}

export async function applyUnblock(mac){
  if (ROUTER_TYPE === 'openwrt'){
    const user = process.env.ROUTER_USER || 'root';
    const host = process.env.ROUTER_HOST || '192.168.1.1';
    return shell(`scripts/openwrt_unblock.sh ${user} ${host} ${mac}`);
  }
  console.log('[mock] UNBLOCK', mac); return true;
}

async function heartbeat(){
  try{
    const r = await fetch(`${API_URL}/ping`, {
      headers: { Authorization: `Bearer ${AGENT_TOKEN}` }
    });
    const j = await r.json().catch(()=>({}));
    console.log(`[heartbeat] ${new Date().toISOString()} ok=${r.ok} status=${r.status}`, j);
  }catch(e){
    console.error('[heartbeat] error', e.message);
  }
}

// TODO: cuando tu backend exponga /agents/next-actions y /agents/report
// aquí harás polling de acciones -> applyBlock/Unblock -> report de resultados.

await heartbeat();
setInterval(heartbeat, INTERVAL_MS);
