const jsonwebtoken = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { encrypt } = require('./crypto');

const JWT_KEY = process.env.JWT_KEY || 'GeoffLocalDevKey_MustBe32CharsOrMore!';
const JWT_ISSUER = process.env.JWT_ISSUER || 'https://dev.api.s10drd.com';
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'geoff-local';

function validateConfig() {
  if (!JWT_KEY || JWT_KEY.length < 32) {
    throw new Error('AUTH_PROXY FATAL: JWT_KEY must be >= 32 characters.');
  }
}

function generateToken(userName, storeId, userId) {
  return jsonwebtoken.sign(
    {
      jti: uuidv4(),
      valid: '1',
      store: encrypt(String(storeId)),
      uName: encrypt(String(userName)),
      uId: encrypt(String(userId)),
    },
    JWT_KEY,
    { algorithm: 'HS256', issuer: JWT_ISSUER, audience: JWT_AUDIENCE, expiresIn: 3600 }
  );
}

module.exports = { generateToken, validateConfig };
