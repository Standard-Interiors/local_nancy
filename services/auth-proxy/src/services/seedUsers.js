const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { query } = require('./db');

const DEFAULT_PASSWORD = process.env.DEFAULT_PASSWORD || 'LocalDev123!';

async function ensureTable() {
  const check = await query(`SELECT OBJECT_ID('MS_User', 'U') AS tbl_id`);
  if (check.recordset[0].tbl_id === null) {
    console.log('[SEED] MS_User table not found — DB snapshot not yet restored. Skipping.');
    return false;
  }

  await query(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'local_auth_users')
    BEGIN
      CREATE TABLE local_auth_users (
        UserId        INT PRIMARY KEY,
        password_hash NVARCHAR(200) NOT NULL,
        hash_key      NVARCHAR(200) NULL,
        created_at    DATETIME2 DEFAULT GETDATE(),
        CONSTRAINT FK_local_auth_MS_User FOREIGN KEY (UserId) REFERENCES MS_User(UserId)
      );
    END
  `);
  return true;
}

function generateHashKey(userId, email) {
  return crypto.createHash('sha256')
    .update(`local-hash-${userId}-${email}`)
    .digest('hex').substring(0, 64);
}

async function seedMissingUsers() {
  const result = await query(`
    SELECT u.UserId, u.Email
    FROM MS_User u
    LEFT JOIN local_auth_users la ON u.UserId = la.UserId
    WHERE la.UserId IS NULL AND u.IsDeleted = 0 AND u.Email IS NOT NULL AND u.Email != ''
  `);

  if (result.recordset.length === 0) {
    console.log('[SEED] All users already seeded.');
    return 0;
  }

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  let seeded = 0;
  for (const user of result.recordset) {
    try {
      await query(
        `INSERT INTO local_auth_users (UserId, password_hash, hash_key) VALUES (@userId, @passwordHash, @hashKey)`,
        { userId: user.UserId, passwordHash, hashKey: generateHashKey(user.UserId, user.Email) }
      );
      seeded++;
    } catch (err) {
      // skip duplicates
    }
  }
  console.log(`[SEED] Seeded ${seeded} users with password "${DEFAULT_PASSWORD}"`);
  return seeded;
}

async function runSeed() {
  try {
    const ready = await ensureTable();
    if (ready) await seedMissingUsers();
  } catch (err) {
    console.log(`[SEED] WARNING: ${err.message}`);
    console.log('[SEED] Auth proxy will start anyway — restore DB and restart to seed.');
  }
}

module.exports = { runSeed };
