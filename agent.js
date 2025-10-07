import fs from "fs";
import fetch from "node-fetch";
import { sleep, log } from "./lib/utils.js";
import * as OWRT from "./lib/routers/openwrt.js";
import * as TPL from "./lib/routers/tplink.js";

const cfg = JSON.parse(fs.readFileSync("./config.json","utf8"));

function driver(){
  if (cfg.router.type === "openwrt") return OWRT;
  if (cfg.router.type === "tplink") return TPL;
  throw new Error("Unsupported router.type: " + cfg.router.type);
}

async function fetchNextActions(){
  const url = new URL(cfg.backend + "/agents/next-actions");
  if (cfg.homeId) url.searchParams.set("homeId", cfg.homeId);
  const res = await fetch(url, { headers: { "Authorization": "Bearer " + cfg.agentToken } });
  if (!res.ok) throw new Error("next-actions HTTP " + res.status);
  return res.json();
}

async function report(actionId, ok, error){
  const res = await fetch(cfg.backend + "/agents/report", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + cfg.agentToken },
    body: JSON.stringify({ actionId, ok, error: error ? String(error) : null })
  });
  if (!res.ok) throw new Error("report HTTP " + res.status);
  return res.json();
}

async function main(){
  log("ApagaNet agent starting with router:", cfg.router.type);
  const drv = driver();
  let session = null;

  while (true){
    try{
      if (!session){
        session = await drv.connect(cfg.router);
      }
      const { actions } = await fetchNextActions();
      if (!actions || !actions.length){
        await sleep(cfg.interval * 1000);
        continue;
      }
      for (const a of actions){
        log("processing action:", a.id, a.type, a.mac);
        try {
          if (a.type === "block"){
            await drv.applyBlock(cfg.router, session, a.mac);
          } else if (a.type === "unblock"){
            await drv.applyUnblock(cfg.router, session, a.mac);
          } else {
            throw new Error("unknown action type " + a.type);
          }
          await report(a.id, true, null);
          log("done:", a.id);
        } catch(err){
          await report(a.id, false, err.message || String(err));
          log("failed:", a.id, err);
        }
      }
    }catch(loopErr){
      log("loop error:", loopErr.message || loopErr);
      session = null; // reconnect next loop
      await sleep(5000);
    }
  }
}

if (process.argv.includes("--connect")){
  (async () => {
    const drv = driver();
    const session = await drv.connect(cfg.router);
    log("connected ok:", session && Object.keys(session));
    process.exit(0);
  })().catch(e => { console.error(e); process.exit(1); });
} else {
  main().catch(e => { console.error(e); process.exit(1); });
}
