const { logRequest } = require('../store');

function requestLogger(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    console.log(`[REQ] ${req.method} ${req.path} → ${res.statusCode} (${ms}ms)`);
    if (req.method !== 'GET' && req.path !== '/health') {
      logRequest(req.method, req.path, res.statusCode, req.body);
    }
  });
  next();
}

module.exports = { requestLogger };
