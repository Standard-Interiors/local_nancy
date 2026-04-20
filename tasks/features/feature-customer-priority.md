# Feature: Customer Priority

**Branch name:** `feature/customer_priority`
**Repos that change:** `Geoff-ERP` (frontend), `GeoffERP-API` (backend)
**Status:** In Development
**Source:** `/Users/william/NANCY/Plan of Attack-v2.docx`

---

## What

Ensure the most profitable customers receive priority service. The feature has 4 parts:

1. **Admin upload** — New "Customer Priority" button in Admin. Opens a drag-and-drop popup to upload a CSV/Excel with PropertyName and Priority#. Each upload **fully replaces** all previous priorities (wipe and re-assign).

2. **Existing Orders highlighting + sorting** — On the Existing Orders screen:
   - **Orange row** = New customer (PropertyID has never had an order before). Stays orange for first 7 orders, then drops to normal.
   - **Light blue row** = Priority customer (matches the uploaded spreadsheet). Sorted top-to-bottom by priority number.
   - **Normal row** = Everyone else (first come first served).
   - Sort order: Orange (new) at the very top, then blue (priority) by priority#, then normal.

3. **Process Orders respects priority** — When "Process Orders" sends orders to D365 BC, they go in priority order (new customers first, then priority customers, then rest). This ensures priority customers get material assigned first.

4. **Scheduler integration** — Priority# is included in the payload sent to the Scheduler, and jobs are sorted by priority so labor resources get assigned to priority customers first.

5. **Role-gated** — Only certain roles (via the existing Role permission checkbox system) can see and manage Customer Priority.

## Why

Standard Interiors needs their most profitable customers served first. Currently the Existing Orders screen is first-come-first-served with no prioritization. New customers also need special treatment to make a good first impression.

---

## Database Changes

### Option A: Add column to TR_ContactInfo (simpler, matches doc language)

The doc says "update the database to include a Priority# field for each customer":

```sql
-- Add PriorityNumber column to existing customer table
ALTER TABLE TR_ContactInfo ADD PriorityNumber INT NULL;
-- NULL = no priority, 1 = highest priority

-- Add NewCustomerOrderCount to track "new customer" status
-- (number of orders placed — once > 7, no longer "new")
ALTER TABLE TR_ContactInfo ADD IsNewCustomer BIT NULL DEFAULT 0;
ALTER TABLE TR_ContactInfo ADD FirstOrderDate DATETIME NULL;
```

### Option B: Separate table (cleaner for wipe-and-replace)

```sql
CREATE TABLE TR_CustomerPriority (
    CustomerPriorityId INT IDENTITY(1,1) PRIMARY KEY,
    ContactInfoId INT NOT NULL,
    PriorityNumber INT NOT NULL,
    StoreId INT NULL,                              -- priorities may be siloed by store
    UploadBatchId UNIQUEIDENTIFIER NOT NULL,       -- groups entries by upload
    CreatedBy INT NULL,
    CreatedOn DATETIME NOT NULL DEFAULT GETDATE(),
    IsDeleted BIT NULL DEFAULT 0,

    CONSTRAINT FK_CustPriority_Contact
        FOREIGN KEY (ContactInfoId) REFERENCES TR_ContactInfo(ContactInfoId),
    CONSTRAINT FK_CustPriority_Store
        FOREIGN KEY (StoreId) REFERENCES MS_Store(StoreId)
);
```

**We're going with Option B** — separate table. Reasons:
- "Wipe and replace" on re-upload is clean: just mark old batch as deleted, insert new batch
- Priorities can be per-store (the doc says "priorities may be siloed by Store")
- Doesn't pollute the core customer table with feature-specific columns
- Can track upload history via UploadBatchId

### New Customer Tracking

"New customer" = PropertyID that has never had an order before. First 7 orders get orange highlighting.

This is computed at query time — count existing orders for that ContactInfoId in TR_OrderInstallationDetail. No new table needed, just a query:
```sql
SELECT ContactInfoId, COUNT(*) as OrderCount
FROM TR_OrderInstallationDetail
WHERE IsDeleted = 0
GROUP BY ContactInfoId
HAVING COUNT(*) <= 7
```

