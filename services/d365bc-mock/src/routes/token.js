const express = require('express');
const { issueToken } = require('../store');
const router = express.Router();

// Microsoft OAuth2 token endpoint
// Real: https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token
// Mock: http://d365bc-mock:3200/:tenant/oauth2/v2.0/token (we accept both path shapes)
function handleToken(req, res) {
  const clientId = req.body.client_id || req.query.client_id;
  const token = issueToken(clientId);
  res.json({
    token_type: 'Bearer',
    expires_in: 3600,
    ext_expires_in: 3600,
    access_token: token,
  });
}

router.post('/:tenant/oauth2/v2.0/token', handleToken);
router.post('/oauth2/v2.0/:tenant/token', handleToken);
router.post('/common/oauth2/v2.0/token', handleToken);

module.exports = router;
