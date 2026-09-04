import { Router } from "express";
import { pool } from "../db/pool.js";
import "dotenv/config";

const router = Router();
const INITIAL_BALANCE = Number(process.env.INITIAL_WALLET_BALANCE || 1000);

// POST /api/profile - create a new profile
router.post("/", async (req, res) => {
  const { name, email } = req.body;
  if (!name || !email) {
    return res.status(400).json({ error: "name and email are required" });
  }

  try {
    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "A profile with this email already exists" });
    }

    const { rows } = await pool.query(
      `INSERT INTO users (name, email, wallet_balance)
       VALUES ($1, $2, $3)
       RETURNING id, name, email, wallet_balance, created_at`,
      [name, email, INITIAL_BALANCE]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not create profile" });
  }
});

// GET /api/profile/:id
router.get("/:id", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, name, email, wallet_balance, created_at FROM users WHERE id = $1",
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Profile not found" });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not fetch profile" });
  }
});

// GET /api/profile?email=... - lookup by email (simple "login")
router.get("/", async (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ error: "email query param is required" });
  try {
    const { rows } = await pool.query(
      "SELECT id, name, email, wallet_balance, created_at FROM users WHERE email = $1",
      [email]
    );
    if (rows.length === 0) return res.status(404).json({ error: "No profile with that email" });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not look up profile" });
  }
});

export default router;
