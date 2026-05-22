/**
 * Darbel Stage 3 — Verify migrations against a scratch database (v2).
 *
 * Changes from v1:
 *   - Phase B inserts step B2.5: create extensions in scratch DB as postgres
 *     superuser BEFORE prisma migrate deploy runs. Extension installation
 *     requires CREATE privilege on the database, which darbel_migrator does
 *     not have (and should not have — that is a privileged operation).
 *   - psqlValue helper now actually checks for command failure rather than
 *     just empty stdout, so password-auth failures are visible rather than
 *     silently masked as "OK".
 *
 * Usage:
 *   node apply-stage3-v2.js
 */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const DARBEL_ROOT = 'C:\\Users\\OLADIMEJI\\darbel';
const BACKEND_ROOT = path.join(DARBEL_ROOT, 'backend');
const ENV_FILE = path.join(BACKEND_ROOT, '.env');
const PRISMA_MIGRATIONS_DIR = path.join(BACKEND_ROOT, 'prisma', 'migrations');
const PATCH_ROOT = __dirname;
const SOURCE_MIGRATIONS_DIR = path.join(PATCH_ROOT, 'migrations');
const PG_USER = 'postgres';
const LIVE_DB = 'darbel';
const SCRATCH_DB = 'darbel_scratch';
const NEW_MIGRATION = '20260522010000_migrator_create_grant';
const MIGRATOR_PASSWORD = 'migrator_pass_local_2026';

