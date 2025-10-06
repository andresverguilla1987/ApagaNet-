import fs from "fs";
import axios from "axios";
import { CookieJar } from "tough-cookie";
import { wrapper as axiosCookieJarSupport } from "axios-cookiejar-support";
import { blockMac as owrtBlock, unblockMac as owrtUnblock } from "./openwrt.js";
import { blockMac as unifiBlock, unblockMac as unifiUnblock } from "./unifi.js";

const config = JSON.parse(fs.readFileSync("./config.json","utf8"));
const jar = new CookieJar();
const http = axios.create({ baseURL: config.apiBase, timeout: 10000, headers: { "Authorization": `Bearer ${config.apiToken}` }});
axiosCookieJarSupport(http);
http.defaults.jar = jar;
http.defaults.withCredentials = true;

console.log("ApagaNet Agent iniciado para", config.router.type, "home:", config.homeId);

async function tick(){
  try{
    const { data } = await http.get(`/agents/next-actions`, { params: { homeId: config.homeId }});
    if(!data.ok || !Array.isArray(data.actions) || data.actions.length === 0) return;
    for(const a of data.actions){
      const mac = a.mac;
      let ok = false, error = null;
      try{
        if(config.router.type === "openwrt"){
          if(a.type === "block") await owrtBlock(config.router, mac);
          else await owrtUnblock(config.router, mac);
          ok = true;
        } else if(config.router.type === "unifi"){
          if(a.type === "block") await unifiBlock(config.router, mac);
          else await unifiUnblock(config.router, mac);
          ok = true;
        } else {
          throw new Error("router.type no soportado");
        }
      }catch(e){
        error = String(e);
      }
      await http.post("/agents/report", {
        homeId: config.homeId,
        actionId: a.id,
        ok, error
      }).catch(()=>{});
    }
  }catch(e){
    // silencio para que siga el loop
  }
}

setInterval(tick, (config.pollSeconds || 30) * 1000);
tick();
