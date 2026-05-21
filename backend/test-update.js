const { Client } = require('pg');
const c = new Client({ connectionString: process.env.DATABASE_MIGRATOR_URL });

c.connect()
  .then(() => c.query("UPDATE users SET phone = 'test' WHERE email = 'admin@branddarrow.com' RETURNING id"))
  .then((r) => {
    console.log('rows:', r.rowCount);
    return c.end();
  })
  .catch((e) => console.error('Failed:', e.message));
