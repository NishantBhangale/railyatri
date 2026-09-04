-- Train Booking App schema (PostgreSQL)

-- pgcrypto extension needed for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(120) NOT NULL,
  email         VARCHAR(160) NOT NULL UNIQUE,
  wallet_balance NUMERIC(10, 2) NOT NULL DEFAULT 1000.00,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS trains (
  id              SERIAL PRIMARY KEY,
  train_number    VARCHAR(10) NOT NULL UNIQUE,
  name            VARCHAR(120) NOT NULL,
  source          VARCHAR(80) NOT NULL,
  destination     VARCHAR(80) NOT NULL,
  departure_time  VARCHAR(5) NOT NULL, -- HH:MM
  arrival_time    VARCHAR(5) NOT NULL  -- HH:MM
);

-- Each train offers a few seat classes (AC 2-tier, AC 3-tier sleeper,
-- non-AC sleeper, etc). Seats, availability and price are all per class,
-- not per train — a train has no seats of its own, only its classes do.
CREATE TABLE IF NOT EXISTS train_classes (
  id            SERIAL PRIMARY KEY,
  train_id      INTEGER NOT NULL REFERENCES trains(id) ON DELETE CASCADE,
  class_code    VARCHAR(10) NOT NULL,   -- '2A' | '3A' | 'SL'
  class_name    VARCHAR(60) NOT NULL,   -- 'AC 2 Tier', 'AC 3 Tier Sleeper', 'Non-AC Sleeper'
  is_ac         BOOLEAN NOT NULL DEFAULT false,
  total_seats   INTEGER NOT NULL,
  price         NUMERIC(10, 2) NOT NULL,
  UNIQUE (train_id, class_code)
);

CREATE TABLE IF NOT EXISTS bookings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  train_class_id  INTEGER NOT NULL REFERENCES train_classes(id),
  passenger_name  VARCHAR(120) NOT NULL,
  travel_date     DATE NOT NULL,
  seat_number     INTEGER NOT NULL,
  amount          NUMERIC(10, 2) NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'CONFIRMED', -- CONFIRMED | CANCELLED
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (train_class_id, travel_date, seat_number)
);

CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_class_date ON bookings(train_class_id, travel_date);
CREATE INDEX IF NOT EXISTS idx_train_classes_train ON train_classes(train_id);
