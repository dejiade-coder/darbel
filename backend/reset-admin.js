const a = require("@node-rs/argon2");
const { Client } = require("pg");

const PASSWORD = "Test1234567!";

a.hash(PASSWORD, {
  algorithm: a.Algorithm.Argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
}).then(async (hash) => {
  const c = new Client({ connectionString: process.env.DATABASE_MIGRATOR_URL });
  await c.connect();
  const r = await c.query(
    "UPDATE users SET password_hash=$1, must_change_password=TRUE, password_changed_at=NOW(), failed_login_count=0, is_locked=FALSE, locked_until=NULL WHERE email=$2 RETURNING id, email",
    [hash, "admin@branddarrow.com"]
  );
  console.log("");
  console.log("=== Password reset complete ===");
  console.log("Email:    admin@branddarrow.com");
  console.log("Password: " + PASSWORD);
  console.log("Rows updated:", r.rowCount);
  console.log("===============================");
  await c.end();
}).catch((e) => { console.error("Failed:", e.message); process.exit(1); });
