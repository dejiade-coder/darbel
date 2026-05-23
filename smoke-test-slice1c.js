/**
 * Darbel Slice 1c smoke test.
 *
 * Exercises the trade-categories endpoints end-to-end after authenticating
 * as the bootstrap admin (who has SUPER_ADMIN + TENANT_ADMIN-equivalent
 * permissions in Phase 1's seed data).
 *
 * Verifies:
 *   1. Auth works (login + token)
 *   2. GET /trade-categories returns 10 categories with fee=null
 *   3. PUT /trade-categories/:id/fee sets a fee successfully
 *   4. GET /trade-categories with withFeeOnly=true returns 1 category
 *      (the one we just set a fee for)
 *   5. PUT /trade-categories/:id/fee updates the existing fee
 *   6. DELETE /trade-categories/:id/fee removes it
 *   7. GET with withFeeOnly=true returns 0 again
 *   8. Logout
 *
 * Usage:
 *   $env:DARBEL_BOOTSTRAP_PASSWORD = "Blessing@22."
 *   node smoke-test-slice1c.js
 */
const http = require('node:http');

const BASE = process.env.DARBEL_API_BASE || 'http://localhost:4000/api/v1';
const EMAIL = process.env.DARBEL_TEST_EMAIL || 'admin@branddarrow.com';
const BOOTSTRAP_PASSWORD = process.env.DARBEL_BOOTSTRAP_PASSWORD;
const NEW_PASSWORD = process.env.DARBEL_NEW_PASSWORD || 'DarbelLocal2026!';

if (!BOOTSTRAP_PASSWORD) {
  console.error('ERROR: Set DARBEL_BOOTSTRAP_PASSWORD before running.');
  console.error('  $env:DARBEL_BOOTSTRAP_PASSWORD = "Blessing@22."');
  process.exit(1);
}

