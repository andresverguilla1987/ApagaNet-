# ApagaNet — Backend Integrado
Incluye: Notificaciones + Quiet Hours + Export CSV (memoria).

## Uso
1) Guarda `server.notify.integrated.js` en la raíz de tu backend (Render).
2) `package.json`:
```json
{ "type": "module", "scripts": { "start": "node server.notify.integrated.js" } }
```
3) Configura `ALLOWED_ORIGINS` con tu dominio Netlify.
