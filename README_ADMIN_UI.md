# Admin UI (simple) para ApagaNet

Interfaz mínima estática servida en `/admin/ui` que llama a los endpoints `/admin/*` usando `Authorization: Bearer <TASK_SECRET>` desde el navegador.

## Instalación (en tu repo backend)
1) Copia la carpeta `src/admin-ui/` al repo.
2) En `server.js`, añade ANTES del `app.use("/admin", requireTaskSecret, admin)`:
   ```js
   app.use("/admin/ui", express.static("src/admin-ui"));
   ```
   (sirve los archivos estáticos del panel)
3) Asegúrate de tener el router admin montado y protegido:
   ```js
   import admin from "./src/routes/admin.js";
   app.use("/admin", requireTaskSecret, admin);
   ```
4) Deploy en Render.

## Uso
- Abre `https://TU_DOMINIO/admin/ui`.
- Pega tu `TASK_SECRET` en el cuadro "Admin login" y presiona **Guardar**.
- Crea `Home` y luego `Agent`. Guarda el `api_token` devuelto como **AGENT_TOKEN** en tu agente.

> Nota: La secret se guarda en `localStorage` del navegador, sólo para firmar las llamadas. Borra el valor cerrando sesión o limpiando storage si lo requieres.