### RoleAccess.json Entry

The menu system uses a JSON flat file at `GEOFF.API/RoleAccess/RoleAccess.json`. Add a new submenu under "Admin" (menuId 10):

```json
{
  "subMenuId": 10,
  "subMenuName": "Customer Priority",
  "subMenuUrl": "/admin/customer-priority",
  "controllers": [
    {
      "id": "User:CustomerPriority",
      "name": "CustomerPriority",
      "displayName": "CustomerPriority",
      "areaName": "User",
      "actions": [
        {
          "id": "User:api:CustomerPriority:GetList",
          "name": "GetList",
          "displayName": "GetList",
          "controllerId": "User:api:CustomerPriority",
          "status": true
        },
        {
          "id": "User:api:CustomerPriority:Import",
          "name": "Import",
          "displayName": "Import",
          "controllerId": "User:api:CustomerPriority",
          "status": true
        },
        {
          "id": "User:api:CustomerPriority:Remove",
          "name": "Remove",
          "displayName": "Remove",
          "controllerId": "User:api:CustomerPriority",
          "status": true
        }
      ]
    }
  ]
}
```

---

## API Endpoints

All under area `User`, controller `CustomerPriority`.
Base route: `/User/api/CustomerPriority/`

### GET /GetList
Returns all active customer priorities, optionally filtered by store.

**Query params:** `?storeId=1` (optional)

**Response:**
```json
{
  "responseCode": "200",
  "responseStatus": "Success",
  "result": [
    {
      "customerPriorityId": 1,
      "contactInfoId": 42,
      "propertyName": "Tava Waters",
      "managementCompany": "Greystar",
      "priorityNumber": 1,
      "storeId": 1,
      "storeName": "Denver"
    }
  ],
  "totalCount": 15
}
```

### POST /Import
Upload CSV/Excel file. **Wipes all existing priorities** (for that store, or globally), then inserts new ones from the file. Matches customers by PropertyName against `TR_ContactInfo.ShipToPropertyName`.

**Request:** `multipart/form-data`
- `files` — IFormFile (CSV or XLSX)
- `StoreId` — int (which store, or 0 for global)
- `UserId` — string

**CSV format:**
```csv
PropertyName,PriorityNumber
Tava Waters,1
The Lookout at Broadmoor,2
Centennial East Apartments,3
```

**Behavior:**
1. Parse file rows
2. For each PropertyName, look up `TR_ContactInfo` where `ShipToPropertyName` matches
3. Mark all existing `TR_CustomerPriority` rows (for that store) as `IsDeleted = 1`
4. Insert new rows with a fresh `UploadBatchId`
5. Return count of imported, skipped (no match), and errors

### DELETE /Remove
Soft-delete all priorities (clear the list).

**Query params:** `?storeId=1` (optional, or clear all)

---

## Existing Orders Changes

### API: Modify GetAllOrderInstallationDetail

The existing endpoint at `/Ordering/api/Order/GetAllOrderInstallationDetail` needs to:

1. **Join** `TR_CustomerPriority` on `ContactInfoId` to get `PriorityNumber`
2. **Compute** `IsNewCustomer` = true if `ContactInfoId` has fewer than 7 total orders in `TR_OrderInstallationDetail`
3. **Add to response**: `priorityNumber` (int, nullable), `isNewCustomer` (bool), `orderCountForProperty` (int)
4. **Sort order** (when no other sort applied):
   - First: `isNewCustomer = true` (orange) — sub-sorted by most recent order date
   - Then: `priorityNumber IS NOT NULL` (blue) — sorted by priority# ascending (1 first)
   - Then: everything else — existing sort (first come first served)

### Frontend: ExistingOrdersList.jsx

1. Add row highlighting:
   - Orange background (`#FFF3E0` or similar) when `isNewCustomer = true`
   - Light blue background (`#E3F2FD` or similar) when `priorityNumber != null && !isNewCustomer`
2. Add "Priority" column showing the priority number (or "NEW" for new customers)
3. Default sort follows the API's priority-aware ordering

---

## Process Orders Changes

