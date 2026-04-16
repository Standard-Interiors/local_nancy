const express = require('express');
const router = express.Router();

// POST .../itemPrices('BCItemNo')/Microsoft.NAV.addPricePurchase
router.post(
  /^\/v2\.0\/[^/]+\/[^/]+\/api\/abcGroup\/nancy\/v1\.0\/companies\([^)]+\)\/itemPrices\(([^)]+)\)\/(.+)$/,
  (req, res) => {
    const bcItemNo = (req.params[0] || '').replace(/'/g, '');
    const action = req.params[1] || '';
    if (action !== 'Microsoft.NAV.addPricePurchase') {
      return res.status(400).json({ error: { code: 'BadAction', message: `Unknown action ${action}` } });
    }
    res.status(200).json({
      value: `Purchase price added for ${bcItemNo}`,
      bcItemNo,
      payload: req.body,
    });
  }
);

module.exports = router;
