// server.js — ApagaNet backend ready for Render
import "dotenv/config";
import express from "express";
import morgan from "morgan";
import cors from "cors";

import auth from "./src/routes/auth.js";
import devices from "./src/routes/devices.js";
import schedules from "./src/routes/schedules.js";

const app = express();
const PORT = Number(process.env.PORT) || 10000;

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.get("/", (_req, res) => res.send("ApagaNet API OK"));
app.get("/ping", (_req, res) => {
  res.json({
    ok: true,
    app: process.env.APP_NAME || "ApagaNet",
    version: "0.1.1",
    env: process.env.APP_ENV || "dev",
    port: PORT
  });
});

app.get("/diag", (_req, res) => {
  res.json({
    ok: true,
    env: {
      APP_NAME: process.env.APP_NAME,
      APP_ENV: process.env.APP_ENV,
      PORT: process.env.PORT
    },
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

app.use("/auth", auth);
app.use("/devices", devices);
app.use("/schedules", schedules);

process.on("unhandledRejection", (e) => console.error("unhandledRejection", e));
process.on("uncaughtException", (e) => console.error("uncaughtException", e));

app.listen(PORT, "0.0.0.0", () => console.log(`ApagaNet API listening on :${PORT}`));
