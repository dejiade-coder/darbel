-- =============================================================================
-- Darbel migration 0006 — GRANT CREATE ON SCHEMA public TO darbel_migrator
-- =============================================================================
-- The original 0002_functions_and_roles migration set up the darbel_migrator
-- role with BYPASSRLS and full table privileges, but omitted the schema-level
-- CREATE grant. Without this, the role cannot CREATE new tables, indexes, or
-- the _prisma_migrations bookkeeping table.
--
-- This was discovered during Stage 2 baselining when `npx prisma migrate
-- resolve` failed with "permission denied for schema public" while trying
-- to create _prisma_migrations.
--
-- Fix: grant CREATE on the public schema to darbel_migrator. This must be
-- a separate migration because Prisma migrations are immutable once
-- committed.
-- =============================================================================

GRANT CREATE ON SCHEMA public TO darbel_migrator;
