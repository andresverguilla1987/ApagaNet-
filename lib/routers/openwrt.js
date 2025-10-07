import fetch from "node-fetch";
import { log } from "../utils.js";

async function rpc(url, method, params, sid){
  const base = method.startsWith('uci.') || method.startsWith('sys.') ? method.split('.')[0] : 'auth';
  const endpoint = `${url}/cgi-bin/luci/rpc/${base}`;
  const body = { id: 1, method, params };
  const headers = { "Content-Type": "application/json" };
  if (sid) headers["Cookie"] = `sysauth=${sid}`;
  const res = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify(body) });
  if(!res.ok) throw new Error(`OpenWRT RPC HTTP ${res.status}`);
  return res.json();
}

export async function connect({ url, user, pass }){
  const r = await rpc(url, "auth.login", [user, pass]);
  if (!r || !r.result) throw new Error("OpenWRT login failed");
  const sid = r.result;
  log("[openwrt] login ok");
  return { sid };
}

export async function applyBlock({ url }, session, mac){
  const cmd = `iptables -I FORWARD -m mac --mac-source ${mac} -j DROP`;
  const r = await rpc(url, "sys.exec", [cmd], session.sid);
  if (r.error) throw new Error(`OpenWRT sys.exec error: ${JSON.stringify(r.error)}`);
  return true;
}

export async function applyUnblock({ url }, session, mac){
  // best-effort remove
  const del = `iptables -D FORWARD -m mac --mac-source ${mac} -j DROP || true`;
  await rpc(url, "sys.exec", [del], session.sid);
  return true;
}
