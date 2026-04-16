const express = require('express');
const { findUserByHashKey, findUserById } = require('../services/userLookup');
const { generateToken } = require('../services/jwt');
const { authError } = require('../middleware/errorHandler');
const router = express.Router();

// POST /authentication/api/login/CrossDomainAuthentication?LoginLink=<hash>
// Used by: seaming-frontend and ordering-system
router.post('/authentication/api/login/CrossDomainAuthentication', async (req, res, next) => {
  try {
    const loginLink = req.query.LoginLink || req.query.loginlink || '';
    if (!loginLink) throw authError(400, 'LoginLink query parameter is required.');

    console.log(`[AUTH] CrossDomain: hash=${loginLink.substring(0, 16)}...`);

    let user = await findUserByHashKey(loginLink);
    if (!user && /^\d+$/.test(loginLink)) user = await findUserById(parseInt(loginLink));
    if (!user) throw authError(401, `No user found for LoginLink '${loginLink.substring(0, 20)}...'.`);
    if (user.IsDeleted) throw authError(401, `User '${user.Email}' is deleted.`);

    const token = generateToken(user.UserName || user.Email, 1, user.UserId);
    console.log(`[AUTH] CrossDomain OK: ${user.Email} (userId=${user.UserId})`);

    res.json({ message: 'Success', result: [{ token, userId: user.UserId }], error: null });
  } catch (err) { next(err); }
});

module.exports = router;
