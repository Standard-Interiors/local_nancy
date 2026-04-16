// Simulates callbacks that BC would make back to Geoff (reverse direction).
// Exposed as endpoints the mock offers, so developers can manually trigger
// a BC -> Geoff item sync event to test the inbound path.
const express = require('express');
const router = express.Router();

// Manual trigger: POST to our mock which forwards to Geoff API's /api/bcsync/callback
router.post('/_mock/trigger-item-sync', async (req, res) => {
  const geoffApiUrl = process.env.GEOFF_API_URL || 'http://api:5000';
  const { operation = 'Update', item } = req.body;

  try {
    const bcauthResp = await fetch(`${geoffApiUrl}/api/bcauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': process.env.BC365_API_ORIGIN || 'https://localhost',
        'x-api-key': process.env.BC365_API_KEY || 'local',
      },
      body: JSON.stringify({ clientId: process.env.BC365_CLIENT_ID || 'local' }),
    });
    const tokenData = await bcauthResp.json();
    const token = tokenData.token;

    if (!token) {
      return res.status(500).json({ error: 'Failed to get token from Geoff API', response: tokenData });
    }

    const syncResp = await fetch(`${geoffApiUrl}/api/bcsync/callback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ operation, item }),
    });
    const syncData = await syncResp.json().catch(() => ({ raw: 'non-json response' }));
    res.json({ triggered: true, status: syncResp.status, response: syncData });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
