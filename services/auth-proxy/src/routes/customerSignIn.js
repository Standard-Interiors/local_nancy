const express = require('express');
const bcrypt = require('bcryptjs');
const { findUserByEmail } = require('../services/userLookup');
const { generateToken } = require('../services/jwt');
const { authError } = require('../middleware/errorHandler');
const router = express.Router();

// POST /authentication/api/login/CustomerSignIn
// Used by: ordering-system (plaintext credentials)
router.post('/authentication/api/login/CustomerSignIn', async (req, res, next) => {
  try {
    const { EmailId, Password } = req.body;
    if (!EmailId || !Password) throw authError(400, 'EmailId and Password are required.');

    console.log(`[AUTH] CustomerSignIn: ${EmailId}`);
    const user = await findUserByEmail(EmailId);

    if (!user) throw authError(401, `No user with email '${EmailId}'. Was the DB restored?`);
    if (user.IsDeleted) throw authError(401, `User '${EmailId}' is deleted.`);
    if (!user.password_hash) throw authError(401, `User '${EmailId}' has no local password. Restart auth-proxy to seed.`);

    const valid = await bcrypt.compare(Password, user.password_hash);
    if (!valid) throw authError(401, `Invalid password for '${EmailId}'. Default: LocalDev123!`);

    const token = generateToken(user.UserName || user.Email, 1, user.UserId);
    console.log(`[AUTH] CustomerSignIn OK: ${EmailId} (userId=${user.UserId})`);

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
});

module.exports = router;
