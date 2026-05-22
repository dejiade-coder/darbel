/**
 * Darbel Stage 2 — Prisma migration baseline (v2).
 *
 * Difference from v1:
 *   - Grants CREATE ON SCHEMA public to darbel_migrator (was missing from v1+v2 SQL)
 *   - Temporarily swaps DATABASE_URL in backend/.env to darbel_migrator while
 *     prisma migrate resolve runs (Prisma reads .env unconditionally and
 *     ignores shell env vars when .env is present)
 *   - Restores backend/.env to its original state after
 *   - Will not start if backend or frontend is running (Prisma file lock)
 *
 * Usage:
 *   node apply-stage2.js
 */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const DARBEL_ROOT = 'C:\\Users\\OLADIMEJI\\darbel';
const BACKEND_ROOT = path.join(DARBEL_ROOT, 'backend');
const ENV_FILE = path.join(BACKEND_ROOT, '.env');
const PRISMA_MIGRATIONS_DIR = path.join(BACKEND_ROOT, 'prisma', 'migrations');
const PATCH_ROOT = __dirname;
const SOURCE_MIGRATIONS_DIR = path.join(PATCH_ROOT, 'migrations');
const PG_USER = 'postgres';
const PG_DB = 'darbel';

const MIGRATIONS = [
  '20260521120000_extensions',
  '20260521120001_init',
  '20260521120002_functions_and_roles',
  '20260521120003_rls_and_triggers',
  '20260521120004_seed',
];

