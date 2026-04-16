const express = require('express');
const { putCustomer, getCustomer } = require('../store');
const router = express.Router();

// POST .../customers
router.post(
  /^\/v2\.0\/[^/]+\/[^/]+\/api\/standardInteriors\/nancyERP\/v1\.0\/companies\([^)]+\)\/customers$/,
  (req, res) => {
    const { nancyID } = req.body;
    if (nancyID == null) {
      return res.status(400).json({ error: { code: 'BadRequest', message: 'nancyID required' } });
    }
    const customer = putCustomer(nancyID, req.body);
    res.status(201).json(customer);
  }
);

// PUT .../customers(nancyID)
router.put(
  /^\/v2\.0\/[^/]+\/[^/]+\/api\/standardInteriors\/nancyERP\/v1\.0\/companies\([^)]+\)\/customers\(([^)]+)\)$/,
  (req, res) => {
    const nancyID = (req.params[0] || '').replace(/'/g, '');
    const body = { ...req.body, nancyID: Number(nancyID) };
    const customer = putCustomer(nancyID, body);
    res.status(200).json(customer);
  }
);

// GET .../customers(nancyID)
router.get(
  /^\/v2\.0\/[^/]+\/[^/]+\/api\/standardInteriors\/nancyERP\/v1\.0\/companies\([^)]+\)\/customers\(([^)]+)\)$/,
  (req, res) => {
    const nancyID = (req.params[0] || '').replace(/'/g, '');
    const customer = getCustomer(nancyID);
    if (!customer) return res.status(404).json({ error: { code: 'NotFound', message: 'Customer not found' } });
    res.json(customer);
  }
);

module.exports = router;
