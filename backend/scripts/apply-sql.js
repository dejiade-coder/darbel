/**
 * Applies the four database/*.sql files in order, in a single connection,
 * using DATABASE_MIGRATOR_URL.
 *
 * Usage:
 *   node scripts/apply-sql.js
 */
const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');

const FILES = [
  '01-schema.sql',
  '02-rls-policies.sql',
  '03-audit-triggers.sql',
  '04-seed.sql',
];

async function main() {
  const url = process.env.DATABASE_MIGRATOR_URL || process.env.DATABASE_URL;
  if (!url) {
    console.error('Set DATABASE_MIGRATOR_URL (preferred) or DATABASE_URL');
    process.exit(1);
  }
  const dbDir = path.resolve(__dirname, '..', '..', 'database');
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    for (const f of FILES) {
      const full = path.join(dbDir, f);
      console.log(`Applying ${f}...`);
      const sql = fs.readFileSync(full, 'utf8');
      await client.query(sql);
      console.log(`  done.`);
    }
    console.log('All migrations applied.');
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error('Migration failed:', e.message);
  process.exit(1);
});
