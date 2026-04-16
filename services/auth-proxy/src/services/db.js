const sql = require('mssql');

const config = {
  server: process.env.DB_HOST || 'sqlserver',
  port: parseInt(process.env.DB_PORT || '1433'),
  database: process.env.DB_NAME || 'GeoffERP',
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || 'LocalDev123!',
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
  },
  pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
};

let pool = null;

async function getPool() {
  if (pool) return pool;
  pool = await sql.connect(config);
  return pool;
}

async function connectWithRetry(maxRetries = 30, delayMs = 3000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      pool = await sql.connect(config);
      console.log(`[DB] Connected to ${config.server}:${config.port}/${config.database}`);
      return pool;
    } catch (err) {
      console.log(`[DB] Attempt ${attempt}/${maxRetries}: ${err.message}`);
      if (attempt === maxRetries) {
        throw new Error(`AUTH_PROXY FATAL: Cannot connect to SQL Server after ${maxRetries} attempts.`);
      }
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
}

async function query(sqlText, params = {}) {
  const p = await getPool();
  const request = p.request();
  for (const [key, value] of Object.entries(params)) {
    request.input(key, value);
  }
  return request.query(sqlText);
}

module.exports = { connectWithRetry, getPool, query, sql };
