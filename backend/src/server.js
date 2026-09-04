import express from "express";
import cors from "cors";
import "dotenv/config";

import profileRoutes from "./routes/profile.js";
import walletRoutes from "./routes/wallet.js";
import trainRoutes from "./routes/trains.js";
import trainClassRoutes from "./routes/trainClasses.js";
import bookingRoutes from "./routes/bookings.js";
import { pool } from "./db/pool.js";
import { redis } from "./db/redis.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", async (req, res) => {
  // Postgres is required — if this fails, the app can't function, so the
  // whole health check reports an error and a 500.
  let dbOk = true;
  try {
    await pool.query("SELECT 1");
  } catch (err) {
    dbOk = false;
  }

  // Redis is optional (caching only — see db/redis.js) — its status is
  // reported for visibility, but it never fails the overall health check.
  let redisStatus = "unavailable";
  try {
    const pong = await redis.ping();
    redisStatus = pong === "PONG" ? "connected" : "unavailable";
  } catch (err) {
    redisStatus = "unavailable";
  }

  const body = {
    status: dbOk ? "ok" : "error",
    db: dbOk ? "connected" : "disconnected",
    redis: redisStatus,
  };
  res.status(dbOk ? 200 : 500).json(body);
});

app.use("/api/profile", profileRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/trains", trainRoutes);
app.use("/api/train-classes", trainClassRoutes);
app.use("/api/bookings", bookingRoutes);

app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Train booking API listening on http://localhost:${PORT}`);
});
