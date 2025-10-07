import { log } from "../utils.js";
export async function connect({ url, user, pass }){
  log("[tplink] connect (placeholder):", url, user);
  return { token: "placeholder" };
}
export async function applyBlock(_cfg, _session, mac){
  log("[tplink] block MAC (placeholder):", mac);
  return true;
}
export async function applyUnblock(_cfg, _session, mac){
  log("[tplink] unblock MAC (placeholder):", mac);
  return true;
}
