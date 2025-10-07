# ApagaNet Agent

Cliente ligero que se conecta al backend de ApagaNet y ejecuta acciones de control según lo que indique el servidor.

## Variables de entorno
Copia `.env.example` a `.env` y completa:
```ini
API_URL=https://apaganet-zmsa.onrender.com
AGENT_TOKEN=<<tu agents.api_token>>
HOME_ID=<<tu homes.id>>
MODE=daemon
INTERVAL_MS=60000
CRON_EXPR=* * * * *
```

## Ejecutar local
```bash
npm install
npm start
```

## Render (Background Worker)
- Tipo: **Worker**
- Start command: `npm start`
- Variables de entorno: las mismas del `.env`.

## Notas
- Si tu backend aún no expone `/agents/next-actions` o `/agents/report`, el agente seguirá vivo y mostrará advertencias (no-op).
- Reemplaza `executeAction()` con integración real (OpenWrt / UniFi / API del router).
