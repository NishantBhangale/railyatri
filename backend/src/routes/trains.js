import { Router } from "express";
import { pool } from "../db/pool.js";
import { redis, CACHE_KEYS } from "../db/redis.js";

const router = Router();
const TRAINS_LIST_TTL = 300; // 5 minutes — trains/classes rarely change

// GET /api/trains - list all trains, each with its seat classes (cached in Redis)
router.get("/", async (req, res) => {
  try {
    const cached = await redis.get(CACHE_KEYS.trainsList).catch(() => null);
    if (cached) {
      return res.json({ source: "cache", trains: JSON.parse(cached) });
    }

    const { rows } = await pool.query(`
      SELECT
        t.id, t.train_number, t.name, t.source, t.destination,
        t.departure_time, t.arrival_time,
        COALESCE(
          json_agg(
            json_build_object(
              'id', c.id,
              'classCode', c.class_code,
              'className', c.class_name,
              'isAc', c.is_ac,
              'totalSeats', c.total_seats,
              'price', c.price
            ) ORDER BY c.price
          ) FILTER (WHERE c.id IS NOT NULL), '[]'
        ) AS classes
      FROM trains t
      LEFT JOIN train_classes c ON c.train_id = t.id
      GROUP BY t.id
      ORDER BY t.departure_time
    `);
    redis.set(CACHE_KEYS.trainsList, JSON.stringify(rows), "EX", TRAINS_LIST_TTL).catch(() => {});
    res.json({ source: "db", trains: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not fetch trains" });
  }
});

export default router;
