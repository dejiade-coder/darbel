const a = require('@node-rs/argon2');
const { Client } = require('pg');

const PASSWORD = 'Darbel2026Admin!';

a.hash(PASSWORD, {
  algorithm: a.Algorithm.Argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
}).then(async (hash) => {
  const c = new Client({ connectionString: process.env.DATABASE_MIGRATOR_URL });
  await c.connect();
  const r = await c.query(
    "UPDATE users u SET password_hash = $1, must_change_password = TRUE, password_changed_at = NOW() FROM tenants t WHERE u.tenant_id = t.id AND t.code = 'BRANDDARROW' AND u.email = 'admin@branddarrow.com' RETURNING u.id",
    [hash]
  );
  console.log('Updated:', r.rowCount, 'row(s).');
  if (r.rows[0]) console.log('User id:', r.rows[0].id);
  await c.end();
}).catch((e) => {
  console.error('Failed:', e.message);
  process.exit(1);
});
