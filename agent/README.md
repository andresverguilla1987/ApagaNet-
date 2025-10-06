# ApagaNet Agent (OpenWrt / UniFi)
Agente ligero que corre **dentro de la red del usuario** y ejecuta bloqueos/desbloqueos:
- **OpenWrt:** ajusta `macfilter` y `maclist` (deny) y recarga WiFi.
- **UniFi:** usa API del controlador (bloquear/desbloquear cliente por MAC).

## Requisitos
- Node 18+
- Acceso a tu router desde la misma LAN.
- Para OpenWrt: usuario/clave o llave SSH cargada en el router.
- Para UniFi: URL del controlador (UDM / Cloud Key), usuario y pass.

## Instalación
```bash
npm install
cp config.example.json config.json
# edita config.json con tus datos
npm start
```

## Configuración (`config.json`)
```json
{
  "homeId": "hogar-123",
  "apiBase": "https://apaganet-zmsa.onrender.com",
  "apiToken": "AGENT_TOKEN_GENERADO_EN_BACKEND",
  "pollSeconds": 30,
  "router": {
    "type": "openwrt",
    "host": "192.168.1.1",
    "username": "root",
    "password": "tu_clave",
    "ifaceIndex": 0
  }
}
```
- `type`: `"openwrt"` o `"unifi"`
- **OpenWrt:**
  - `ifaceIndex`: índice de `wifi-iface` a usar (0 casi siempre). El agente hace denylist de MACs y `wifi reload`.
- **UniFi:**
  ```json
  {
    "type": "unifi",
    "controller": "https://192.168.1.2",
    "username": "admin",
    "password": "pass",
    "site": "default",
    "strictSSL": false
  }
  ```

## Qué hace
- Llama al backend: `GET /agents/next-actions?homeId=...`
- Ejecuta cada acción (`block` / `unblock` con mac).
- Reporta resultado `POST /agents/report`.

> Corre este agente en un mini PC, NAS o Raspberry dentro de la casa. No necesitas abrir puertos.
