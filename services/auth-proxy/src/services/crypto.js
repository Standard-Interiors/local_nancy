const crypto = require('crypto');

const AES_KEY = process.env.AES_KEY || '1234567890123456';
const AES_IV = process.env.AES_IV || '1234567890123456';

function decrypt(base64Ciphertext) {
  const key = Buffer.from(AES_KEY, 'utf8');
  const iv = Buffer.from(AES_IV, 'utf8');
  const ciphertext = Buffer.from(base64Ciphertext, 'base64');
  const decipher = crypto.createDecipheriv('aes-128-cbc', key, iv);
  decipher.setAutoPadding(true);
  let decrypted = decipher.update(ciphertext, undefined, 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

function encrypt(plaintext) {
  const key = Buffer.from(AES_KEY, 'utf8');
  const iv = Buffer.from(AES_IV, 'utf8');
  const cipher = crypto.createCipheriv('aes-128-cbc', key, iv);
  cipher.setAutoPadding(true);
  let encrypted = cipher.update(plaintext, 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return encrypted.toString('base64');
}

module.exports = { encrypt, decrypt };
