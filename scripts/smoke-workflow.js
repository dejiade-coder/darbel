/*
 * Darbel release smoke test.
 *
 * Requires a running backend and a privileged local/test user.
 *
 * PowerShell:
 *   $env:DARBEL_ADMIN_EMAIL="admin@branddarrow.com"
 *   $env:DARBEL_ADMIN_PASSWORD="..."
 *   node scripts/smoke-workflow.js
 */

const API_BASE = process.env.DARBEL_API_BASE || 'http://localhost:4000/api/v1';
const ADMIN_EMAIL = process.env.DARBEL_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.DARBEL_ADMIN_PASSWORD;

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  fail('Set DARBEL_ADMIN_EMAIL and DARBEL_ADMIN_PASSWORD before running the workflow smoke test.');
}

const runId = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);

main().catch((error) => fail(error.message || String(error)));

async function main() {
  step('Health check');
  await request('GET', '/health/live');

  step('Login');
  const login = await request('POST', '/auth/login', {
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });
  if (login.status !== 'authenticated' || !login.tokens?.accessToken) {
    fail(`Expected authenticated login; received status "${login.status}".`);
  }
  const token = login.tokens.accessToken;

  step('Create submitted registration');
  const registration = await request(
    'POST',
    '/registrations',
    {
      registrationDate: today(),
      firstName: 'Smoke',
      lastName: `Handler ${runId}`,
      phone: `080${runId.slice(-8)}`,
      email: `smoke.${runId}@example.test`,
      gender: 'Other',
      tradeCategory: 'Food Handler',
      businessName: 'Smoke Test Kitchen',
      businessAddress: '1 Darbel Smoke Test Avenue',
      passportPhotoReceived: true,
      status: 'SUBMITTED_FOR_REVIEW',
    },
    token,
  );
  assertId(registration, 'registration');

  step('Record payment');
  const payment = await request(
    'POST',
    '/payments',
    {
      handlerRegistrationId: registration.id,
      amount: 2500,
      currency: 'NGN',
      method: 'CASH',
      reference: `SMOKE-${runId}`,
      receiptNumber: `RCPT-${runId}`,
      paidAt: new Date().toISOString(),
      notes: 'Release smoke test payment',
    },
    token,
  );
  assertId(payment, 'payment');

  step('Registrar approval');
  const approvedPayment = await request('PATCH', `/payments/${payment.id}/registrar-approve`, undefined, token);

  step('Collect medical sample');
  const screening = await request(
    'POST',
    '/medical-screenings',
    { handlerRegistrationId: registration.id },
    token,
  );
  assertId(screening, 'medical screening');

  step('Enter medical result');
  await request(
    'PATCH',
    `/medical-screenings/${screening.id}/result`,
    {
      labResultSummary: 'Smoke test result set',
      mantouxResult: 'NEGATIVE',
      mantouxIndurationMm: 0,
      hepatitisBResult: 'NEGATIVE',
      hivResult: 'NEGATIVE',
      widalResult: 'NEGATIVE',
      medicalOfficerNotes: 'Automated release smoke test',
      fitnessStatus: 'FIT',
    },
    token,
  );

  step('Approve medical review and issue certificate');
  await request(
    'PATCH',
    `/medical-screenings/${screening.id}/review`,
    { approved: true, reviewNotes: 'Approved by release smoke test' },
    token,
  );

  step('Confirm certificate exists');
  const certificateSearch = approvedPayment.registrationUid || registration.id;
  const certificates = await request('GET', `/certificates?q=${encodeURIComponent(certificateSearch)}`, undefined, token);
  const items = Array.isArray(certificates.items) ? certificates.items : [];
  if (!items.some((item) => item.handlerRegistrationId === registration.id)) {
    fail('Certificate was not found after FIT medical approval.');
  }

  step('Check report exports');
  await request('GET', '/reports/exports/registrations.csv', undefined, token, { raw: true });
  await request('GET', '/reports/exports/certificates.xls', undefined, token, { raw: true });
  await request('GET', '/reports/exports/summary.pdf', undefined, token, { raw: true });

  console.log('\nDarbel smoke workflow passed.');
}

async function request(method, path, body, token, options = {}) {
  const headers = { accept: options.raw ? '*/*' : 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers['content-type'] = 'application/json';

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    fail(`${method} ${path} failed with ${response.status}: ${text.slice(0, 500)}`);
  }

  if (options.raw || response.status === 204) return null;
  return response.json();
}

function step(label) {
  console.log(`\n> ${label}`);
}

function assertId(value, label) {
  if (!value?.id) fail(`Expected ${label} response to include an id.`);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function fail(message) {
  console.error(`\nSmoke workflow failed: ${message}`);
  process.exit(1);
}
