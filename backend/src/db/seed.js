import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { pool } from "./pool.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 10 seed trains: [train_number, name, source, destination, departure, arrival, basePrice]
// basePrice is the non-AC sleeper (SL) fare; AC classes are priced as a
// multiple of it.
const trainRows = [
  ["12951", "Mumbai Rajdhani", "Mumbai", "Delhi", "16:00", "08:15", 750],
  ["12301", "Howrah Rajdhani", "Kolkata", "Delhi", "16:50", "10:00", 820],
  ["12259", "Sealdah Duronto", "Sealdah", "New Delhi", "12:20", "12:15", 700],
  ["12009", "Mumbai Shatabdi", "Mumbai", "Ahmedabad", "06:25", "12:10", 420],
  ["12621", "Tamil Nadu Express", "Chennai", "Delhi", "22:00", "06:45", 800],
  ["12626", "Kerala Express", "Thiruvananthapuram", "Delhi", "11:00", "05:20", 880],
  ["12723", "Andhra Pradesh Express", "Hyderabad", "Delhi", "18:15", "20:00", 770],
  ["122951", "Bandra Rajdhani", "Bandra", "Delhi", "17:05", "10:00", 760],
  ["12839", "Howrah Chennai Mail", "Howrah", "Chennai", "23:50", "05:15", 640],
  ["12429", "Rajdhani Express", "Delhi", "Bengaluru", "20:15", "06:40", 950],
];

// Seat classes offered on every train, derived from that train's base
// (non-AC sleeper) price.
const CLASS_TEMPLATE = [
  { code: "SL", name: "Non-AC Sleeper", isAc: false, seats: 40, priceMultiplier: 1 },
  { code: "3A", name: "AC 3 Tier Sleeper", isAc: true, seats: 24, priceMultiplier: 1.6 },
  { code: "2A", name: "AC 2 Tier", isAc: true, seats: 16, priceMultiplier: 2.1 },
];

const DEMO_USER_EMAIL = "seed-demo@railyatra.internal";
const DEMO_DAYS_AHEAD = 10; // seed alternating booked/free demand for the next N days

// A fixed, well-known lock key so that even if multiple backend replicas
// start at once (e.g. scaled Compose/K8s), only one of them actually seeds
// at a time — the rest block on this lock, then see trains already exist
// and skip once they get their turn.
const SEED_LOCK_KEY = 918_273_645;

function isoDatePlusDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// Insert-or-fetch: tries to insert, and if a UNIQUE constraint already has
// a matching row (ON CONFLICT DO NOTHING -> no row returned), fetches the
// existing row instead. Makes each statement safe to run any number of
// times, independent of the top-level "does the trains table have rows
// already" shortcut below.
async function insertOrFetch(client, insertSql, insertParams, fetchSql, fetchParams) {
  const insertRes = await client.query(insertSql, insertParams);
  if (insertRes.rows.length > 0) return insertRes.rows[0];
  const fetchRes = await client.query(fetchSql, fetchParams);
  return fetchRes.rows[0];
}

async function seed() {
  const client = await pool.connect();
  try {
    // Serialize concurrent seed attempts against this same database.
    await client.query("SELECT pg_advisory_lock($1)", [SEED_LOCK_KEY]);

    const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf-8");
    await client.query(schema);
    console.log("Schema created.");

    const { rows: existing } = await client.query("SELECT COUNT(*)::int AS count FROM trains");
    if (existing[0].count > 0) {
      console.log(`Trains table already has ${existing[0].count} rows — skipping seed.`);
      return;
    }

    // Everything below runs in one transaction: either the full seed data
    // set lands, or none of it does. That keeps the "trains count > 0"
    // shortcut above trustworthy — there's no state where a crash mid-seed
    // leaves a half-seeded database that then gets mistaken for "done".
    await client.query("BEGIN");

    const classIdsByTrain = []; // [{trainId, classes: [{id, total_seats, price}]}]
    for (const [trainNumber, name, source, destination, dep, arr, basePrice] of trainRows) {
      const train = await insertOrFetch(
        client,
        `INSERT INTO trains (train_number, name, source, destination, departure_time, arrival_time)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (train_number) DO NOTHING
         RETURNING id`,
        [trainNumber, name, source, destination, dep, arr],
        `SELECT id FROM trains WHERE train_number = $1`,
        [trainNumber]
      );

      const classes = [];
      for (const c of CLASS_TEMPLATE) {
        const price = Math.round(basePrice * c.priceMultiplier);
        const cls = await insertOrFetch(
          client,
          `INSERT INTO train_classes (train_id, class_code, class_name, is_ac, total_seats, price)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (train_id, class_code) DO NOTHING
           RETURNING id, total_seats, price`,
          [train.id, c.code, c.name, c.isAc, c.seats, price],
          `SELECT id, total_seats, price FROM train_classes WHERE train_id = $1 AND class_code = $2`,
          [train.id, c.code]
        );
        classes.push(cls);
      }
      classIdsByTrain.push({ trainId: train.id, classes });
    }
    console.log(`Inserted ${trainRows.length} trains with ${CLASS_TEMPLATE.length} classes each.`);

    const demoUser = await insertOrFetch(
      client,
      `INSERT INTO users (name, email, wallet_balance)
       VALUES ('Demo Seed User', $1, 999999)
       ON CONFLICT (email) DO NOTHING
       RETURNING id`,
      [DEMO_USER_EMAIL],
      `SELECT id FROM users WHERE email = $1`,
      [DEMO_USER_EMAIL]
    );

    // Alternate-day demand: even day-offsets are heavily booked (~75%
    // full), odd day-offsets lightly booked (~15% full).
    let totalBookingsInserted = 0;
    for (let dayOffset = 1; dayOffset <= DEMO_DAYS_AHEAD; dayOffset++) {
      const travelDate = isoDatePlusDays(dayOffset);
      const fillRatio = dayOffset % 2 === 0 ? 0.75 : 0.15;

      for (const { classes } of classIdsByTrain) {
        for (const cls of classes) {
          const seatsToBook = Math.floor(cls.total_seats * fillRatio);
          for (let seat = 1; seat <= seatsToBook; seat++) {
            const res = await client.query(
              `INSERT INTO bookings (user_id, train_class_id, passenger_name, travel_date, seat_number, amount, status)
               VALUES ($1, $2, $3, $4, $5, $6, 'CONFIRMED')
               ON CONFLICT (train_class_id, travel_date, seat_number) DO NOTHING`,
              [demoUser.id, cls.id, `Seed Passenger ${seat}`, travelDate, seat, cls.price]
            );
            totalBookingsInserted += res.rowCount;
          }
        }
      }
    }

    await client.query("COMMIT");
    console.log(
      `Seeded demand across ${DEMO_DAYS_AHEAD} days (alternating ~75%/~15% full): ${totalBookingsInserted} demo bookings.`
    );
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [SEED_LOCK_KEY]).catch(() => {});
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});