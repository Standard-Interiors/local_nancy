const express = require('express');
const { releaseSalesOrder, deleteSalesOrder, putSalesOrder } = require('../store');
const router = express.Router();

// OData $batch endpoint
const BATCH_REGEX = /^\/v2\.0\/[^/]+\/[^/]+\/api\/standardInteriors\/nancyERP\/v1\.0\/\$batch$/;

function buildSalesActionSuccess(jobNo, action) {
  if (action === 'Microsoft.NAV.Release') {
    return {
      value: JSON.stringify({
        documentType: 'Order',
        documentNo: jobNo,
        success: true,
      }),
    };
  }

  if (action === 'Microsoft.NAV.Delete') {
    return {
      value: `deleted successfully ${jobNo}`,
    };
  }

  return { value: 'ok' };
}

function processRequest(subReq) {
  const { method, url, body } = subReq;

  // Sales order actions: sales('Order','1001')/Microsoft.NAV.Release
  const salesMatch = url.match(/^sales\('([^']+)','([^']+)'\)\/(.+)$/i);
  if (salesMatch) {
    const [, type, jobNo, action] = salesMatch;
    if (action === 'Microsoft.NAV.Release') {
      const order = releaseSalesOrder(jobNo);
      if (!order) return { status: 404, body: { error: { code: 'NotFound', message: `Order ${jobNo} not found` } } };
      return { status: 200, body: buildSalesActionSuccess(jobNo, action) };
    }
    if (action === 'Microsoft.NAV.Delete') {
      const existed = deleteSalesOrder(jobNo);
      if (!existed) return { status: 404, body: { error: { code: 'NotFound', message: `Order ${jobNo} not found` } } };
      return { status: 200, body: buildSalesActionSuccess(jobNo, action) };
    }
    return { status: 400, body: { error: { code: 'BadAction', message: `Unknown sales action: ${action}` } } };
  }

  // Plain sales POST (create)
  if (method === 'POST' && url === 'sales') {
    if (!body?.jobNo) return { status: 400, body: { error: { code: 'BadRequest', message: 'jobNo required' } } };
    const order = putSalesOrder(body);
    return { status: 201, body: order };
  }

  return {
    status: 404,
    body: { error: { code: 'NotFound', message: `Batch handler missing for: ${method} ${url}` } },
  };
}

router.post(BATCH_REGEX, (req, res) => {
  const requests = req.body?.requests;
  if (!Array.isArray(requests)) {
    return res.status(400).json({ error: { code: 'BadRequest', message: 'requests array required' } });
  }

  const responses = requests.map((sub, idx) => {
    try {
      const result = processRequest(sub);
      return {
        id: sub.id ?? idx,
        status: result.status,
        headers: { 'content-type': 'application/json' },
        body: result.body,
      };
    } catch (err) {
      return {
        id: sub.id ?? idx,
        status: 500,
        body: { error: { code: 'InternalError', message: err.message } },
      };
    }
  });

  res.json({ responses });
});

module.exports = router;
