const express = require('express');
const { putSalesOrder, releaseSalesOrder, deleteSalesOrder, getSalesOrder } = require('../store');
const router = express.Router();

// POST .../sales
router.post(
  /^\/v2\.0\/[^/]+\/[^/]+\/api\/standardInteriors\/nancyERP\/v1\.0\/companies\([^)]+\)\/sales$/,
  (req, res) => {
    const body = req.body;
    if (!body.jobNo) {
      return res.status(400).json({ error: { code: 'BadRequest', message: 'jobNo required' } });
    }
    const order = putSalesOrder(body);
    res.status(201).json(order);
  }
);

// GET .../sales('Order','1001')
router.get(
  /^\/v2\.0\/[^/]+\/[^/]+\/api\/standardInteriors\/nancyERP\/v1\.0\/companies\([^)]+\)\/sales\(([^)]+)\)$/,
  (req, res) => {
    const expr = req.params[0] || '';
    const [typeRaw, jobNoRaw] = expr.split(',');
    const jobNo = (jobNoRaw || '').replace(/'/g, '').trim();
    const order = getSalesOrder(jobNo);
    if (!order) return res.status(404).json({ error: { code: 'NotFound', message: 'Sales order not found' } });
    res.json(order);
  }
);

// POST .../sales('Order','1001')/Microsoft.NAV.Release or /Microsoft.NAV.Delete
router.post(
  /^\/v2\.0\/[^/]+\/[^/]+\/api\/standardInteriors\/nancyERP\/v1\.0\/companies\([^)]+\)\/sales\(([^)]+)\)\/(.+)$/,
  (req, res) => {
    const expr = req.params[0] || '';
    const action = req.params[1] || '';
    const [typeRaw, jobNoRaw] = expr.split(',');
    const jobNo = (jobNoRaw || '').replace(/'/g, '').trim();

    if (action === 'Microsoft.NAV.Release') {
      const order = releaseSalesOrder(jobNo);
      if (!order) return res.status(404).json({ error: { code: 'NotFound', message: `Order ${jobNo} not found` } });
      return res.json({ value: 'released successfully', jobNo });
    }
    if (action === 'Microsoft.NAV.Delete') {
      const existed = deleteSalesOrder(jobNo);
      if (!existed) return res.status(404).json({ error: { code: 'NotFound', message: `Order ${jobNo} not found` } });
      return res.json({ value: 'deleted successfully', jobNo });
    }
    res.status(400).json({ error: { code: 'BadAction', message: `Unknown action ${action}` } });
  }
);

module.exports = router;
