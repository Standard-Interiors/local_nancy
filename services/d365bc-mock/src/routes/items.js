const express = require('express');
const { putItem, getItem, queryItems, getItemByBcId, updateItemPicture } = require('../store');
const router = express.Router();

// --- Create item (POST .../items)
router.post(
  /^\/v2\.0\/[^/]+\/[^/]+\/api\/standardInteriors\/nancyERP\/v1\.0\/companies\([^)]+\)\/items$/,
  (req, res) => {
    const body = req.body;
    const source = body.nancyERPSource;
    const nancyID = body.nancyID;
    if (!source || nancyID == null) {
      return res.status(400).json({
        error: { code: 'BadRequest', message: 'nancyERPSource and nancyID are required' },
      });
    }
    const item = putItem(source, nancyID, body);
    res.status(201).json(item);
  }
);

// --- Update item (PUT .../items('Source',nancyID))
router.put(
  /^\/v2\.0\/[^/]+\/[^/]+\/api\/standardInteriors\/nancyERP\/v1\.0\/companies\([^)]+\)\/items\(([^)]+)\)$/,
  (req, res) => {
    const [sourceRaw, nancyID] = (req.params[0] || '').split(',');
    const source = (sourceRaw || '').replace(/'/g, '').trim();
    const body = { ...req.body, nancyERPSource: source, nancyID: Number(nancyID) };
    const item = putItem(source, nancyID, body);
    res.status(200).json(item);
  }
);

// --- itemsQuery with $filter
router.get(
  /^\/v2\.0\/[^/]+\/[^/]+\/api\/standardInteriors\/nancyERP\/v1\.0\/companies\([^)]+\)\/itemsQuery$/,
  (req, res) => {
    const filter = req.query.$filter || '';
    const results = queryItems(filter);
    res.json({
      '@odata.context': '#itemsQuery',
      value: results,
    });
  }
);

// --- Single-item get via alternate key syntax
router.get(
  /^\/v2\.0\/[^/]+\/[^/]+\/api\/standardInteriors\/nancyERP\/v1\.0\/items\(([^)]+)\)$/,
  (req, res) => {
    const expr = req.params[0] || '';
    const sourceMatch = expr.match(/nancyERPSource='([^']+)'/);
    const idMatch = expr.match(/nancyID=(\d+)/);
    if (!sourceMatch || !idMatch) {
      return res.status(400).json({ error: { code: 'BadRequest', message: 'Invalid key expression' } });
    }
    const item = getItem(sourceMatch[1], idMatch[1]);
    if (!item) return res.status(404).json({ error: { code: 'NotFound', message: 'Item not found' } });
    res.json(item);
  }
);

// --- Picture container
router.get(
  /^\/v2\.0\/[^/]+\/[^/]+\/api\/v2\.0\/companies\([^)]+\)\/items\(([^)]+)\)\/picture$/,
  (req, res) => {
    const bcId = (req.params[0] || '').replace(/'/g, '');
    const item = getItemByBcId(bcId);
    if (!item) return res.status(404).json({ error: { code: 'NotFound', message: 'Item not found' } });
    res.set('ETag', `"${item._etag}"`);
    res.json({
      '@odata.etag': `W/"${item._etag}"`,
      id: item._bcId,
      width: item._picture?.width || 0,
      height: item._picture?.height || 0,
      contentType: item._picture?.contentType || null,
    });
  }
);

// --- Upload picture binary
const pictureUploadRegex =
  /^\/v2\.0\/[^/]+\/[^/]+\/api\/v2\.0\/companies\([^)]+\)\/items\(([^)]+)\)\/picture\/content\/\$value$/;

function handlePictureUpload(req, res) {
  const contentType = req.headers['content-type'] || 'application/octet-stream';
  const bcId = (req.params[0] || '').replace(/'/g, '');
  const item = updateItemPicture(bcId, contentType, req.body);
  if (!item) return res.status(404).json({ error: { code: 'NotFound', message: 'Item not found' } });
  res.set('ETag', `"${item._etag}"`);
  res.status(204).send();
}
router.patch(pictureUploadRegex, handlePictureUpload);
router.put(pictureUploadRegex, handlePictureUpload);

module.exports = router;
