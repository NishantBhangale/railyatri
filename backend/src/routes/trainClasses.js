import { Router } from "express";
import { pool } from "../db/pool.js";
import { redis, CACHE_KEYS } from "../db/redis.js";

const router = Router();
const AVAILABILITY_TTL = 20; // seconds — short, since seats change on every booking

// GET /api/train-classes/:classId/availability?date=YYYY-MM-DD
router.get("/:classId/availability", async (req, res) => {
  const { classId } = req.params;
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: "date query param is required (YYYY-MM-DD)" });

  try {
    const cacheKey = CACHE_KEYS.availability(classId, date);
    const cached = await redis.get(cacheKey).catch(() => null);
    if (cached) {
      return res.json({ source: "cache", ...JSON.parse(cached) });
    }

    const classRes = await pool.query("SELECT total_seats FROM train_classes WHERE id = $1", [
      classId,
    ]);
    if (classRes.rows.length === 0) return res.status(404).json({ error: "Seat class not found" });
    const totalSeats = classRes.rows[0].total_seats;

    const bookedRes = await pool.query(
      `SELECT seat_number FROM bookings
       WHERE train_class_id = $1 AND travel_date = $2 AND status = 'CONFIRMED'`,
      [classId, date]
    );
    const bookedSeats = bookedRes.rows.map((r) => r.seat_number);
    const payload = {
      trainClassId: Number(classId),
      date,
      totalSeats,
      bookedSeats,
      availableSeats: totalSeats - bookedSeats.length,
    };

    redis.set(cacheKey, JSON.stringify(payload), "EX", AVAILABILITY_TTL).catch(() => {});
    res.json({ source: "db", ...payload });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not fetch availability" });
  }
});

export default router;
