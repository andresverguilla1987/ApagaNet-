import axios from "axios";

async function login({ controller, username, password, strictSSL }){
  const http = axios.create({ baseURL: controller, withCredentials: true, validateStatus: s => s < 500 });
  if (strictSSL === false){
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  }
  // Nuevas UDM usan /api/auth/login
  const r = await http.post("/api/auth/login", { username, password });
  if (r.status !== 200) throw new Error("Login UniFi falló");
  return http;
}

export async function blockMac(cfg, mac){
  const http = await login(cfg);
  // API antigua: /api/s/default/cmd/stamgr { cmd:'block-sta', mac }
  const site = cfg.site || "default";
  const r = await http.post(`/api/s/${site}/cmd/stamgr`, { cmd: "block-sta", mac: mac.toLowerCase() });
  if (r.status !== 200) throw new Error("block-sta falló");
}

export async function unblockMac(cfg, mac){
  const http = await login(cfg);
  const site = cfg.site || "default";
  const r = await http.post(`/api/s/${site}/cmd/stamgr`, { cmd: "unblock-sta", mac: mac.toLowerCase() });
  if (r.status !== 200) throw new Error("unblock-sta falló");
}
