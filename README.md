# RailYatra — Train Ticket Booking App

A full-stack demo train ticket booking application.

- **Frontend:** React + Vite + Tailwind CSS (departure-board themed UI)
- **Backend:** Node.js + Express (REST API)
- **Database:** PostgreSQL (users, trains, bookings)
- **Cache:** Redis (caches the train list and seat availability)

## System Archiotechture

<img width="2720" height="3280" alt="railyatra_system_architecture" src="https://github.com/user-attachments/assets/a64b0e2a-1e22-47ae-8d9a-3c76e2a919bf" />


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
## Screenshots 

Homepage - Profile select


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

## Docker Compose setup

### Services

| Service | Image | Container name | Host port | Role |
|---|---|---|---|---|
| `db` | `postgres:16` | `train-postgres` | `${PGPORT}` → 5432 | Primary database |
| `redis` | `redis:7` | `train-redis` | `${redis_port}` → 6379 | Cache layer |
| `backend` | `./backend` | `railyatri-backend` | `${PORT}` → 5000 | REST API + seeding |
| `frontend` | `./frontend` | `railyatri-frontend` | `${F_Port}` → 80 | Nginx static serve + API proxy |

### Networks

All four services share a single user-defined bridge network — `railyatra-net` — created automatically by Compose on first `up`. Docker's internal DNS resolves each service by its service name (`db`, `redis`, `backend`, `frontend`), which is why `PGHOST=db` and `REDIS_URL=redis://redis:6379` work inside containers without any manual network wiring.

> Important: container names (`train-postgres`, `railyatri-backend`, etc.) and service names (`db`, `backend`, etc.) are different things. Only service names are used for DNS resolution on the Compose network. Container names are just labels for `docker ps` / `docker logs`.

### Persistent volume

`train_data` is a named Docker volume mounted at `/var/lib/postgresql/data` inside the `db` container. Named volumes survive `docker compose down` — your data persists across restarts. To start completely fresh (drop all data and re-seed):

```bash
docker compose down -v   # -v removes named volumes
docker compose up --build
```

### Healthcheck and startup order

The `db` service has a healthcheck (`pg_isready -U ${PGUSER} -d ${PGDATABASE}`, every 10 s, 5 retries, 10 s start period). The `backend` service declares `depends_on: db: condition: service_healthy` — so it won't start until Postgres is actually accepting connections, not just "container is running." This means `seed.js` always finds a ready database when it runs.

`redis` has no healthcheck because the backend is designed to degrade gracefully if Redis is unavailable (caching is skipped, all reads fall through to Postgres) — a Redis startup race doesn't break anything.

### env files — three separate files, three separate jobs

There are three `.env` files in this project and they do different things:

**`.env` (project root — next to `docker-compose.yml`)**  
Read by the Compose CLI itself before any container starts. Used for `${VAR}` substitution inside `docker-compose.yml` — things like port mappings, image tags, container names. These values are baked into the Compose config at parse time, not at container runtime.

```env
# .env (root)
PGUSER=postgres
PGPASSWORD=postgres
PGDATABASE=train_booking
PGPORT=5432
redis_port=6379
PORT=5000
F_Port=8081
```

**`backend/.env`**  
Loaded into the backend container's runtime environment via `env_file: ./backend/.env`. Read by `dotenv/config` when the Node process starts — not by Compose. Because the backend runs on the `railyatra-net` network, use service names for hostnames, not `localhost`.

```env
# backend/.env
PORT=5000
PGHOST=db            # service name, not localhost
PGPORT=5432
PGUSER=postgres
PGPASSWORD=postgres
PGDATABASE=train_booking
REDIS_URL=redis://redis:6379   # service name, not localhost
INITIAL_WALLET_BALANCE=1000
```

**`frontend/.env`**  
Only relevant for Vite builds — sets `VITE_API_URL`, which is baked into the JS bundle at build time. When the frontend runs via Nginx (this Compose setup), leave `VITE_API_URL` blank. Nginx proxies `/api/*` to the `backend` service internally, so the frontend's default relative `/api` path works as-is — no backend URL needs to be in the bundle.

```env
# frontend/.env
VITE_API_URL=
```

If you ever serve the built frontend from a static host (S3, Netlify, etc.) without a server-side proxy, set `VITE_API_URL=https://your-backend-domain/api` here before building.

> Why `${PORT}` in `docker-compose.yml` and `PORT` in `backend/.env` are two different things: `${PORT}` in the `ports:` mapping is substituted by Compose on the host to decide which host port to publish. `PORT` in `backend/.env` is read by the Node process inside the container to decide which port to `app.listen()` on. They happen to share the same name and value (`5000`) but are read at different times by different systems. If they drift, the port mapping stops working.

### Running everything

```bash
# First time (or after --build changes)
docker compose up --build

# Subsequent runs (no code changes)
docker compose up

# Stop containers (data persists in volume)
docker compose down

# Stop and wipe all data (fresh seed next up)
docker compose down -v

# View logs
docker logs railyatri-backend -f
docker logs train-postgres -f
docker logs train-redis -f

# Check container status and published ports
docker compose ps
```

Open `http://localhost:8081` (or whatever `F_Port` is set to) — the frontend is served by Nginx, which proxies API calls to the backend automatically.

### Seeding

The backend container runs `node src/db/seed.js && node src/server.js` on every start. The seed script is fully idempotent:

- Acquires a Postgres advisory lock before doing anything (safe against concurrent replica starts)
- Checks if the `trains` table already has rows — skips the entire insert block if yes
- Every insert uses `ON CONFLICT ... DO NOTHING` as a second safety net
- The full seed (schema + trains + seat classes + demo bookings) runs inside one transaction — either everything lands or nothing does, so there is no "partially seeded" state that gets mistaken for "fully seeded" on next restart

Re-running `docker compose up` any number of times produces exactly the same data — no duplicates, no partial states.

### Redis caching

| Cache key | TTL | Invalidated when |
|---|---|---|
| `trains:list` | 5 min | Never (static data) |
| `availability:<classId>:<date>` | 20 s | Booking confirmed or cancelled |

Redis is **optional** — the backend starts and all routes work even if Redis is unreachable. The `/api/health` endpoint reports both `db` (required) and `redis` (informational) status separately:

```json
{ "status": "ok", "db": "connected", "redis": "connected" }
```
