const express = require('express');
const { connectWithRetry } = require('./services/db');
const { validateConfig } = require('./services/jwt');
const { runSeed } = require('./services/seedUsers');
const { errorHandler } = require('./middleware/errorHandler');

const PORT = parseInt(process.env.AUTH_PROXY_PORT || '3100');

async function start() {
  console.log('=== Geoff Auth Proxy (Local Dev) ===');

  validateConfig();
  console.log('[STARTUP] JWT config OK');

  await connectWithRetry();

  console.log('[STARTUP] Seeding local auth users...');
  await runSeed();

  const app = express();
  app.use(express.json({ limit: '10mb' }));

  // CORS
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  // Request logging
  app.use((req, res, next) => {
    if (req.path !== '/health') console.log(`[REQ] ${req.method} ${req.path}`);
    next();
  });

  // Routes
  app.use(require('./routes/customerSignIn'));
  app.use(require('./routes/signIn'));
  app.use(require('./routes/crossDomain'));
  app.use(require('./routes/health'));

  app.use(errorHandler);

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[STARTUP] Listening on port ${PORT}`);
    console.log(`[STARTUP] Default password: ${process.env.DEFAULT_PASSWORD || 'LocalDev123!'}`);
  });
}

start().catch(err => { console.error('[FATAL]', err.message); process.exit(1); });