When "Process Orders" button is clicked, the existing flow sends orders to D365 BC. The order in which they're sent needs to respect priority:

1. New customers first (orange)
2. Priority customers next (blue, sorted by priority#)
3. Everyone else

This is handled by sorting the selected orders before sending the batch to BC.

---

## Scheduler Integration

The payload sent to the Scheduler (separate system) needs to include `PriorityNumber` for each job, and jobs should be sorted by priority. This ensures the scheduler UI shows priority customers first and labor resources get assigned to them first.

**Payload addition:**
```json
{
  "jobNo": 1010657,
  "priorityNumber": 1,
  "isNewCustomer": true,
  ...existing fields...
}
```

---

## Frontend Components

### New Files

```
src/
  _utils/constants/CustomerPriority.js
  store/saga/customerPriority/customerPrioritySaga.js
  store/reducers/customerPriority/CustomerPriorityReducer.js
  components/pages/admin/customerPriority/
    CustomerPriorityList.jsx          -- Main admin page (table + import button)
    ImportPriority.jsx                -- Drag-and-drop upload modal
```

### Modified Files

```
src/_routes/adminRoute.js                                    -- New route
src/store/saga/rootSaga.js                                   -- Register saga
src/store/reducers/rootReducer.js                            -- Register reducer
src/components/pages/existingOrders/ExistingOrdersList.jsx   -- Row colors + Priority column + sort
```

### Row Highlighting in ExistingOrdersList

The Existing Orders table currently highlights insufficient material rows in light red. Add:
- Check each row's `isNewCustomer` and `priorityNumber` from the API response
- Apply inline style or className:
  ```jsx
  const getRowStyle = (order) => {
    if (order.isNewCustomer) return { backgroundColor: '#FFF3E0' };  // orange tint
    if (order.priorityNumber) return { backgroundColor: '#E3F2FD' };  // blue tint
    return {};
  };
  ```

---

## Implementation Order

Build in this order so you can test each piece as you go:

### Phase 1: Core (Admin upload + DB)
1. Create `TR_CustomerPriority` table via SQL
2. API: DB model, ViewModel, Business Module, Controller (GetList, Import, Remove)
3. Update `RoleAccess.json` with Customer Priority submenu
4. Rebuild API container
5. Test API with curl
6. Frontend: Constants, Saga, Reducer for CustomerPriority
7. Frontend: CustomerPriorityList + ImportPriority components
8. Frontend: Route in adminRoute.js + register saga/reducer
9. Test: Admin → Customer Priority → Upload CSV → see list

### Phase 2: Existing Orders (highlighting + sort)
10. API: Modify order query to join priority + compute new customer flag
11. Rebuild API container
12. Frontend: Modify ExistingOrdersList.jsx — add row colors + Priority column
13. Test: Existing Orders shows orange/blue rows sorted correctly

### Phase 3: Process Orders + Scheduler
14. API: Modify Process Orders to sort by priority before sending to BC
15. API: Add PriorityNumber to Scheduler payload
16. Test: Process Orders sends in correct order

---

## Test Plan

### Test CSV File

Save at `~/NANCY/local-dev/tasks/features/test-priority.csv`:
```csv
PropertyName,PriorityNumber
Tava Waters,1
The Lookout at Broadmoor,2
Centennial East Apartments,3
Redstone Ranch Apartments,4
The Vue at Spring Creek,5
```

### Checklist

**Phase 1:**
- [ ] `TR_CustomerPriority` table exists in DB
- [ ] Admin → see "Customer Priority" button (when role has permission)
- [ ] Click → see empty priority list
- [ ] Upload test CSV → see 5 rows with priority numbers
- [ ] Upload again with different numbers → old values wiped, new values shown
- [ ] Role without permission → no "Customer Priority" button

**Phase 2:**
- [ ] Existing Orders → priority customers highlighted light blue
- [ ] New customers (< 7 orders) highlighted orange
- [ ] Rows sorted: orange first, then blue by priority#, then normal
- [ ] Priority column shows number or "NEW"

**Phase 3:**
- [ ] Process Orders sends in priority order to BC mock
- [ ] Scheduler payload includes PriorityNumber
