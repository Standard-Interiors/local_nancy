function errorHandler(err, req, res, next) {
  console.error(`[ERROR] ${req.method} ${req.path}: ${err.message}`);
  res.status(err.statusCode || 500).json({
    message: 'Failed',
    result: null,
    error: err.message,
  });
}

function authError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

module.exports = { errorHandler, authError };