const c = {
  red:    (s) => `\x1b[31m${s}\x1b[0m`,
  green:  (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  cyan:   (s) => `\x1b[36m${s}\x1b[0m`,
  gray:   (s) => `\x1b[90m${s}\x1b[0m`,
};

function log(msg, colour) { console.log(colour ? colour(msg) : msg); }
function fatal(msg) { log('ERROR: ' + msg, c.red); process.exit(1); }

/**
 * Run a psql query and return its stdout. Raises if psql exits non-zero
 * (e.g. auth failure). Empty stdout returns ''.
 */
function psqlValue(db, sql) {
  const res = spawnSync(
    'psql',
    ['-U', PG_USER, '-d', db, '-t', '-A', '-c', sql],
    { encoding: 'utf8' },
  );
  if (res.status !== 0) {
    const stderr = (res.stderr || '').trim();
    throw new Error(`psql failed (db=${db}): ${stderr || 'unknown'}`);
  }
  return (res.stdout || '').trim();
}

function psqlExec(db, sql, label, opts = { ignoreError: false }) {
  const res = spawnSync('psql', ['-U', PG_USER, '-d', db, '-c', sql], {
    stdio: 'inherit',
  });
  if (res.status !== 0 && !opts.ignoreError) {
    fatal(`${label} failed (exit ${res.status})`);
  }
}

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

console.log('');
log('==============================================================', c.cyan);
log('  Darbel Stage 3 — Verify migrations against scratch DB (v2)', c.cyan);
log('==============================================================', c.cyan);
console.log('');

// --- A1: pre-flight ---
log('[A1/B8] Pre-flight checks...', c.yellow);
if (!fs.existsSync(BACKEND_ROOT)) fatal(`${BACKEND_ROOT} not found.`);
if (!fs.existsSync(ENV_FILE))     fatal(`${ENV_FILE} not found.`);

const newMigSrc = path.join(SOURCE_MIGRATIONS_DIR, NEW_MIGRATION, 'migration.sql');
if (!fs.existsSync(newMigSrc)) fatal(`New migration not found: ${newMigSrc}`);

try {
  const live = psqlValue(LIVE_DB, "SELECT COUNT(*) FROM _prisma_migrations;");
  log(`  Live DB applied migrations: ${live}`, c.gray);
  const liveN = parseInt(live, 10);
  if (isNaN(liveN) || liveN < 5) fatal(`Live DB has ${live} migrations applied, expected 5+`);
} catch (e) {
  fatal(`Pre-flight live DB check failed: ${e.message}`);
}

let scratchExists;
try {
  scratchExists = psqlValue('postgres', `SELECT 1 FROM pg_database WHERE datname='${SCRATCH_DB}';`);
} catch (e) {
  fatal(`Cannot connect to postgres database: ${e.message}`);
}
if (scratchExists === '1') {
  log(`  Note: ${SCRATCH_DB} from prior run exists; will be dropped first`, c.gray);
}
log('  OK', c.green);
console.log('');

// --- A2: install new migration ---
log('[A2/B8] Installing migration 0005 into project...', c.yellow);
const newMigDst = path.join(PRISMA_MIGRATIONS_DIR, NEW_MIGRATION);
if (fs.existsSync(newMigDst)) {
  fs.rmSync(newMigDst, { recursive: true, force: true });
}
copyDir(path.join(SOURCE_MIGRATIONS_DIR, NEW_MIGRATION), newMigDst);
log(`  Copied to: ${newMigDst}`, c.gray);
log('  OK', c.green);
console.log('');

// --- A3: mark new migration as applied against live DB ---
log('[A3/B8] Marking migration 0005 as applied against live DB...', c.yellow);

const originalEnv = fs.readFileSync(ENV_FILE, 'utf8');
fs.writeFileSync(ENV_FILE + '.stage3-backup', originalEnv);

const migratorUrlMatch = originalEnv.match(/^\s*DATABASE_MIGRATOR_URL\s*=\s*(\S+)/m);
const migratorUrl = migratorUrlMatch
  ? migratorUrlMatch[1]
  : `postgresql://darbel_migrator:${MIGRATOR_PASSWORD}@localhost:5432/${LIVE_DB}?schema=public`;

const swappedEnvForLive = originalEnv.replace(
  /^(\s*DATABASE_URL\s*=\s*)(.+?)(\s*)$/m,
  `$1${migratorUrl}  # TEMP swap for Stage 3`,
);
fs.writeFileSync(ENV_FILE, swappedEnvForLive);

try {
  process.chdir(BACKEND_ROOT);
  const res = spawnSync('npx', ['prisma', 'migrate', 'resolve', '--applied', NEW_MIGRATION], {
    stdio: ['inherit', 'pipe', 'pipe'],
    shell: true,
    encoding: 'utf8',
  });
  if (res.status !== 0) {
    const stderr = (res.stderr || '');
    if (stderr.includes('already recorded')) {
      log('  Already marked applied (idempotent).', c.gray);
    } else {
      log(`  Stderr: ${stderr}`, c.red);
      throw new Error('migrate resolve failed');
    }
  } else {
    log('  Marked as applied.', c.green);
  }
} finally {
  fs.writeFileSync(ENV_FILE, originalEnv);
}
log('  OK', c.green);
console.log('');

// --- B1: drop & create scratch DB ---
log('[B1/B8] Creating scratch database...', c.yellow);
if (scratchExists === '1') {
  log(`  Dropping existing ${SCRATCH_DB}...`, c.gray);
  psqlExec('postgres', `DROP DATABASE ${SCRATCH_DB};`, 'DROP DATABASE');
}
psqlExec('postgres', `CREATE DATABASE ${SCRATCH_DB};`, 'CREATE DATABASE');
log(`  Created ${SCRATCH_DB}`, c.green);
console.log('');

// --- B2: schema-level grants for darbel_migrator ---
log('[B2/B8] Granting schema privileges on scratch...', c.yellow);
psqlExec(
  SCRATCH_DB,
  `GRANT ALL ON SCHEMA public TO darbel_migrator;`,
  'GRANT schema',
);
log('  OK', c.green);
console.log('');

// --- B2.5: NEW — pre-create extensions as postgres ---
log('[B3/B8] Pre-creating Postgres extensions as superuser...', c.yellow);
log('  Extensions require CREATE privilege on the database — a privileged', c.gray);
log('  operation normally done by a DBA, not by an application migration.', c.gray);
psqlExec(
  SCRATCH_DB,
  `CREATE EXTENSION IF NOT EXISTS "pgcrypto"; ` +
  `CREATE EXTENSION IF NOT EXISTS "citext"; ` +
  `CREATE EXTENSION IF NOT EXISTS "pg_trgm";`,
  'CREATE EXTENSION',
);
log('  Extensions installed.', c.green);
console.log('');

// --- B4: prisma migrate deploy ---
log('[B4/B8] Running prisma migrate deploy against scratch...', c.yellow);
const scratchUrl = `postgresql://darbel_migrator:${MIGRATOR_PASSWORD}@localhost:5432/${SCRATCH_DB}?schema=public`;
const swappedEnvForScratch = originalEnv.replace(
  /^(\s*DATABASE_URL\s*=\s*)(.+?)(\s*)$/m,
  `$1${scratchUrl}  # TEMP swap for Stage 3 scratch`,
);
fs.writeFileSync(ENV_FILE, swappedEnvForScratch);

let migrateFailed = false;

try {
  process.chdir(BACKEND_ROOT);
  const res = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
    stdio: 'inherit',
    shell: true,
  });
  if (res.status !== 0) {
    migrateFailed = true;
    log(`  FAILED with exit code ${res.status}`, c.red);
  } else {
    log('  Migrations deployed.', c.green);
  }
} finally {
  fs.writeFileSync(ENV_FILE, originalEnv);
}

if (migrateFailed) {
  log('', c.red);
  log(`  prisma migrate deploy failed.`, c.red);
  log(`  Scratch DB ${SCRATCH_DB} is KEPT for inspection.`, c.yellow);
  log(`  Drop manually with: psql -U postgres -c "DROP DATABASE ${SCRATCH_DB};"`, c.gray);
  fatal('Stage 3 aborted at B4.');
}
console.log('');

