import { Client } from "ssh2";

function execSSH({ host, username, password }, cmd){
  return new Promise((resolve, reject) => {
    const conn = new Client();
    let out = "", err = "";
    conn.on("ready", () => {
      conn.exec(cmd, (e, stream) => {
        if (e) { conn.end(); return reject(e); }
        stream.on("close", (code) => { conn.end(); code === 0 ? resolve(out.trim()) : reject(new Error(err || `exit ${code}`)); })
              .on("data", (d) => out += d.toString())
              .stderr.on("data", (d) => err += d.toString());
      });
    }).on("error", reject).connect({ host, username, password, readyTimeout: 8000, tryKeyboard: false });
  });
}

export async function blockMac(cfg, mac){
  mac = mac.toUpperCase();
  const idx = Number.isInteger(cfg.ifaceIndex) ? cfg.ifaceIndex : 0;
  const cmds = [
    `uci set wireless.@wifi-iface[${idx}].macfilter='deny'`,
    `uci add_list wireless.@wifi-iface[${idx}].maclist='${mac}'`,
    `uci commit wireless`,
    `/sbin/wifi reload`
  ].join(" && ");
  await execSSH(cfg, cmds);
}

export async function unblockMac(cfg, mac){
  mac = mac.toUpperCase();
  const idx = Number.isInteger(cfg.ifaceIndex) ? cfg.ifaceIndex : 0;
  // elimina la entrada del maclist si existe
  const cmd = `
    LIST=$(uci -q get wireless.@wifi-iface[${idx}].maclist || echo "");
    echo "$LIST" | tr ' ' '\n' | grep -v '${mac}' | xargs -I{} echo -n "{} " | xargs -0 echo | xargs -I{} sh -c "uci set wireless.@wifi-iface[${idx}].maclist='\"{}\"'"; 
    uci commit wireless; /sbin/wifi reload
  `;
  await execSSH(cfg, cmd);
}
