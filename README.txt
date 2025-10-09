# ApagaNet — agent.sh (real)

Script simple que descubre dispositivos en tu red local y los reporta a tu backend.

## Requisitos
- bash, curl, iproute2 (ip), net-tools (arp) — cualquiera de ip/arp sirve.
- (Opcional) Variable `APAGANET_TOKEN` si tu backend requiere Bearer.

## Uso
```bash
chmod +x agent.sh
./agent.sh <AGENT_ID> <BACKEND_URL>
# Ejemplo:
./agent.sh 1 https://apaganet-zmsa.onrender.com
```

Envía JSON a uno de estos endpoints (en orden, hasta que responda 200):
- `/agents/devices/report`
- `/agents/report`
- `/api/agents/devices/report`

Si tu backend usa un token, exporta:
```bash
export APAGANET_TOKEN="xxxxxxxx"
```

## Cómo verifica dispositivos
- `ip neigh show` (preferente)
- `arp -an` (fallback)

Reporta pares `{ip, mac}`.
