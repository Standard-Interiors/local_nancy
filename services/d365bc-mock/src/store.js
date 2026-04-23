// In-memory data store for D365BC mock
// Mirrors what a real BC instance would persist

const { v4: uuid } = require('uuid');

const store = {
  // items keyed by "source:nancyID" (e.g., "Product:123" or "Labor:456")
  items: new Map(),
  // customers keyed by nancyID
  customers: new Map(),
  // sales orders keyed by jobNo (or "Order:jobNo")
  salesOrders: new Map(),
  // salespersons keyed by code
  salespersons: new Map(),
  // commissions — list, newest first
  commissions: [],
  // audit log of every mutating request (for debugging / admin visibility)
  requestLog: [],
  // OAuth tokens issued — just for bookkeeping, all accepted
  tokens: new Map(),
};

function extractBatchReleaseOrder(body) {
  const requests = body?.requests;
  if (!Array.isArray(requests)) return null;

  const releaseOrder = requests
    .map((req) => {
      const url = req?.url || '';
      const match = url.match(/^sales\('([^']+)','([^']+)'\)\/Microsoft\.NAV\.Release$/i);
      return match ? match[2] : null;
    })
    .filter(Boolean);

  return releaseOrder.length > 0 ? releaseOrder : null;
}

function logRequest(method, path, status, body) {
  const batchReleaseOrder = extractBatchReleaseOrder(body);
  store.requestLog.unshift({
    at: new Date().toISOString(),
    method,
    path,
    status,
    bodyPreview: body ? JSON.stringify(body).substring(0, 200) : null,
    batchReleaseOrder,
  });
  if (store.requestLog.length > 500) store.requestLog.pop();
}

// ---------- Items ----------
function putItem(source, nancyID, data) {
  const key = `${source}:${nancyID}`;
  const existing = store.items.get(key);
  const bcId = existing?._bcId || uuid();
  const etag = uuid();
  const item = {
    ...data,
    id: bcId,
    nancyERPSource: source,
    nancyID: Number(nancyID),
    _bcId: bcId,
    _etag: etag,
    _updatedAt: new Date().toISOString(),
  };
  store.items.set(key, item);
  return item;
}

function getItem(source, nancyID) {
  return store.items.get(`${source}:${nancyID}`) || null;
}

function queryItems(filter) {
  // Minimal OData $filter support: "nancyID eq 123"
  const match = filter?.match(/nancyID\s+eq\s+(\d+)/i);
  if (match) {
    const id = Number(match[1]);
    return [...store.items.values()].filter(i => i.nancyID === id);
  }
  return [...store.items.values()];
}

function getItemByBcId(bcId) {
  return [...store.items.values()].find(i => i._bcId === bcId) || null;
}

function updateItemPicture(bcId, contentType, dataBuf) {
  const item = getItemByBcId(bcId);
  if (!item) return null;
  item._picture = {
    contentType,
    size: dataBuf?.length || 0,
    etag: uuid(),
    updatedAt: new Date().toISOString(),
  };
  item._etag = uuid();
  return item;
}

// ---------- Customers ----------
function putCustomer(nancyID, data) {
  const existing = store.customers.get(Number(nancyID));
  const bcId = existing?._bcId || uuid();
  const customer = {
    ...data,
    id: bcId,
    nancyID: Number(nancyID),
    _bcId: bcId,
    _etag: uuid(),
    _updatedAt: new Date().toISOString(),
  };
  store.customers.set(Number(nancyID), customer);
  return customer;
}

function getCustomer(nancyID) {
  return store.customers.get(Number(nancyID)) || null;
}

// ---------- Sales Orders ----------
function putSalesOrder(order) {
  const jobNo = order.jobNo;
  if (!jobNo) throw new Error('jobNo required');
  const existing = store.salesOrders.get(jobNo);
  const bcId = existing?._bcId || uuid();
  const stored = {
    ...order,
    id: bcId,
    _bcId: bcId,
    _status: existing?._status || 'open',
    _etag: uuid(),
    _createdAt: existing?._createdAt || new Date().toISOString(),
    _updatedAt: new Date().toISOString(),
  };
  store.salesOrders.set(jobNo, stored);
  return stored;
}

function ensureSalesOrder(jobNo, seed = {}) {
  const existing = store.salesOrders.get(jobNo);
  if (existing) return existing;

  return putSalesOrder({
    jobNo,
    documentNo: jobNo,
    documentType: 'Order',
    status: 'Open',
    customerNo: seed.customerNo || null,
    company: seed.company || 'SI',
    _mockAutoCreatedOnRelease: true,
    _mockSeedReason: seed.reason || 'release',
  });
}

function releaseSalesOrder(jobNo) {
  const order = ensureSalesOrder(jobNo, { reason: 'release' });
  order._status = 'released';
  order._releasedAt = new Date().toISOString();
  order._etag = uuid();
  return order;
}

function deleteSalesOrder(jobNo) {
  const existed = store.salesOrders.has(jobNo);
  store.salesOrders.delete(jobNo);
  return existed;
}

function getSalesOrder(jobNo) {
  return store.salesOrders.get(jobNo) || null;
}

// ---------- Salespersons ----------
function putSalesperson(code, data) {
  const rec = { ...data, code, _updatedAt: new Date().toISOString() };
  store.salespersons.set(code, rec);
  return rec;
}

function getSalesperson(code) {
  return store.salespersons.get(code) || null;
}

// ---------- Commissions ----------
function addCommission(data) {
  const rec = { id: uuid(), ...data, _createdAt: new Date().toISOString() };
  store.commissions.unshift(rec);
  if (store.commissions.length > 1000) store.commissions.pop();
  return rec;
}

// ---------- Tokens ----------
function issueToken(clientId) {
  const token = `mock-bc-${uuid()}`;
  store.tokens.set(token, {
    clientId: clientId || 'mock-client',
    issuedAt: Date.now(),
    expiresIn: 3600,
  });
  return token;
}

// ---------- Stats / inspection ----------
function stats() {
  const releasedOrders = [...store.salesOrders.values()]
    .filter(o => o._status === 'released')
    .sort((a, b) => (b._releasedAt || '').localeCompare(a._releasedAt || ''));

  return {
    items: store.items.size,
    customers: store.customers.size,
    salesOrders: store.salesOrders.size,
    ordersReleased: releasedOrders.length,
    recentReleasedOrders: releasedOrders.slice(0, 25).map(order => ({
      jobNo: order.jobNo,
      status: order._status,
      releasedAt: order._releasedAt || null,
      autoCreatedOnRelease: Boolean(order._mockAutoCreatedOnRelease),
    })),
    salespersons: store.salespersons.size,
    commissions: store.commissions.length,
    tokens: store.tokens.size,
    recentBatchReleaseOrders: store.requestLog
      .filter((req) => Array.isArray(req.batchReleaseOrder) && req.batchReleaseOrder.length > 0)
      .slice(0, 10)
      .map((req) => ({
        at: req.at,
        path: req.path,
        order: req.batchReleaseOrder,
      })),
    recentRequests: store.requestLog.slice(0, 20),
  };
}

module.exports = {
  store,
  logRequest,
  putItem, getItem, queryItems, getItemByBcId, updateItemPicture,
  putCustomer, getCustomer,
  putSalesOrder, ensureSalesOrder, releaseSalesOrder, deleteSalesOrder, getSalesOrder,
  putSalesperson, getSalesperson,
  addCommission,
  issueToken,
  stats,
};
