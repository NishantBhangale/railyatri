# RailYatra — Train Ticket Booking App

A full-stack demo train ticket booking application.

- **Frontend:** React + Vite + Tailwind CSS (departure-board themed UI)
- **Backend:** Node.js + Express (REST API)
- **Database:** PostgreSQL (users, trains, bookings)
- **Cache:** Redis (caches the train list and seat availability)

## Features

- Profile creation (name + email) — first step before anything else. Every new
  profile starts with a **$1000 demo wallet**.
- 10 seeded trains with route, timings, seats and fare.
- **From / To / date search bar** on the trains screen — filters to matching
  routes; a **"Show All Trains"** button clears the filter back to the full
  departure board.
- Live seat availability per train per travel date.
- Booking flow: pick a train → enter passenger name, travel date, optional seat
  number → simulated "payment" → booking confirmed and wallet debited.
- Booking is blocked once wallet balance can't cover the fare (or hits $0).
- **Wallet top-up** — dummy top-up button/form to add funds; no real payment
  gateway is involved anywhere in this app.
- **My Bookings** — every confirmed booking is persisted to Postgres and shown
  here, newest first, with a **Cancel** option that refunds the fare to the
  wallet and frees the seat (availability updates immediately).
- Subtle tiled train-icon artwork in the background of every screen, at low
  opacity so it doesn't compete with the UI.
- Redis caches the trains list (5 min TTL) and per-train/date seat availability
  (20s TTL); a successful booking *or cancellation* invalidates the relevant
  availability key.

## Prerequisites

- Node.js 18+
- PostgreSQL running locally (or reachable via connection settings)
- Redis running locally (or reachable via `REDIS_URL`)

## 1. Database setup

Create the database (schema/tables are created automatically by the seed script):

```bash
createdb train_booking
```

## 2. Backend

```bash
cd backend
cp .env.example .env
# edit .env if your Postgres/Redis credentials differ from the defaults
npm install
npm run seed     # creates tables + inserts the 10 trains
npm run dev       # starts the API on http://localhost:5000
```

Health check: `curl http://localhost:5000/api/health`

This reports both dependencies:

```json
{ "status": "ok", "db": "connected", "redis": "connected" }
```

- **`db`** is required — if Postgres is unreachable, `status` flips to `"error"` and the endpoint returns HTTP 500, since the app can't function without it.
- **`redis`** is informational only — Redis is cache-only (see "Why Redis?" below), so if it's `"unavailable"` the overall `status` stays `"ok"` and HTTP 200. The app keeps working; it just runs every trains/availability read straight against Postgres with no caching.

## 3. Frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev        # starts the UI on http://localhost:5173
```

Vite proxies `/api` requests to `http://localhost:5000`, so just open
`http://localhost:5173` in the browser.

### Production build

`npm run dev`'s `/api` proxy only exists in the Vite dev server — a built
bundle has nowhere to send `/api/...` requests unless you tell it where the
backend lives. Set `VITE_API_URL` at build time:

```bash
cd frontend
cp .env.example .env
# edit .env and set VITE_API_URL to your backend's full API URL, e.g.
# VITE_API_URL=https://api.example.com/api
npm run build      # outputs static files to frontend/dist/
npm run preview    # optional: serve the built bundle locally to sanity-check it
```

If frontend and backend are served from the same origin (e.g. both sit behind
one Nginx/Caddy reverse proxy that routes `/api/*` to the Express server),
you can leave `VITE_API_URL` unset — the code falls back to the relative
`/api` path, which will resolve correctly through that proxy.

## 4. Redis (if not already running)

```bash
# macOS (Homebrew)
brew install redis
brew services start redis

# Docker (any OS)
docker run -d --name train-redis -p 6379:6379 redis:7
```

## 5. Postgres via Docker (optional alternative)

```bash
docker run -d --name train-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=train_booking \
  -p 5432:5432 postgres:16
```

## Why Redis?

Redis is a **read-through cache only** — it never sits in the critical path
for anything that needs to be correct (bookings, wallet debits). Two things
are cached:

- **Trains list** (`GET /api/trains`) — key `trains:list`, 5 min TTL. The 10
  trains rarely change, so repeat reads are served from Redis instead of
  Postgres.
- **Seat availability** (`GET /api/trains/:id/availability?date=`) — key
  `availability:<trainId>:<date>`, 20s TTL. Smooths out bursts of reads (e.g.
  several people browsing the same date), and is explicitly invalidated the
  moment a booking succeeds so nobody sees stale seat counts.

**Redis is optional.** The booking transaction itself (balance check, seat
lock, insert) always goes straight to Postgres inside a row-locked
transaction — Redis is never required for correctness. Every Redis call is
wrapped so a failure is swallowed rather than thrown: if Redis is down, the
backend still starts and every route still works, just without caching (each
request falls through to Postgres). `Postgres`, by contrast, is a hard
dependency — the app cannot run without it. This split is exactly what
`/api/health` reports (see above).

## Project structure

```
train-booking-app/
├── backend/
│   ├── src/
│   │   ├── db/
│   │   │   ├── pool.js        # Postgres connection pool
│   │   │   ├── redis.js       # Redis client + cache key helpers
│   │   │   ├── schema.sql     # Table definitions
│   │   │   └── seed.js        # Creates schema + inserts 10 trains
│   │   ├── routes/
│   │   │   ├── profile.js     # Create/find profile
│   │   │   ├── wallet.js      # Balance + dummy top-up
│   │   │   ├── trains.js      # List trains + seat availability (cached)
│   │   │   └── bookings.js    # Create booking (payment sim) + list bookings
│   │   └── server.js
│   ├── package.json
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── api/client.js      # fetch wrapper for the backend API
    │   ├── assets/train-pattern.svg   # tiled background art
    │   ├── components/
    │   │   ├── BookingModal.jsx
    │   │   └── TrainBackground.jsx    # low-opacity tiled background layer
    │   ├── pages/
    │   │   ├── ProfileGate.jsx
    │   │   ├── Trains.jsx
    │   │   ├── MyBookings.jsx
    │   │   └── Wallet.jsx
    │   ├── App.jsx
    │   └── main.jsx
    ├── tailwind.config.js
    ├── vite.config.js
    └── package.json
    └── .env.example
```

## API reference

| Method | Path                              | Description                                  |
|--------|------------------------------------|-----------------------------------------------|
| GET    | `/api/health`                     | DB connectivity check                         |
| POST   | `/api/profile`                    | Create profile `{ name, email }`              |
| GET    | `/api/profile?email=`             | Look up profile by email                      |
| GET    | `/api/profile/:id`                | Get profile by id                             |
| GET    | `/api/wallet/:userId`             | Get wallet balance                            |
| POST   | `/api/wallet/topup`               | Dummy top-up `{ userId, amount }`             |
| GET    | `/api/trains`                     | List all trains (Redis-cached)                |
| GET    | `/api/trains/:id/availability?date=` | Seat availability for a date (Redis-cached) |
| POST   | `/api/bookings`                   | Book a seat (simulated payment + wallet debit)|
| GET    | `/api/bookings/:userId`           | List a user's bookings ("My Bookings")        |
| DELETE | `/api/bookings/:id`                | Cancel a booking `{ userId }` — refunds fare, frees the seat |

## Notes / next steps

- Auth is intentionally minimal (email-based profile lookup, no password) —
  swap in a real auth flow (JWT + hashed passwords) before deploying anywhere
  real.
- The "payment" step is entirely simulated: it just checks wallet balance and
  debits it. No card details are collected or transmitted.
