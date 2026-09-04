import Redis from "ioredis";
import "dotenv/config";

export const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: 2,
  lazyConnect: false,
});

redis.on("error", (err) => {
  // App still works without Redis — cache reads/writes are wrapped in try/catch
  // wherever they're used, so a Redis outage only removes caching, not function.
  console.warn("Redis error:", err.message);
});

redis.on("connect", () => {
  console.log("Connected to Redis.");
});

// Cache keys used across the app:
//   trains:list                    -> JSON array of all trains (TTL 5 min)
//   availability:<trainId>:<date>  -> JSON {booked:[seatNumbers], available} (TTL 30s)
export const CACHE_KEYS = {
  trainsList: "trains:list",
  availability: (trainId, date) => `availability:${trainId}:${date}`,
};
