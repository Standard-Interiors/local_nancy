const express = require('express');
const { putSalesperson, getSalesperson } = require('../store');
const router = express.Router();

router.post(
  /^\/v2\.0\/[^/]+\/[^/]+\/api\/standardInteriors\/nancyERP\/v1\.0\/companies\([^)]+\)\/salespersons$/,
  (req, res) => {
    const { code, name } = req.body;
    if (!code) return res.status(400).json({ error: { code: 'BadRequest', message: 'code required' } });
    const sp = putSalesperson(code, { code, name });
    res.status(201).json(sp);
  }
);

router.get(
  /^\/v2\.0\/[^/]+\/[^/]+\/api\/standardInteriors\/nancyERP\/v1\.0\/companies\([^)]+\)\/salespersons\(([^)]+)\)$/,
  (req, res) => {
    const code = (req.params[0] || '').replace(/'/g, '');
    const sp = getSalesperson(code);
    if (!sp) return res.status(404).json({ error: { code: 'NotFound', message: 'Salesperson not found' } });
    res.json(sp);
  }
);

module.exports = router;