const c = {
  red:    (s) => `\x1b[31m${s}\x1b[0m`,
  green:  (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  cyan:   (s) => `\x1b[36m${s}\x1b[0m`,
  gray:   (s) => `\x1b[90m${s}\x1b[0m`,
};

function log(msg, colour) { console.log(colour ? colour(msg) : msg); }
function fatal(msg) { log('ERROR: ' + msg, c.red); process.exit(1); }

function psqlValue(sql) {
  try {
    const out = execFileSync(
      'psql',
      ['-U', PG_USER, '-d', PG_DB, '-t', '-A', '-c', sql],
      { encoding: 'utf8' },
    );
    return out.trim();
  } catch (e) {
    return null;
  }
}

function psqlExec(sql, label) {
  try {
    execFileSync('psql', ['-U', PG_USER, '-d', PG_DB, '-c', sql], {
      stdio: 'inherit',
    });
  } catch (e) {
    fatal(`${label} failed: ${e.message}`);
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

// -----------------------------------------------------------------------------
// .env helpers — swap DATABASE_URL to migrator for the duration of prisma calls
// -----------------------------------------------------------------------------
function readEnv() {
  return fs.readFileSync(ENV_FILE, 'utf8');
}

function swapDatabaseUrl(envText, migratorUrl) {
  // Capture original DATABASE_URL line; replace with migrator one.
  // Also tolerate the line being commented or having Windows CRLF.
  const lines = envText.split(/\r?\n/);
  let originalLine = null;
  const swapped = lines.map((line) => {
    const m = line.match(/^\s*DATABASE_URL\s*=\s*(.+?)\s*$/);
    if (m && !line.trim().startsWith('#') && originalLine === null) {
      originalLine = line;
      return `DATABASE_URL=${migratorUrl}  # TEMP swap for Stage 2 baseline`;
    }
    return line;
  });
  return { swapped: swapped.join('\n'), originalLine };
}

console.log('');
log('==============================================================', c.cyan);
log('  Darbel Stage 2 — Prisma migration baseline (v2)', c.cyan);
log('==============================================================', c.cyan);
console.log('');

// --- Step 1: pre-flight ---
log('[1/6] Pre-flight checks...', c.yellow);
if (!fs.existsSync(BACKEND_ROOT))      fatal(`${BACKEND_ROOT} not found.`);
if (!fs.existsSync(ENV_FILE))          fatal(`${ENV_FILE} not found.`);
if (!fs.existsSync(SOURCE_MIGRATIONS_DIR)) fatal(`${SOURCE_MIGRATIONS_DIR} not found`);
for (const m of MIGRATIONS) {
  if (!fs.existsSync(path.join(SOURCE_MIGRATIONS_DIR, m, 'migration.sql'))) {
    fatal(`Migration ${m}/migration.sql missing in patch`);
  }
}
log('  Backend:    ' + BACKEND_ROOT, c.gray);
log('  .env:       ' + ENV_FILE, c.gray);
log('  Source:     ' + SOURCE_MIGRATIONS_DIR, c.gray);
log('  Target:     ' + PRISMA_MIGRATIONS_DIR, c.gray);
log('  OK', c.green);
console.log('');

// --- Step 2: live state checks ---
log('[2/6] Verifying live database state...', c.yellow);

const tableCount = psqlValue(
  "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';",
);
log(`  Tables present:           ${tableCount} (expected 13)`, c.gray);
if (tableCount !== '13') fatal(`Expected 13 tables, found ${tableCount}.`);

const roleCount = psqlValue(
  "SELECT COUNT(*) FROM pg_roles WHERE rolname IN ('darbel_app','darbel_auth','darbel_migrator');",
);
log(`  Custom roles:             ${roleCount} (expected 3)`, c.gray);
if (roleCount !== '3') fatal(`Expected 3 custom roles, found ${roleCount}.`);

const migratorCreate = psqlValue(
  "SELECT has_schema_privilege('darbel_migrator', 'public', 'CREATE');",
);
log(`  darbel_migrator CREATE:   ${migratorCreate === 't' ? 'yes' : 'no (will grant)'}`, c.gray);

const prismaTable = psqlValue(
  "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='_prisma_migrations';",
);
log(`  _prisma_migrations table: ${prismaTable === '1' ? 'EXISTS (will reuse)' : 'absent (will be created by Prisma)'}`, c.gray);

log('  OK', c.green);
console.log('');

// --- Step 3: grant CREATE on schema if missing ---
log('[3/6] Ensuring darbel_migrator has CREATE on schema public...', c.yellow);
if (migratorCreate !== 't') {
  log('  Granting CREATE (psql password prompt)...', c.gray);
  psqlExec('GRANT CREATE ON SCHEMA public TO darbel_migrator;', 'GRANT CREATE');
  log('  Granted.', c.green);
} else {
  log('  Already granted.', c.gray);
}
log('  OK', c.green);
console.log('');

// --- Step 4: copy migrations ---
log('[4/6] Copying migration files into project...', c.yellow);
fs.mkdirSync(PRISMA_MIGRATIONS_DIR, { recursive: true });

const lockFileSrc = path.join(SOURCE_MIGRATIONS_DIR, 'migration_lock.toml');
const lockFileDst = path.join(PRISMA_MIGRATIONS_DIR, 'migration_lock.toml');
fs.copyFileSync(lockFileSrc, lockFileDst);
log('  copied: migration_lock.toml', c.gray);

for (const m of MIGRATIONS) {
  const src = path.join(SOURCE_MIGRATIONS_DIR, m);
  const dst = path.join(PRISMA_MIGRATIONS_DIR, m);
  if (fs.existsSync(dst)) {
    fs.rmSync(dst, { recursive: true, force: true });
  }
  copyDir(src, dst);
  log(`  copied: ${m}/`, c.gray);
}
log('  OK', c.green);
console.log('');

// --- Step 5: temporarily swap .env to migrator, run prisma resolve, restore ---
log('[5/6] Baselining migrations (temp .env swap)...', c.yellow);

// Read original .env
const originalEnv = readEnv();
fs.writeFileSync(ENV_FILE + '.stage2-backup', originalEnv);
log('  Backed up .env to .env.stage2-backup', c.gray);

// Build migrator URL — try to read it from existing DATABASE_MIGRATOR_URL,
// fall back to the local-dev default
let migratorUrl = null;
const m = originalEnv.match(/^\s*DATABASE_MIGRATOR_URL\s*=\s*(\S+)/m);
if (m) {
  migratorUrl = m[1];
  log('  Using DATABASE_MIGRATOR_URL from .env', c.gray);
} else {
  migratorUrl = 'postgresql://darbel_migrator:migrator_pass_local_2026@localhost:5432/darbel?schema=public';
  log('  No DATABASE_MIGRATOR_URL in .env; using local-dev default', c.gray);
}

const { swapped, originalLine } = swapDatabaseUrl(originalEnv, migratorUrl);
if (!originalLine) {
  fatal('Could not find an active DATABASE_URL line in .env to swap.');
}
fs.writeFileSync(ENV_FILE, swapped);
log('  Swapped DATABASE_URL to migrator (in-memory & on-disk)', c.gray);

let baselineFailed = false;
let failureMessage = null;

try {
  process.chdir(BACKEND_ROOT);
  console.log('');
  for (const m of MIGRATIONS) {
    try {
      log(`  ${m}...`, c.gray);
      execFileSync('npx', ['prisma', 'migrate', 'resolve', '--applied', m], {
        stdio: ['inherit', 'pipe', 'pipe'],
        shell: true,
      });
      log(`    OK`, c.green);
    } catch (e) {
      const stderr = (e.stderr || '').toString();
      if (stderr.includes('already recorded')) {
        log(`    already marked applied, skipping`, c.gray);
        continue;
      }
      baselineFailed = true;
      failureMessage = stderr || e.message;
      log(`    FAILED`, c.red);
      log(`    ${failureMessage}`, c.red);
      break;
    }
  }
} finally {
  // Always restore the original .env — even if prisma resolve threw
  fs.writeFileSync(ENV_FILE, originalEnv);
  log('  Restored original .env (kept .env.stage2-backup as belt-and-braces)', c.gray);
}

if (baselineFailed) {
  console.log('');
  fatal('Baseline failed. Original .env is restored. See error above.');
}

log('  OK', c.green);
console.log('');

// --- Step 6: verify ---
log('[6/6] Verifying baseline state...', c.yellow);
const migrationsRecorded = psqlValue(
  "SELECT COUNT(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL;",
);
log(`  Migrations recorded as applied: ${migrationsRecorded} (expected 5)`, c.gray);

if (migrationsRecorded !== '5') {
  fatal(`Expected 5 applied migrations, got ${migrationsRecorded}.`);
}
log('  OK', c.green);
console.log('');

log('==============================================================', c.cyan);
log('  Stage 2 complete.', c.cyan);
log('==============================================================', c.cyan);
console.log('');
console.log('  Your live database is now Prisma-managed.');
console.log('');
console.log('  Verify in psql:');
console.log('    psql -U postgres -d darbel -c "SELECT migration_name,');
console.log('      finished_at FROM _prisma_migrations ORDER BY started_at;"');
console.log('');
console.log('  The backup at backend/.env.stage2-backup can be deleted once');
console.log('  you have signed in successfully one more time.');
console.log('');
console.log('  Next step (Stage 3): test against a scratch database.');
console.log('');
