-- =============================================================================
-- Darbel migration 0001 — Postgres extensions
-- =============================================================================
-- Extensions must be created before any table uses their types.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";     -- gen_random_uuid, digest, hmac
CREATE EXTENSION IF NOT EXISTS "citext";       -- case-insensitive text (emails)
CREATE EXTENSION IF NOT EXISTS "pg_trgm";      -- trigram indexes for fuzzy search
