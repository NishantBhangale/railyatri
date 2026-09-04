import { Router } from "express";
import { pool } from "../db/pool.js";

const router = Router();

// GET /api/wallet/:userId - current balance
router.get("/:userId", async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT wallet_balance FROM users WHERE id = $1", [
      req.params.userId,
    ]);
    if (rows.length === 0) return res.status(404).json({ error: "Profile not found" });
    res.json({ userId: req.params.userId, balance: Number(rows[0].wallet_balance) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not fetch wallet balance" });
  }
});

// POST /api/wallet/topup - dummy top-up, no real payment involved
router.post("/topup", async (req, res) => {
  const { userId, amount } = req.body;
  const amt = Number(amount);

  if (!userId || !amt || amt <= 0) {
    return res.status(400).json({ error: "userId and a positive amount are required" });
  }
  if (amt > 100000) {
    return res.status(400).json({ error: "Top-up amount is unrealistically high for a demo wallet" });
  }

  try {
    const { rows } = await pool.query(
      `UPDATE users SET wallet_balance = wallet_balance + $1 WHERE id = $2
       RETURNING wallet_balance`,
      [amt, userId]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Profile not found" });
    res.json({ userId, balance: Number(rows[0].wallet_balance), added: amt });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not top up wallet" });
  }
});

export default router;
