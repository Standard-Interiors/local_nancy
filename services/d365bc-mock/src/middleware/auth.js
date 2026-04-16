// Mock auth — accept any Bearer token. Log missing tokens as warnings.
function acceptBearer(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    console.warn(`[AUTH] ${req.method} ${req.path} — no Bearer token (accepting anyway for mock)`);
    req.bcToken = null;
  } else {
    req.bcToken = match[1];
  }
  next();
}

module.exports = { acceptBearer };
