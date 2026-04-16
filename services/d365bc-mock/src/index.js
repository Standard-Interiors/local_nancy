const express = require('express');
const { stats } = require('./store');
const { acceptBearer } = require('./middleware/auth');
const { requestLogger } = require('./middleware/logger');

const PORT = parseInt(process.env.PORT || '3200');

const app = express();

// JSON body for normal requests
app.use(express.json({ limit: '50mb' }));
// URL-encoded for OAuth token requests
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
// Raw binary body for picture uploads (only when content-type is image/*)
app.use((req, res, next) => {
  const ct = req.headers['content-type'] || '';
  if (ct.startsWith('image/') || ct === 'application/octet-stream') {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => { req.body = Buffer.concat(chunks); next(); });
    req.on('error', next);
    return;
  }
  next();
});

app.use(requestLogger);

// Health check (no auth required)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'd365bc-mock', stats: stats() });
});

// Admin stats (for developers — visible state of the mock)
app.get('/_admin/stats', (req, res) => {
  res.json(stats());
});

// Token endpoint (no auth required — this IS the auth)
app.use(require('./routes/token'));

// All other BC endpoints — accept any Bearer token
app.use(acceptBearer);
app.use(require('./routes/items'));
app.use(require('./routes/customers'));
app.use(require('./routes/sales'));
app.use(require('./routes/salespersons'));
app.use(require('./routes/commissions'));
app.use(require('./routes/pricelist'));
app.use(require('./routes/batch'));
app.use(require('./routes/bcCallback'));

// Fallback — log and 404
app.use((req, res) => {
  console.log(`[404] ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    error: {
      code: 'ResourceNotFound',
      message: `Mock does not handle: ${req.method} ${req.originalUrl}`,
    },
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('[ERROR]', err);
  res.status(500).json({ error: { code: 'InternalError', message: err.message } });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('=== D365BC Mock Service ===');
  console.log(`Listening on port ${PORT}`);
  console.log(`Health: http://localhost:${PORT}/health`);
  console.log(`Stats:  http://localhost:${PORT}/_admin/stats`);
});
