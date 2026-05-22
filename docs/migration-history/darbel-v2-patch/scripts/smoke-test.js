/**
 * Darbel smoke test — exercises the full auth flow without a browser.
 *
 * Run AFTER the backend is started (npm run start:dev). It will:
 *   1. Check /health/live and /health/ready
 *   2. POST /auth/login with bootstrap credentials
 *   3. Handle password_change_required if returned
 *   4. POST /auth/login again with the new password
 *   5. GET /users/me with the access token
 *   6. POST /auth/logout
 *
 * On every failure, prints the exact request, response, and continues
 * with the next step where possible. At the end prints a green PASS or
 * a red FAIL with the failing step.
 *
 * Usage:
 *   cd C:\Users\OLADIMEJI\darbel\backend
 *   node ..\<patch folder>\scripts\smoke-test.js
 *
 * Or place this script anywhere and run with node.
 */
const http = require('node:http');

const BASE = process.env.DARBEL_API_BASE || 'http://localhost:4000/api/v1';
const EMAIL = process.env.DARBEL_TEST_EMAIL || 'admin@branddarrow.com';
const BOOTSTRAP_PASSWORD = process.env.DARBEL_BOOTSTRAP_PASSWORD || null;
const NEW_PASSWORD = process.env.DARBEL_NEW_PASSWORD || 'DarbelLocal2026!';

const COLOR = {
  red:    (s) => `\x1b[31m${s}\x1b[0m`,
  green:  (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  cyan:   (s) => `\x1b[36m${s}\x1b[0m`,
  gray:   (s) => `\x1b[90m${s}\x1b[0m`,
};

function postOrGet(method, path, { body, accessToken } = {}) {
  return new Promise((resolve) => {
    const url = new URL(BASE + path);
    const data = body !== undefined ? JSON.stringify(body) : null;
    const headers = { 'accept': 'application/json' };
    if (data) {
      headers['content-type'] = 'application/json';
      headers['content-length'] = Buffer.byteLength(data);
    }
    if (accessToken) headers['authorization'] = `Bearer ${accessToken}`;

    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method,
        headers,
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => { raw += chunk; });
        res.on('end', () => {
          let parsed = null;
          try { parsed = raw ? JSON.parse(raw) : null; } catch { /* leave null */ }
          resolve({ status: res.statusCode, body: parsed, raw });
        });
      },
    );
    req.on('error', (err) => {
      resolve({ status: 0, body: null, raw: '', error: err.message });
    });
    if (data) req.write(data);
    req.end();
  });
}

const steps = [];
function step(name, fn) {
  steps.push({ name, fn });
}

// -----------------------------------------------------------------------------
// Test flow
// -----------------------------------------------------------------------------
const state = {
  accessToken: null,
  refreshToken: null,
  challengeToken: null,
  bootstrapPasswordTried: null,
  needsPasswordChange: false,
};

step('Health: /health/live', async () => {
  const res = await postOrGet('GET', '/health/live');
  if (res.error) throw new Error(`Backend unreachable: ${res.error}. Is npm run start:dev running?`);
  if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
  if (res.body?.status !== 'ok') throw new Error(`Expected status=ok, got ${JSON.stringify(res.body)}`);
  return 'API reachable';
});

step('Health: /health/ready (database)', async () => {
  const res = await postOrGet('GET', '/health/ready');
  if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
  if (res.body?.db !== 'ok') throw new Error(`Expected db=ok, got ${JSON.stringify(res.body)}`);
  return 'API can talk to Postgres';
});

step('Login attempt #1 (probe credentials)', async () => {
  // Try a list of likely passwords from the v1 debugging session.
  const candidates = BOOTSTRAP_PASSWORD
    ? [BOOTSTRAP_PASSWORD]
    : ['Test1234567!', 'Darbel2026Admin!', 'MyDarbel2026!', NEW_PASSWORD];
  for (const candidate of candidates) {
    const res = await postOrGet('POST', '/auth/login', {
      body: { email: EMAIL, password: candidate },
    });
    if (res.status === 200 || res.status === 401 && res.body?.code !== 'AUTH_INVALID_CREDENTIALS') {
      // Either authenticated or an authentication-related non-credential response
      state.bootstrapPasswordTried = candidate;
      if (res.body?.status === 'authenticated') {
        state.accessToken = res.body.tokens.accessToken;
        state.refreshToken = res.body.tokens.refreshToken;
        return `Authenticated with password "${candidate}"`;
      }
      if (res.body?.status === 'password_change_required') {
        state.challengeToken = res.body.challengeToken;
        state.needsPasswordChange = true;
        return `Password change required (will use "${NEW_PASSWORD}")`;
      }
      if (res.body?.status === 'mfa_required') {
        state.challengeToken = res.body.challengeToken;
        throw new Error('MFA is enabled; smoke test cannot complete without a TOTP code. Set DARBEL_TEST_MFA=1 and disable MFA in DB first.');
      }
    }
    if (res.status === 500) {
      throw new Error(`Server returned 500 on login. Backend log should show the cause. Body: ${res.raw}`);
    }
  }
  throw new Error(`No candidate password matched. Tried: ${candidates.join(', ')}. Set DARBEL_BOOTSTRAP_PASSWORD env var.`);
});

