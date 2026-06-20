/* eslint-disable no-console */
const { spawn, spawnSync } = require('node:child_process');
const { Client } = require('pg');

const adminUrl = process.env.DATABASE_ADMIN_URL;

async function main() {
  if (process.env.NODE_ENV === 'production' && adminUrl) {
    const passwords = readRolePasswords();
    await runMigrations(adminUrl);
    await configureDatabaseRoles(adminUrl, passwords);
    configureRoleUrls(adminUrl, passwords);
  }

  const server = spawn('node', ['dist/main.js'], { stdio: 'inherit' });
  server.on('exit', (code) => process.exit(code ?? 1));
}

function readRolePasswords() {
  const values = {
    app: process.env.DATABASE_APP_PASSWORD,
    auth: process.env.DATABASE_AUTH_PASSWORD,
    migrator: process.env.DATABASE_MIGRATOR_PASSWORD,
  };
  const missing = Object.entries(values)
    .filter(([, value]) => !value || value.length < 24)
    .map(([name]) => `DATABASE_${name.toUpperCase()}_PASSWORD`);
  if (missing.length) {
    throw new Error(`Production database bootstrap requires: ${missing.join(', ')}`);
  }
  return values;
}

async function runMigrations(databaseUrl) {
  console.log('Applying database migrations with the Railway database owner...');
  const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const result = spawnSync(command, ['prisma', 'migrate', 'deploy'], {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });
  if (result.status !== 0) throw new Error('Prisma migration deployment failed');
}

async function configureDatabaseRoles(databaseUrl, passwords) {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query(`ALTER ROLE darbel_app WITH LOGIN PASSWORD '${sqlLiteral(passwords.app)}' NOBYPASSRLS`);
    await client.query(`ALTER ROLE darbel_auth WITH LOGIN PASSWORD '${sqlLiteral(passwords.auth)}' BYPASSRLS`);
    await client.query(`ALTER ROLE darbel_migrator WITH LOGIN PASSWORD '${sqlLiteral(passwords.migrator)}' BYPASSRLS`);
    await client.query('GRANT CREATE ON SCHEMA public TO darbel_migrator');
  } finally {
    await client.end();
  }
}

function configureRoleUrls(databaseUrl, passwords) {
  process.env.DATABASE_URL ||= buildRoleUrl(databaseUrl, 'darbel_app', passwords.app, 10);
  process.env.DATABASE_AUTH_URL ||= buildRoleUrl(databaseUrl, 'darbel_auth', passwords.auth, 5);
  process.env.DATABASE_MIGRATOR_URL ||= buildRoleUrl(databaseUrl, 'darbel_migrator', passwords.migrator, 5);
}

function buildRoleUrl(databaseUrl, role, password, connectionLimit) {
  const url = new URL(databaseUrl);
  url.username = role;
  url.password = password;
  url.searchParams.set('schema', 'public');
  url.searchParams.set('connection_limit', String(connectionLimit));
  return url.toString();
}

function sqlLiteral(value) {
  return value.replaceAll("'", "''");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exit(1);
});