const COLOR = {
  red:    (s) => `\x1b[31m${s}\x1b[0m`,
  green:  (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  cyan:   (s) => `\x1b[36m${s}\x1b[0m`,
  gray:   (s) => `\x1b[90m${s}\x1b[0m`,
};

function request(method, path, { body, accessToken } = {}) {
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
function step(name, fn) { steps.push({ name, fn }); }

const state = {
  accessToken: null,
  refreshToken: null,
  passwordTried: BOOTSTRAP_PASSWORD,
  categories: null,
  testCategoryId: null,
};

// ----- Step 1: health -----
step('Health: /health/live', async () => {
  const res = await request('GET', '/health/live');
  if (res.error) throw new Error(`Backend unreachable: ${res.error}`);
  if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
  return 'API reachable';
});

// ----- Step 2: login -----
step('Auth: login as admin', async () => {
  const tryLogin = async (password) => {
    return request('POST', '/auth/login', {
      body: { email: EMAIL, password },
    });
  };

  let res = await tryLogin(state.passwordTried);

  // Auth flow may indicate password change is required
  if (res.status === 200 && res.body?.passwordChangeRequired) {
    const changeRes = await request('POST', '/auth/change-password', {
      body: {
        challengeToken: res.body.challengeToken,
        currentPassword: state.passwordTried,
        newPassword: NEW_PASSWORD,
      },
    });
    if (changeRes.status !== 200) {
      throw new Error(`change-password failed: ${changeRes.status} ${JSON.stringify(changeRes.body)}`);
    }
    state.passwordTried = NEW_PASSWORD;
    res = await tryLogin(state.passwordTried);
  }

  // Try common alternates if initial password failed
  if (res.status === 401 && state.passwordTried !== NEW_PASSWORD) {
    res = await tryLogin(NEW_PASSWORD);
    if (res.status === 200) state.passwordTried = NEW_PASSWORD;
  }

  if (res.status !== 200) {
    throw new Error(`Login failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  // Token can come back at body.tokens.accessToken (nested envelope) or
  // body.accessToken (legacy/alternative shape). Check both.
  const token = res.body?.tokens?.accessToken ?? res.body?.accessToken;
  const refresh = res.body?.tokens?.refreshToken ?? res.body?.refreshToken;
  if (!token) {
    throw new Error(`No accessToken in response: ${JSON.stringify(res.body)}`);
  }
  state.accessToken = token;
  state.refreshToken = refresh;
  return `accessToken received (${state.accessToken.length} chars)`;
});

// ----- Step 3: list categories -----
step('GET /trade-categories returns 10 categories', async () => {
  const res = await request('GET', '/trade-categories', { accessToken: state.accessToken });
  if (res.status !== 200) {
    throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
  }
  if (!Array.isArray(res.body)) {
    throw new Error(`Expected array, got ${typeof res.body}: ${JSON.stringify(res.body)}`);
  }
  if (res.body.length !== 10) {
    throw new Error(`Expected 10 categories, got ${res.body.length}`);
  }
  // Validate shape
  for (const cat of res.body) {
    if (!cat.id || !cat.code || !cat.sector) {
      throw new Error(`Malformed category: ${JSON.stringify(cat)}`);
    }
  }
  state.categories = res.body;
  state.testCategoryId = res.body.find((c) => c.code === 'STREET_VENDOR')?.id;
  if (!state.testCategoryId) {
    throw new Error('STREET_VENDOR category not found in list');
  }
  return `10 categories OK, using STREET_VENDOR (${state.testCategoryId.slice(0, 8)}...) for fee tests`;
});

// ----- Step 4: all fees null initially -----
step('All categories have fee=null initially', async () => {
  const allNull = state.categories.every((c) => c.fee === null);
  if (!allNull) {
    const withFees = state.categories.filter((c) => c.fee !== null);
    throw new Error(`Expected all fee=null, but ${withFees.length} have fees: ${withFees.map(c => c.code).join(',')}`);
  }
  return 'all 10 categories have fee=null';
});

// ----- Step 5: set fee for STREET_VENDOR -----
step('PUT /trade-categories/:id/fee sets a fee', async () => {
  const res = await request('PUT', `/trade-categories/${state.testCategoryId}/fee`, {
    accessToken: state.accessToken,
    body: { feeAmount: 5000.00, currency: 'NGN' },
  });
  if (res.status !== 200) {
    throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
  }
  if (!res.body?.feeAmount) {
    throw new Error(`No feeAmount in response: ${JSON.stringify(res.body)}`);
  }
  if (parseFloat(res.body.feeAmount) !== 5000.00) {
    throw new Error(`Expected feeAmount=5000, got ${res.body.feeAmount}`);
  }
  return `fee set: ${res.body.feeAmount} ${res.body.currency}`;
});

// ----- Step 6: withFeeOnly returns just one -----
step('GET ?withFeeOnly=true returns 1 category', async () => {
  const res = await request('GET', '/trade-categories?withFeeOnly=true', { accessToken: state.accessToken });
  if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
  if (!Array.isArray(res.body)) throw new Error('Expected array');
  if (res.body.length !== 1) {
    throw new Error(`Expected 1 category, got ${res.body.length}`);
  }
  if (res.body[0].code !== 'STREET_VENDOR') {
    throw new Error(`Expected STREET_VENDOR, got ${res.body[0].code}`);
  }
  if (!res.body[0].fee || parseFloat(res.body[0].fee.amount) !== 5000.00) {
    throw new Error(`Fee shape wrong: ${JSON.stringify(res.body[0].fee)}`);
  }
  return '1 category with fee, correctly STREET_VENDOR at 5000 NGN';
});

// ----- Step 7: update fee -----
step('PUT /trade-categories/:id/fee updates fee', async () => {
  const res = await request('PUT', `/trade-categories/${state.testCategoryId}/fee`, {
    accessToken: state.accessToken,
    body: { feeAmount: 5500.00 },
  });
  if (res.status !== 200) {
    throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
  }
  if (parseFloat(res.body.feeAmount) !== 5500.00) {
    throw new Error(`Expected updated feeAmount=5500, got ${res.body.feeAmount}`);
  }
  return `fee updated to ${res.body.feeAmount}`;
});

// ----- Step 8: delete fee -----
step('DELETE /trade-categories/:id/fee removes fee', async () => {
  const res = await request('DELETE', `/trade-categories/${state.testCategoryId}/fee`, {
    accessToken: state.accessToken,
  });
  if (res.status !== 204) {
    throw new Error(`Expected 204, got ${res.status}: ${JSON.stringify(res.body)}`);
  }
  return 'fee deleted (204)';
});

// ----- Step 9: confirm withFeeOnly returns 0 -----
step('GET ?withFeeOnly=true returns 0 after delete', async () => {
  const res = await request('GET', '/trade-categories?withFeeOnly=true', { accessToken: state.accessToken });
  if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
  if (res.body.length !== 0) {
    throw new Error(`Expected 0 categories, got ${res.body.length}`);
  }
  return 'no categories with fees, as expected';
});

// ----- Step 10: logout -----
step('POST /auth/logout', async () => {
  const res = await request('POST', '/auth/logout', {
    accessToken: state.accessToken,
    body: { refreshToken: state.refreshToken },
  });
  if (res.status !== 204 && res.status !== 200) {
    throw new Error(`Expected 204 or 200, got ${res.status}: ${JSON.stringify(res.body)}`);
  }
  return 'logged out';
});

// ----- Run all steps -----
async function run() {
  console.log('');
  console.log(COLOR.cyan('============================================================'));
  console.log(COLOR.cyan('  Darbel Slice 1c smoke test — trade-categories endpoints'));
  console.log(COLOR.cyan('============================================================'));
  console.log('');
  console.log(COLOR.gray(`  BASE:  ${BASE}`));
  console.log(COLOR.gray(`  EMAIL: ${EMAIL}`));
  console.log('');

  let passed = 0;
  let failed = 0;

  for (const { name, fn } of steps) {
    process.stdout.write(`  ${name.padEnd(50)} ... `);
    try {
      const result = await fn();
      console.log(COLOR.green('OK') + (result ? COLOR.gray(`  (${result})`) : ''));
      passed += 1;
    } catch (e) {
      console.log(COLOR.red('FAIL'));
      console.log(COLOR.red('    ' + e.message));
      failed += 1;
    }
  }

  console.log('');
  if (failed === 0) {
    console.log(COLOR.green(`============================================================`));
    console.log(COLOR.green(`  SLICE 1C SMOKE TEST PASSED — ${passed}/${passed} steps`));
    console.log(COLOR.green(`============================================================`));
    process.exit(0);
  } else {
    console.log(COLOR.red(`============================================================`));
    console.log(COLOR.red(`  SLICE 1C SMOKE TEST FAILED — ${failed} of ${steps.length} steps`));
    console.log(COLOR.red(`============================================================`));
    process.exit(1);
  }
}

run().catch((e) => {
  console.error(COLOR.red('Unhandled error: ' + e.message));
  process.exit(2);
});
