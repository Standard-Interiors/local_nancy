const express = require('express');
const bcrypt = require('bcryptjs');
const { findUserByEmail } = require('../services/userLookup');
const { generateToken } = require('../services/jwt');
const { decrypt } = require('../services/crypto');
const { authError } = require('../middleware/errorHandler');
const router = express.Router();

// POST /Authentication/api/Login/SignIn  AND  POST /api/Auth/SignIn
// Used by: Geoff-ERP React app (AES-encrypted credentials)
async function handleSignIn(req, res, next) {
  try {
    let emailId, password;
    // Try AES-decrypt first (production flow). If that fails, assume plaintext (Geoff-ERP React app).
    try {
      emailId = decrypt(req.body.EmailId);
      password = decrypt(req.body.Password);
    } catch (e) {
      emailId = req.body.EmailId;
      password = req.body.Password;
      if (!emailId || !password) {
        throw authError(400, `Missing EmailId or Password. Error: ${e.message}`);
      }
      console.log(`[AUTH] SignIn using plaintext payload`);
    }

    console.log(`[AUTH] SignIn: ${emailId}`);
    const user = await findUserByEmail(emailId);

    if (!user) throw authError(401, `No user with email '${emailId}'.`);
    if (user.IsDeleted) throw authError(401, `User '${emailId}' is deleted.`);
    if (!user.password_hash) throw authError(401, `User '${emailId}' has no local password. Restart auth-proxy.`);

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) throw authError(401, `Invalid password for '${emailId}'. Default: LocalDev123!`);

    const token = generateToken(user.UserName || user.Email, 1, user.UserId);
    console.log(`[AUTH] SignIn OK: ${emailId}`);

    res.json({
      message: 'Success',
      result: [{
        token,
        userId: user.UserId,
        roleid: user.RoleId || 1,
        isAdminAccess: user.IsAdminAccess || false,
        hashKey: user.hash_key || '',
        userName: user.UserName || '',
        emailId: user.Email,
        uniqueChannelName: `local-channel-${user.UserId}`,
      }],
      error: null,
    });
  } catch (err) { next(err); }
}

router.post('/Authentication/api/Login/SignIn', handleSignIn);
router.post('/authentication/api/login/SignIn', handleSignIn);
router.post('/authentication/api/login/signin', handleSignIn);
router.post('/api/Auth/SignIn', handleSignIn);
router.post('/api/Auth/signin', handleSignIn);

module.exports = router;
