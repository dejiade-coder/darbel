/**
 * Sets a real Argon2id password hash for the bootstrap Super Admin user
 * after running database/04-seed.sql.
 *
 * Usage:
 *   ts-node scripts/set-bootstrap-password.ts
 *
 * Reads the new password from stdin (so it never lands in shell history).
 * Connects via DATABASE_MIGRATOR_URL so it can update the seeded user
 * without going through RLS / the audit guard.
 */
import * as readline from 'node:readline';
import { Writable } from 'node:stream';
import { Algorithm, hash as argonHash } from '@node-rs/argon2';
import { Client } from 'pg';

const TARGET_EMAIL = process.env.BOOTSTRAP_EMAIL ?? 'admin@branddarrow.com';
const TENANT_CODE = 'BRANDDARROW';

async function readPasswordTwice(): Promise<string> {
  const muted = new Writable({
    write(chunk, _enc, cb) {
      // Hide typed characters
      cb();
    },
  });
  const rl = readline.createInterface({ input: process.stdin, output: muted, terminal: true });
  const ask = (prompt: string): Promise<string> =>
    new Promise((resolve) => {
      process.stdout.write(prompt);
      rl.question('', (a) => {
        process.stdout.write('\n');
        resolve(a);
      });
    });
  const p1 = await ask('New password: ');
  const p2 = await ask('Confirm new password: ');
  rl.close();
  if (p1 !== p2) throw new Error('Passwords do not match');
  if (p1.length < 12) throw new Error('Password must be at least 12 characters');
  return p1;
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_MIGRATOR_URL ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error('Set DATABASE_MIGRATOR_URL (preferred) or DATABASE_URL');
  }
  const password = await readPasswordTwice();
  const hash = await argonHash(password, {
    algorithm: Algorithm.Argon2id,
    memoryCost: Number(process.env.ARGON2_MEMORY_KB ?? 65536),
    timeCost: Number(process.env.ARGON2_ITERATIONS ?? 3),
    parallelism: Number(process.env.ARGON2_PARALLELISM ?? 4),
  });

  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const res = await client.query(
      `
      UPDATE users u
      SET password_hash = $1,
          must_change_password = TRUE,
          password_changed_at = NOW()
      FROM tenants t
      WHERE u.tenant_id = t.id
        AND t.code = $2
        AND u.email = $3
      RETURNING u.id
      `,
      [hash, TENANT_CODE, TARGET_EMAIL],
    );
    if (res.rowCount === 0) {
      throw new Error(`No user found for ${TARGET_EMAIL} in tenant ${TENANT_CODE}. Run seed first.`);
    }
    // eslint-disable-next-line no-console
    console.log(`Bootstrap password set for ${TARGET_EMAIL} (id=${res.rows[0].id}).`);
    // eslint-disable-next-line no-console
    console.log('User will be required to change password on first login.');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Failed:', err.message);
  process.exit(1);
});
