
# Notifications Phase (Subscriptions + Dispatch)
- SQL: `db/migrations/20251018_notifications.sql`
- Router: `src/routes/notifications.pro.js`

Mount:
```js
import notificationsPro from "./src/routes/notifications.pro.js";
app.use("/", notificationsPro);
```
