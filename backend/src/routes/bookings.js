import { Router } from "express";
import { pool } from "../db/pool.js";
import { redis, CACHE_KEYS } from "../db/redis.js";

const router = Router();

// POST /api/bookings
// body: { userId, trainClassId, passengerName, travelDate, seatNumber? }
// If seatNumber is omitted, the next free seat in that class is auto-assigned.
router.post("/", async (req, res) => {
  const { userId, trainClassId, passengerName, travelDate, seatNumber } = req.body;

  if (!userId || !trainClassId || !passengerName || !travelDate) {
    return res
      .status(400)
      .json({ error: "userId, trainClassId, passengerName and travelDate are required" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Lock the user row so concurrent bookings can't double-spend the wallet
    const userRes = await client.query(
      "SELECT wallet_balance FROM users WHERE id = $1 FOR UPDATE",
      [userId]
    );
    if (userRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Profile not found" });
    }

    const classRes = await client.query(
      `SELECT c.*, t.name AS train_name, t.train_number, t.source, t.destination,
              t.departure_time, t.arrival_time
       FROM train_classes c JOIN trains t ON t.id = c.train_id
       WHERE c.id = $1`,
      [trainClassId]
    );
    if (classRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Seat class not found" });
    }
    const cls = classRes.rows[0];

    const balance = Number(userRes.rows[0].wallet_balance);
    const price = Number(cls.price);
    if (balance <= 0) {
      await client.query("ROLLBACK");
      return res.status(402).json({ error: "Wallet balance exhausted. Top up to book a ticket." });
    }
    if (balance < price) {
      await client.query("ROLLBACK");
      return res
        .status(402)
        .json({ error: `Fare is $${price}, wallet has $${balance}. Top up to cover the difference.` });
    }

    // Work out booked seats for this class+date (row-locked to avoid double-booking)
    const bookedRes = await client.query(
      `SELECT seat_number FROM bookings
       WHERE train_class_id = $1 AND travel_date = $2 AND status = 'CONFIRMED'
       FOR UPDATE`,
      [trainClassId, travelDate]
    );
    const bookedSeats = new Set(bookedRes.rows.map((r) => r.seat_number));

    if (bookedSeats.size >= cls.total_seats) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "No seats available in this class for that date" });
    }

    let finalSeat = seatNumber ? Number(seatNumber) : null;
    if (finalSeat) {
      if (finalSeat < 1 || finalSeat > cls.total_seats) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: `seatNumber must be between 1 and ${cls.total_seats}` });
      }
      if (bookedSeats.has(finalSeat)) {
        await client.query("ROLLBACK");
        return res.status(409).json({ error: `Seat ${finalSeat} is already booked for that date` });
      }
    } else {
      for (let s = 1; s <= cls.total_seats; s++) {
        if (!bookedSeats.has(s)) {
          finalSeat = s;
          break;
        }
      }
    }

    // "Payment" step is simulated — it always succeeds once balance/seat checks pass
    const bookingRes = await client.query(
      `INSERT INTO bookings (user_id, train_class_id, passenger_name, travel_date, seat_number, amount, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'CONFIRMED')
       RETURNING *`,
      [userId, trainClassId, passengerName, travelDate, finalSeat, price]
    );

    const updatedUserRes = await client.query(
      `UPDATE users SET wallet_balance = wallet_balance - $1 WHERE id = $2 RETURNING wallet_balance`,
      [price, userId]
    );

    await client.query("COMMIT");

    // Invalidate the cached availability for this class+date now that a seat is taken
    redis.del(CACHE_KEYS.availability(trainClassId, travelDate)).catch(() => {});

    res.status(201).json({
      booking: {
        ...bookingRes.rows[0],
        train_name: cls.train_name,
        train_number: cls.train_number,
        source: cls.source,
        destination: cls.destination,
        class_code: cls.class_code,
        class_name: cls.class_name,
        is_ac: cls.is_ac,
      },
      walletBalance: Number(updatedUserRes.rows[0].wallet_balance),
    });
  } catch (err) {
    await client.query("ROLLBACK");
    if (err.code === "23505") {
      return res.status(409).json({ error: "That seat was just taken. Please pick another." });
    }
    console.error(err);
    res.status(500).json({ error: "Booking failed" });
  } finally {
    client.release();
  }
});

// GET /api/bookings/:userId - "My Bookings"
router.get("/:userId", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT b.*, t.name AS train_name, t.train_number, t.source, t.destination,
              t.departure_time, t.arrival_time,
              c.class_code, c.class_name, c.is_ac
       FROM bookings b
       JOIN train_classes c ON c.id = b.train_class_id
       JOIN trains t ON t.id = c.train_id
       WHERE b.user_id = $1
       ORDER BY b.created_at DESC`,
      [req.params.userId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not fetch bookings" });
  }
});

// DELETE /api/bookings/:id - cancel a booking
// body: { userId } - required to confirm the requester owns this booking
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: "userId is required" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const bookingRes = await client.query("SELECT * FROM bookings WHERE id = $1 FOR UPDATE", [id]);
    if (bookingRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Booking not found" });
    }
    const booking = bookingRes.rows[0];

    if (booking.user_id !== userId) {
      await client.query("ROLLBACK");
      return res.status(403).json({ error: "This booking does not belong to that profile" });
    }
    if (booking.status === "CANCELLED") {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Booking is already cancelled" });
    }

    await client.query("UPDATE bookings SET status = 'CANCELLED' WHERE id = $1", [id]);

    // Refund the fare back to the wallet
    const updatedUserRes = await client.query(
      `UPDATE users SET wallet_balance = wallet_balance + $1 WHERE id = $2 RETURNING wallet_balance`,
      [booking.amount, userId]
    );

    await client.query("COMMIT");

    // Free up the seat in the availability cache
    const travelDateStr = new Date(booking.travel_date).toISOString().slice(0, 10);
    redis.del(CACHE_KEYS.availability(booking.train_class_id, travelDateStr)).catch(() => {});

    res.json({
      bookingId: id,
      status: "CANCELLED",
      refunded: Number(booking.amount),
      walletBalance: Number(updatedUserRes.rows[0].wallet_balance),
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Could not cancel booking" });
  } finally {
    client.release();
  }
});

export default router;
