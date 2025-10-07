
# ApagaNet Agent (OpenWrt ready)

Agente minimal para conectar tu red doméstica con la API de **ApagaNet**.
- Heartbeat a `/ping` del backend
- Hooks para **bloquear/desbloquear por MAC** en routers **OpenWrt** vía SSH
- Configuración por `.env`
- Servicio **systemd** opcional

---

## Estructura
```
.
├─ agent.js
├─ package.json
├─ .env.example
├─ scripts/
│  ├─ openwrt_block.sh
│  └─ openwrt_unblock.sh
└─ systemd/
   └─ apaganet-agent.service
```

## Requisitos
- Node.js **18+**
- Acceso SSH al router (OpenWrt), usuario `root` o con permisos equivalentes

## Configuración
Copia `.env.example` a `.env` y ajusta:
```
API_URL=https://apaganet-zmsa.onrender.com
AGENT_TOKEN=<token de la tabla agents.api_token>
HOME_ID=<uuid del home>
ROUTER_TYPE=openwrt     # openwrt | mock
ROUTER_HOST=192.168.1.1
ROUTER_USER=root
DRY_RUN=true            # true = no aplica; false = aplica reglas firewall
INTERVAL_MS=30000       # heartbeat cada 30s
```

## Uso
```bash
npm install
npm start
```
Verás logs de heartbeat. Para aplicar reglas en el router cambia `DRY_RUN=false`.

## Pruebas manuales de bloqueo
```bash
DRY_RUN=true  scripts/openwrt_block.sh   root 192.168.1.1 AA:BB:CC:DD:EE:FF
DRY_RUN=true  scripts/openwrt_unblock.sh root 192.168.1.1 AA:BB:CC:DD:EE:FF
# Para aplicar realmente:
DRY_RUN=false scripts/openwrt_block.sh   root 192.168.1.1 AA:BB:CC:DD:EE:FF
```

## Como servicio (systemd)
1. Edita `systemd/apaganet-agent.service` y cambia `WorkingDirectory` a la ruta del repo.
2. Instala:
```bash
sudo cp systemd/apaganet-agent.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now apaganet-agent
```
Logs: `journalctl -u apaganet-agent -f`

## Seguridad
- **No subas tu `.env`** ni tokens a GitHub.
- Usa un usuario SSH con clave y, si es posible, restringe a subred LAN.

## Licencia
MIT