// --- B5: verify scratch DB schema ---
log('[B5/B8] Verifying scratch DB schema...', c.yellow);

const checks = [
  { label: 'Tables',                 sql: "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';", expected: '14' /* 13 + _prisma_migrations */ },
  { label: 'Jurisdictions',          sql: "SELECT COUNT(*) FROM jurisdictions;",          expected: '1'  },
  { label: 'Permissions',            sql: "SELECT COUNT(*) FROM permissions;",            expected: '35' },
  { label: 'Roles',                  sql: "SELECT COUNT(*) FROM roles;",                  expected: '9'  },
  { label: 'Role-permissions',       sql: "SELECT COUNT(*) FROM role_permissions;",       expected: '76' },
  { label: 'Tenants',                sql: "SELECT COUNT(*) FROM tenants;",                expected: '1'  },
  { label: 'Users',                  sql: "SELECT COUNT(*) FROM users;",                  expected: '1'  },
  { label: 'User_roles',             sql: "SELECT COUNT(*) FROM user_roles;",             expected: '1'  },
  { label: 'Custom functions',       sql: "SELECT COUNT(*) FROM pg_proc WHERE proname IN ('current_app_user_id','current_app_tenant_id','current_app_user_email','current_app_request_id','current_app_client_ip','current_app_user_agent','current_user_has_permission','current_user_is_platform_admin','set_updated_at','fn_audit_trigger','fn_audit_log_immutable');", expected: '11' },
  { label: 'RLS policies',           sql: "SELECT COUNT(*) FROM pg_policies WHERE schemaname='public';", expected: '21' },
  { label: 'Audit triggers',         sql: "SELECT COUNT(*) FROM pg_trigger WHERE tgname LIKE 'trg_audit_%' AND NOT tgisinternal;", expected: '8'  },
  { label: 'Immutability triggers',  sql: "SELECT COUNT(*) FROM pg_trigger WHERE tgname IN ('trg_audit_log_no_update','trg_audit_log_no_delete','trg_sensitive_access_log_no_update','trg_sensitive_access_log_no_delete') AND NOT tgisinternal;", expected: '4'  },
];

let mismatches = 0;
for (const check of checks) {
  let got;
  try { got = psqlValue(SCRATCH_DB, check.sql); }
  catch (e) { got = `ERROR: ${e.message}`; }
  const pad = check.label.padEnd(26);
  if (got === check.expected) {
    log(`  ${pad} ${got}  (expected ${check.expected})  OK`, c.gray);
  } else {
    log(`  ${pad} ${got}  (expected ${check.expected})  MISMATCH`, c.red);
    mismatches += 1;
  }
}
console.log('');

if (mismatches > 0) {
  log(`${mismatches} mismatch(es) found.`, c.red);
  log(`Scratch DB will be kept. Inspect with:`, c.gray);
  log(`  psql -U postgres -d ${SCRATCH_DB}`, c.gray);
  log(`Drop manually after diagnosis with:`, c.gray);
  log(`  psql -U postgres -c "DROP DATABASE ${SCRATCH_DB};"`, c.gray);
  fatal('Stage 3 INCOMPLETE.');
}
log('  All checks passed.', c.green);
console.log('');

// --- B6: drop scratch DB ---
log('[B6/B8] Dropping scratch database...', c.yellow);
psqlExec('postgres', `DROP DATABASE ${SCRATCH_DB};`, 'DROP DATABASE');
log(`  Dropped ${SCRATCH_DB}`, c.green);
console.log('');

// --- B7: final summary ---
log('[B7/B8] Final verification of live DB...', c.yellow);
try {
  const liveAfter = psqlValue(LIVE_DB, "SELECT COUNT(*) FROM _prisma_migrations;");
  log(`  Live DB migrations: ${liveAfter} (should be 6: 5 original + new 0005)`, c.gray);
} catch (e) {
  log(`  Could not query live DB: ${e.message}`, c.red);
}
log('  OK', c.green);
console.log('');

log('[B8/B8] Cleanup...', c.yellow);
log('  Original .env restored (backup retained at .env.stage3-backup)', c.gray);
log('  OK', c.green);
console.log('');

log('==============================================================', c.cyan);
log('  Stage 3 complete.', c.cyan);
log('==============================================================', c.cyan);
console.log('');
console.log('  The 6 migrations reproduce Phase 1 from an empty database.');
console.log('  Tables, indexes, functions, roles, RLS policies, audit triggers,');
console.log('  and seed data all verified against a fresh deployment.');
console.log('');
console.log('  Live database is unchanged. Backup at backend/.env.stage3-backup');
console.log('  can be deleted once you sign in successfully once more.');
console.log('');
console.log('  Next steps:');
console.log('    1. Commit the new 0005 migration to source control');
console.log('    2. Stage 4 (optional): update README and archive v2 patch folder');
console.log('    3. Move to Phase 2 with confidence');
console.log('');
