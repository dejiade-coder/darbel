/**
 * Darbel v2 patch — apply script (Node)
 *
 * Replaces the PowerShell apply script with a Node.js version that does not
 * have signing, encoding, or execution-policy issues.
 *
 * Usage (from the unpacked patch folder):
 *   node apply-patch.js
 */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

// --- Configuration ---
const DARBEL_ROOT = 'C:\\Users\\OLADIMEJI\\darbel';
const BACKEND_ROOT = path.join(DARBEL_ROOT, 'backend');
const PATCH_ROOT = __dirname;
const PG_USER = 'postgres';
const PG_DB = 'darbel';
const AUTH_PASSWORD = 'auth_pass_local_2026';

// --- Colour helpers ---
const c = {
  red:    (s) => `\x1b[31m${s}\x1b[0m`,
  green:  (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  cyan:   (s) => `\x1b[36m${s}\x1b[0m`,
  gray:   (s) => `\x1b[90m${s}\x1b[0m`,
};

function log(msg, colour) {
  if (colour) console.log(colour(msg));
  else console.log(msg);
}

function fatal(msg) {
  log('ERROR: ' + msg, c.red);
  process.exit(1);
}

function runPsql(args, label) {
  // psql will prompt for password interactively. We let it through.
  try {
    execFileSync('psql', args, { stdio: 'inherit' });
  } catch (e) {
    fatal(`${label} failed: ${e.message}`);
  }
}

function runPsqlCapture(sql) {
  // Capture single-value output via -t -A
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

// --- Banner ---
console.log('');
log('==============================================================', c.cyan);
log('  Darbel v2 patch — apply', c.cyan);
log('==============================================================', c.cyan);
console.log('');

// --- Step 1: sanity checks ---
log('[1/6] Sanity checks...', c.yellow);
if (!fs.existsSync(DARBEL_ROOT))   fatal(`${DARBEL_ROOT} does not exist.`);
if (!fs.existsSync(BACKEND_ROOT))  fatal(`${BACKEND_ROOT} does not exist.`);
if (!fs.existsSync(path.join(BACKEND_ROOT, '.env'))) {
  fatal(`${BACKEND_ROOT}\\.env not found. Run v1 setup first.`);
}
log(`  Darbel root: ${DARBEL_ROOT}`, c.gray);
log(`  Backend:     ${BACKEND_ROOT}`, c.gray);
log(`  Patch root:  ${PATCH_ROOT}`, c.gray);
log('  OK', c.green);
console.log('');

// --- Step 2: apply SQL ---
log('[2/6] Applying database patch...', c.yellow);
log('  psql will prompt for the postgres password.', c.gray);
const sqlFile = path.join(PATCH_ROOT, 'database', '05-fix-v2.sql');
if (!fs.existsSync(sqlFile)) fatal(`SQL file not found: ${sqlFile}`);
runPsql(['-U', PG_USER, '-d', PG_DB, '-f', sqlFile], 'SQL patch');
log('  OK', c.green);
console.log('');

// --- Step 3: set darbel_auth password ---
log('[3/6] Setting password on darbel_auth role...', c.yellow);
log(`  Local-dev password: ${AUTH_PASSWORD}`, c.gray);
runPsql(
  ['-U', PG_USER, '-d', PG_DB, '-c', `ALTER ROLE darbel_auth PASSWORD '${AUTH_PASSWORD}';`],
  'ALTER ROLE',
);
log('  OK', c.green);
console.log('');

// --- Step 4: copy backend patches ---
log('[4/6] Copying backend source patches...', c.yellow);
const patches = [
  ['backend-patches/auth.module.ts',    'src/modules/auth/auth.module.ts'],
  ['backend-patches/roles.module.ts',   'src/modules/roles/roles.module.ts'],
  ['backend-patches/audit.module.ts',   'src/modules/audit/audit.module.ts'],
  ['backend-patches/prisma.service.ts', 'src/database/prisma.service.ts'],
  ['backend-patches/env.schema.ts',     'src/config/env.schema.ts'],
];
for (const [src, dst] of patches) {
  const srcPath = path.join(PATCH_ROOT, src);
  const dstPath = path.join(BACKEND_ROOT, dst);
  if (!fs.existsSync(srcPath)) fatal(`Patch missing: ${srcPath}`);
  fs.mkdirSync(path.dirname(dstPath), { recursive: true });
  fs.copyFileSync(srcPath, dstPath);
  log(`  patched: ${dst}`, c.gray);
}
log('  OK', c.green);
console.log('');

// --- Step 5: ensure DATABASE_AUTH_URL in .env ---
log('[5/6] Ensuring DATABASE_AUTH_URL is in backend\\.env...', c.yellow);
const envFile = path.join(BACKEND_ROOT, '.env');
let envContent = fs.readFileSync(envFile, 'utf8');
if (/DATABASE_AUTH_URL\s*=/.test(envContent)) {
  log('  DATABASE_AUTH_URL already present.', c.gray);
} else {
  const authLine = `\n# --- Auth bootstrap connection (added by v2 patch) ---\nDATABASE_AUTH_URL=postgresql://darbel_auth:${AUTH_PASSWORD}@localhost:5432/darbel?schema=public\n`;
  fs.appendFileSync(envFile, authLine);
  log('  Appended DATABASE_AUTH_URL to .env', c.gray);
}
log('  OK', c.green);
console.log('');

// --- Step 6: verify ---
log('[6/6] Verifying patch state...', c.yellow);
const grantCount = runPsqlCapture(
  "SELECT COUNT(*) FROM information_schema.role_table_grants WHERE grantee='darbel_auth';",
);
log(`  darbel_auth table grants: ${grantCount} (expected at least 10)`, c.gray);

const leftover = runPsqlCapture(
  "SELECT COUNT(*) FROM pg_policies WHERE policyname IN ('users_login_lookup','tenants_login_lookup','users_login_update','sessions_login_insert');",
);
log(`  v1 patchwork policies remaining: ${leftover} (expected 0)`, c.gray);

const prismaPath = path.join(BACKEND_ROOT, 'src/database/prisma.service.ts');
const prismaText = fs.readFileSync(prismaPath, 'utf8');
if (prismaText.includes('public readonly auth')) {
  log('  prisma.service.ts: dual-client present', c.gray);
} else {
  log('  prisma.service.ts: dual-client MISSING', c.red);
}

console.log('');
log('==============================================================', c.cyan);
log('  Patch applied. Next steps:', c.cyan);
log('==============================================================', c.cyan);
console.log('');
console.log(`  1. cd ${BACKEND_ROOT}`);
console.log('  2. npx prisma generate');
console.log('  3. npm run start:dev');
console.log('  4. In another window: node ' + path.join(PATCH_ROOT, 'scripts', 'smoke-test.js'));
console.log('');
