# ApagaNet Agent (REST) — OpenWRT/TP-Link

## Config
Edit `config.json`:
- backend: URL de tu backend (Render)
- agentToken: token del agente en tu BD (tabla `agents`)
- homeId: id del hogar
- interval: segundos entre polls
- router: { type: "openwrt"|"tplink", url, user, pass }

## Run
npm install
npm start

## Quick check
npm run connect
