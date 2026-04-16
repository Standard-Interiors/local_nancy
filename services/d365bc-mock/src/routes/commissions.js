const express = require('express');
const { addCommission } = require('../store');
const router = express.Router();

router.post(
  /^\/v2\.0\/[^/]+\/[^/]+\/api\/standardInteriors\/nancyERP\/v1\.0\/companies\([^)]+\)\/commissions$/,
  (req, res) => {
    const rec = addCommission(req.body);
    res.status(201).json(rec);
  }
);

module.exports = router;
