-- Clarifica Telemetry Layer — W1
-- Ejecutar en VPS: psql $DATABASE_URL -f scripts/telemetry-schema.sql

CREATE SCHEMA IF NOT EXISTS telemetry;

-- Fallos y recoveries de servicios (Uptime Kuma webhooks)
CREATE TABLE IF NOT EXISTS telemetry.t_service_events (
  id          BIGSERIAL PRIMARY KEY,
  ts          TIMESTAMPTZ NOT NULL DEFAULT now(),
  monitor     TEXT NOT NULL,
  status      TEXT NOT NULL CHECK (status IN ('up', 'down', 'degraded')),
  latency_ms  INTEGER,
  message     TEXT,
  raw         JSONB
);

-- Visitas a landing y demos (JS beacon)
CREATE TABLE IF NOT EXISTS telemetry.t_visit_sessions (
  id            BIGSERIAL PRIMARY KEY,
  ts_start      TIMESTAMPTZ NOT NULL DEFAULT now(),
  ts_end        TIMESTAMPTZ,
  session_id    TEXT NOT NULL,
  page          TEXT NOT NULL,
  referrer      TEXT,
  sections_seen JSONB,
  country       TEXT,
  user_agent    TEXT
);

-- Accesos SSH y Tailscale al servidor (crons VPS)
CREATE TABLE IF NOT EXISTS telemetry.t_access_events (
  id       BIGSERIAL PRIMARY KEY,
  ts       TIMESTAMPTZ NOT NULL DEFAULT now(),
  channel  TEXT NOT NULL CHECK (channel IN ('ssh', 'tailscale')),
  username TEXT,
  ip       TEXT,
  result   TEXT NOT NULL CHECK (result IN ('accepted', 'failed', 'connected', 'disconnected')),
  raw      TEXT
);

CREATE INDEX IF NOT EXISTS idx_t_service_events_ts_monitor
  ON telemetry.t_service_events (ts DESC, monitor);

CREATE INDEX IF NOT EXISTS idx_t_visit_sessions_ts_page
  ON telemetry.t_visit_sessions (ts_start DESC, page);

CREATE INDEX IF NOT EXISTS idx_t_access_events_ts_channel
  ON telemetry.t_access_events (ts DESC, channel);