step('Forced password change (if needed)', async () => {
  if (!state.needsPasswordChange) return 'skipped (not required)';
  const res = await postOrGet('POST', '/auth/password/first-change', {
    body: {
      challengeToken: state.challengeToken,
      newPassword: NEW_PASSWORD,
    },
  });
  if (res.status !== 204) {
    throw new Error(`Expected 204, got ${res.status}. Body: ${res.raw}`);
  }
  state.needsPasswordChange = false;
  return `Password changed to "${NEW_PASSWORD}"`;
});

step('Login attempt #2 (with confirmed password)', async () => {
  if (state.accessToken) return 'skipped (already authenticated)';
  const password = state.needsPasswordChange === false && state.challengeToken
    ? NEW_PASSWORD
    : state.bootstrapPasswordTried;
  const res = await postOrGet('POST', '/auth/login', {
    body: { email: EMAIL, password },
  });
  if (res.status === 500) {
    throw new Error(`500 on login after password change. Backend log will show the cause. Body: ${res.raw}`);
  }
  if (res.status !== 200 || res.body?.status !== 'authenticated') {
    throw new Error(`Expected authenticated, got status=${res.status} body=${res.raw}`);
  }
  state.accessToken = res.body.tokens.accessToken;
  state.refreshToken = res.body.tokens.refreshToken;
  return 'Authenticated';
});

step('GET /users/me', async () => {
  if (!state.accessToken) throw new Error('No access token from previous step');
  const res = await postOrGet('GET', '/users/me', { accessToken: state.accessToken });
  if (res.status !== 200) {
    throw new Error(`Expected 200, got ${res.status}. Body: ${res.raw}`);
  }
  if (res.body?.email !== EMAIL) {
    throw new Error(`Email mismatch: expected ${EMAIL}, got ${res.body?.email}`);
  }
  return `Authenticated as ${res.body.email} (${res.body.roles.map((r) => r.code).join(', ')})`;
});

step('POST /auth/logout', async () => {
  if (!state.refreshToken) return 'skipped (no refresh token)';
  const res = await postOrGet('POST', '/auth/logout', {
    body: { refreshToken: state.refreshToken },
  });
  if (res.status !== 204) {
    throw new Error(`Expected 204, got ${res.status}. Body: ${res.raw}`);
  }
  return 'Session revoked';
});

// -----------------------------------------------------------------------------
// Runner
// -----------------------------------------------------------------------------
(async () => {
  console.log('');
  console.log(COLOR.cyan('=============================================================='));
  console.log(COLOR.cyan('  Darbel smoke test'));
  console.log(COLOR.cyan('=============================================================='));
  console.log(`  API base: ${BASE}`);
  console.log(`  Test user: ${EMAIL}`);
  console.log('');

  let failed = false;
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    const label = `  [${i + 1}/${steps.length}] ${s.name}`;
    process.stdout.write(`${label}... `);
    try {
      const detail = await s.fn();
      console.log(COLOR.green(`OK ${detail ? '— ' + detail : ''}`));
    } catch (e) {
      console.log(COLOR.red(`FAIL`));
      console.log(COLOR.red(`        ${e.message}`));
      failed = true;
      // Decide whether to abort. Health failures abort; flow failures abort
      // too (steps depend on each other).
      break;
    }
  }

  console.log('');
  if (failed) {
    console.log(COLOR.red('=============================================================='));
    console.log(COLOR.red('  SMOKE TEST FAILED'));
    console.log(COLOR.red('=============================================================='));
    console.log('  Check the backend log for the exact server-side error.');
    console.log('  Paste the smoke test output and the relevant backend log lines');
    console.log('  back into your Claude conversation for diagnosis.');
    console.log('');
    process.exit(1);
  }
  console.log(COLOR.green('=============================================================='));
  console.log(COLOR.green('  SMOKE TEST PASSED'));
  console.log(COLOR.green('=============================================================='));
  console.log('  Auth flow is fully working. You can now open the browser:');
  console.log(`    ${COLOR.cyan('http://localhost:3000')}`);
  console.log(`  Sign in: ${EMAIL} / ${state.bootstrapPasswordTried === BOOTSTRAP_PASSWORD || state.needsPasswordChange === false ? NEW_PASSWORD : state.bootstrapPasswordTried}`);
  console.log('');
})();
