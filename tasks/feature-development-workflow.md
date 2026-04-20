# NANCY Feature Development Workflow

How to develop, test, and ship features using Local NANCY.

---

## Overview

Local NANCY is a fully dockerized copy of the NANCY ERP system running on your laptop. It replaces all cloud services (AWS, Azure, Cognito, D365 BC) with local Docker containers. You develop features here, test them end-to-end, then push branches for QA.

**The loop:**
```
Create feature branch → Develop locally → Test in browser → Push for QA → PR to merge
```

---

## Repos That Exist

There are 7 application repos (owned by `laitkor-org`) and 1 infrastructure repo (owned by `Standard-Interiors`):

| Repo | What It Is | Base Branch |
|------|-----------|-------------|
| `Geoff-ERP` | React 17 frontend (admin dashboard, ordering, measuring) | `develop` |
| `GeoffERP-API` | .NET Core 3.1 REST API (all business logic) | `staging` |
| `ordering-system` | Customer-facing ordering portal (static HTML/JS) | `master` |
| `seaming-frontend` | SVG seam editor (static HTML/JS) | `master` |
| `floorplan-backend` | Python Flask floorplan calculation service | `main` |
| `geoff-automation-test` | Automation test suite | `main` |
| `GeoffQA` | QA test suite | `main` |
| `local-dev` (Standard-Interiors/local_nancy) | Docker infrastructure, configs, docs | `master` |

Most features only touch **Geoff-ERP** (frontend) and **GeoffERP-API** (backend). The other repos rarely change.

---

## Step 1: Create Feature Branches

### Which repos need branches?

Look at your feature and figure out which layers it touches:
- **UI changes?** → `Geoff-ERP` needs a branch
- **API/DB changes?** → `GeoffERP-API` needs a branch
- **Infrastructure/config changes?** → `local-dev` needs a branch (or commit to master)
- **Ordering portal changes?** → `ordering-system` needs a branch
- **Seaming changes?** → `seaming-frontend` needs a branch

### How to create them

```bash
# Convention: feature/<feature-name>
# Example: feature/customer_priority

# Frontend
cd ~/NANCY/Geoff-ERP
git stash                              # save any uncommitted work
git checkout develop                   # start from base branch
git pull origin develop                # get latest
git checkout -b feature/customer_priority
git stash pop                          # restore uncommitted work (if any)

# API
cd ~/NANCY/GeoffERP-API
git stash                              # IMPORTANT: this repo has local-dev patches
git checkout staging                   # start from base branch
git pull origin staging                # get latest
git checkout -b feature/customer_priority
# DO NOT pop stash yet — see "Local-Dev Patches" below
```

### Local-Dev Patches (IMPORTANT)

The API repo (`GeoffERP-API`) has 2 uncommitted changes that are **local infrastructure patches**, NOT feature code:

1. **`Startup.cs`** — JWT auth env-gating so the API uses local symmetric key auth instead of AWS Cognito
2. **`appsettings.json`** — `CustomerParentId` placeholder fix (original has invalid JSON that CI normally fixes)

These patches must **NOT** be committed to feature branches. They stay as uncommitted changes on your local machine only.

**After creating the feature branch:**
```bash
cd ~/NANCY/GeoffERP-API
git stash pop                          # restore the local-dev patches
# Now you have: feature branch (clean) + uncommitted local-dev patches
# When you commit feature code, DON'T include Startup.cs or appsettings.json
```

**When committing feature code:**
```bash
# Stage ONLY your feature files — never use `git add .` or `git add -A`
git add GEOFF.CORE/DBModels/TR_CustomerPriority.cs
git add GEOFF.API/Areas/User/Controllers/CustomerPriorityController.cs
# etc.
git commit -m "Add customer priority table and API endpoints"
```

---

## Step 2: Understand the Codebase Patterns

### React Frontend (Geoff-ERP)

The frontend uses **Redux + Redux-Saga** for state management. Every feature follows this pattern:

```
src/
  _utils/constants/         ← Action type strings (REQUEST/SUCCESS/FAILED)
  store/saga/               ← API calls (axios → backend)
  store/reducers/           ← State updates
  components/pages/         ← React components (what you see)
  _routes/                  ← React Router route definitions
```

**To add a new feature:**

1. **Constants** — Create action types in `src/_utils/constants/YourFeature.js`:
   ```js
   export const FEATURE_LIST_REQUEST = "FEATURE_LIST_REQUEST";
   export const FEATURE_LIST_SUCCESS = "FEATURE_LIST_SUCCESS";
   export const FEATURE_LIST_FAILED = "FEATURE_LIST_FAILED";
   // ... CREATE, EDIT, DELETE variants
   ```

2. **Saga** — Create API call handlers in `src/store/saga/yourFeature/yourFeatureSaga.js`:
   ```js
   import { put, takeLatest, call, all } from 'redux-saga/effects';
   import axios from 'axios';
   import { API_URL } from "../../../config";
   import { SESSION_EXPIRED } from "../../../_utils/constants/Auth";
   
   function* fetchList(action) {
     try {
       const response = yield call(
         axios.get,
         `${API_URL}/User/api/CustomerPriority/GetList`,
         { headers: { Authorization: `Bearer ${action.token}` } }
       );
       yield put({ type: SUCCESS, payload: response.data });
     } catch (error) {
       if (error?.response?.status === 401) {
         yield put({ type: SESSION_EXPIRED });
       } else {
         yield put({ type: FAILED, payload: error.response });
       }
     }
   }
   ```

3. **Reducer** — Handle state in `src/store/reducers/yourFeature/YourFeatureReducer.js`:
   ```js
   const initialState = { list: [], isLoading: false, errors: null };
   export default function reducer(state = initialState, action) {
     switch (action.type) {
       case REQUEST: return { ...state, isLoading: true };
       case SUCCESS: return { ...state, isLoading: false, list: action.payload.result };
       case FAILED: return { ...state, isLoading: false, errors: action.payload };
       default: return state;
     }
   }
   ```

4. **Register** — Wire saga and reducer into root:
   - Add saga to `src/store/saga/rootSaga.js`
   - Add reducer to `src/store/reducers/rootReducer.js`

5. **Component** — Build UI in `src/components/pages/yourFeature/`:
   - Use `connect(mapStateToProps, mapDispatchToProps)` to link Redux
   - Use `MainWrapper` for page layout with sidebar
   - Use custom elements from `src/components/elements/` (CustomModel, CustomTable, etc.)
   - Use `react-dropzone` for file upload (see `ImportCustomer.jsx` for example)

6. **Route** — Add route in `src/_routes/adminRoute.js` (or appropriate route file)

**Key files to reference as examples:**
- Role CRUD: `src/components/pages/admin/role/RoleList.jsx` + `AddEdit.jsx`
- File upload: `src/components/pages/admin/storeinfo/models/ImportCustomer.jsx`
- Table with filters: `src/components/pages/existingOrders/ExistingOrdersList.jsx`
- Redux saga: `src/store/saga/role/roleSaga.js`
- Constants: `src/_utils/constants/Role.js`

**Admin area navigation:**
The Admin page (`src/components/pages/admin/Admin.jsx`) renders buttons dynamically from the user's role permissions. It calls `USER_MENU_LIST_REQUEST` to get the user's allowed menus, then renders buttons for each submenu. To add a new admin button:
- Add a new menu + submenu entry in the database (`MS_Menu` table)
- The frontend will automatically render it if the user's role has permission

### .NET API (GeoffERP-API)

The API uses **Areas pattern** with a layered architecture:

```
GEOFF.API/Areas/{Area}/Controllers/   ← HTTP endpoints
GEOFF.BUSINESS/{Domain}Module/        ← Business logic
GEOFF.CORE/DBModels/                  ← Entity Framework models (maps to SQL tables)
GEOFF.CORE/ViewModel/{Domain}/        ← Request/response DTOs
GEOFF.CORE/Interfaces/                ← Repository interfaces
GEOFF.PERSISTENCE/                    ← Repository implementations
GEOFF.HELPER/                         ← Shared utilities
```

**To add a new feature:**

1. **DB Model** — Create entity in `GEOFF.CORE/DBModels/TR_CustomerPriority.cs`:
   ```csharp
   public class TR_CustomerPriority
   {
       [Key]
       public int CustomerPriorityId { get; set; }
       public int ContactInfoId { get; set; }       // FK to customer
       public int PriorityNumber { get; set; }
       public int? StoreId { get; set; }
       public int? CreatedBy { get; set; }
       public DateTime CreatedOn { get; set; }
       public DateTime? ModifyOn { get; set; }
       public bool? IsDeleted { get; set; }
   }
   ```

2. **DbContext** — Register in `GEOFF.CORE/DBModels/GeoffErpDBContext.cs`:
   ```csharp
   public virtual DbSet<TR_CustomerPriority> TR_CustomerPriority { get; set; }
   ```

3. **ViewModel** — Create DTO in `GEOFF.CORE/ViewModel/User/CustomerPriorityViewModel.cs`

4. **Business Module** — Create logic in `GEOFF.BUSINESS/UserModule/CustomerPriorityModule.cs`

5. **Controller** — Create endpoints in `GEOFF.API/Areas/User/Controllers/CustomerPriorityController.cs`:
   ```csharp
   [Area("User")]
   [Route("[area]/api/[controller]")]
   [ApiController]
   [Authorize]
   public class CustomerPriorityController : ControllerBase
   {
       // GET  /User/api/CustomerPriority/GetList
       // POST /User/api/CustomerPriority/Import
       // POST /User/api/CustomerPriority/Update
   }
   ```

6. **DI Registration** — Register repository in `Startup.cs` ConfigureServices

**Response format** — ALL endpoints return:
```json
{
  "responseCode": "200",
  "error": null,
  "responseStatus": "Success",
  "result": [ ... ],
  "totalCount": 42
}
```
Use `ResponseResult<T>.Responses("200", data, ResponseMessage.Success)`.

**Authorization** — The `RoleAuthorizationFilter` checks permissions using action format:
```
{Area}:api:{Controller}:{Action}
```
Example: `User:api:CustomerPriority:GetList`

When you create a new controller, you must add its actions to the role permission system (either via DB seed or the Role management UI).

**Naming conventions:**
- `MS_` prefix = Master (static/config) tables
- `TR_` prefix = Transactional tables
- ViewModels use `{Entity}ViewModel` suffix
- Modules use `{Entity}Module` suffix

**Key files to reference as examples:**
- Controller: `GEOFF.API/Areas/User/Controllers/RolesController.cs`
- Business module: `GEOFF.BUSINESS/UserModule/RoleModule.cs`
- DB model: `GEOFF.CORE/DBModels/MS_Role.cs`
- ViewModel: `GEOFF.CORE/ViewModel/User/RoleViewModel.cs`
- Import logic: `GEOFF.BUSINESS/UserModule/ImportCustomerModule.cs`
- Generic repo pattern: `GEOFF.CORE/Interfaces/IGenericFunctionRepository/IGenericRepository.cs`

### Database Changes

For local development, you create tables directly via SQL against the Docker SQL Server:

```bash
# Connect to local SQL Server
docker exec -it geoff-sqlserver /opt/mssql-tools/bin/sqlcmd \
  -S localhost -U sa -P 'LocalDev123!' -d GeoffERP
```

For changes that need to ship to production, create an EF Core migration:
```bash
cd ~/NANCY/GeoffERP-API
dotnet ef migrations add AddCustomerPriority --project GEOFF.CORE
```

For local-only seed data (menu entries, test data), put SQL scripts in:
```
~/NANCY/local-dev/tasks/migrations/feature_customer_priority.sql
```

---

## Step 3: Develop and Test Locally

### Rebuild after changes

**Frontend changes (React):**
The React dev server has hot reload — save a file and the browser updates automatically. No rebuild needed.
```bash
# If not already running:
cd ~/NANCY/Geoff-ERP && BROWSER=none npm start
```

**API changes (.NET):**
Must rebuild the Docker container after code changes:
```bash
cd ~/NANCY/local-dev/docker
docker compose -p local-dev build api
docker compose -p local-dev up -d api
```
Wait ~30 seconds for the build. Check logs:
```bash
docker logs -f geoff-api
```

**Database changes:**
Run SQL directly:
```bash
docker exec -it geoff-sqlserver /opt/mssql-tools/bin/sqlcmd \
  -S localhost -U sa -P 'LocalDev123!' -d GeoffERP \
  -Q "CREATE TABLE TR_CustomerPriority (...)"
```

### Test in browser

Open Chrome and go to `https://dev.s10drd.com`. Log in with any user from the system (password: `LocalDev123!`).

**IMPORTANT:** The app uses hostname-based routing. You MUST access it through `dev.s10drd.com`, not `localhost:3000`. The `/etc/hosts` file maps this hostname to `127.0.0.1`, and Caddy reverse-proxy handles TLS + routing.

### Check API directly

```bash
# Get a JWT token
curl -s -X POST https://dev.api.s10drd.com/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"robert@standardinteriors.com","password":"LocalDev123!"}' \
  -k | jq .token

# Call your endpoint
curl -s https://dev.api.s10drd.com/User/api/CustomerPriority/GetList \
  -H "Authorization: Bearer <token>" -k | jq
```

### Debugging

**Frontend:** React DevTools + Redux DevTools in Chrome
**API:** Check container logs: `docker logs -f geoff-api`
**Database:** Connect with Azure Data Studio or sqlcmd
**Network:** All services on Docker network `docker_default`, containers reference each other by service name

---

## Step 4: Commit Feature Code

### Rules

1. **Stage specific files only** — NEVER `git add .` or `git add -A`
2. **Don't commit local-dev patches** — `Startup.cs` and `appsettings.json` in API repo stay uncommitted
3. **Don't commit secrets** — No `.env` files, no passwords, no tokens
4. **Commit messages** — Short, descriptive: "Add customer priority upload endpoint" not "updates"

### Example

```bash
# Frontend
cd ~/NANCY/Geoff-ERP
git add src/_utils/constants/CustomerPriority.js
git add src/store/saga/customerPriority/customerPrioritySaga.js
git add src/store/reducers/customerPriority/CustomerPriorityReducer.js
git add src/components/pages/admin/customerPriority/CustomerPriority.jsx
git add src/components/pages/admin/customerPriority/ImportPriority.jsx
git add src/_routes/adminRoute.js
git add src/store/saga/rootSaga.js
git add src/store/reducers/rootReducer.js
git commit -m "Add customer priority admin page with CSV upload"

# API
cd ~/NANCY/GeoffERP-API
git add GEOFF.CORE/DBModels/TR_CustomerPriority.cs
git add GEOFF.CORE/ViewModel/User/CustomerPriorityViewModel.cs
git add GEOFF.BUSINESS/UserModule/CustomerPriorityModule.cs
git add GEOFF.API/Areas/User/Controllers/CustomerPriorityController.cs
git add GEOFF.CORE/DBModels/GeoffErpDBContext.cs
# DO NOT add: GEOFF.API/Startup.cs, GEOFF.API/appsettings.json
git commit -m "Add customer priority table and import endpoint"
```

---

## Step 5: Push for QA

```bash
# Frontend
cd ~/NANCY/Geoff-ERP
git push origin feature/customer_priority

# API
cd ~/NANCY/GeoffERP-API
git push origin feature/customer_priority
```

QA pulls the branches, deploys to their environment, tests. When approved:

```bash
# Create PR: feature/customer_priority → develop (frontend)
# Create PR: feature/customer_priority → staging (API)
```

---

## Step 6: Merge and Clean Up

After PR is merged:
```bash
# Frontend
cd ~/NANCY/Geoff-ERP
git checkout develop
git pull origin develop
git branch -d feature/customer_priority

# API
cd ~/NANCY/GeoffERP-API
git checkout staging
git pull origin staging
git branch -d feature/customer_priority
```

---

## Quick Reference

### Docker Commands (ALWAYS use `-p local-dev`)

```bash
cd ~/NANCY/local-dev/docker

# Rebuild one service
docker compose -p local-dev build api
docker compose -p local-dev up -d api

# Rebuild everything
docker compose -p local-dev build
docker compose -p local-dev up -d

# View logs
docker logs -f geoff-api
docker logs -f geoff-auth-proxy

# SQL shell
docker exec -it geoff-sqlserver /opt/mssql-tools/bin/sqlcmd \
  -S localhost -U sa -P 'LocalDev123!' -d GeoffERP

# Restart a service
docker compose -p local-dev restart auth-proxy

# Full teardown (keeps data)
docker compose -p local-dev down

# Nuclear option (destroys data too)
docker compose -p local-dev down -v
```

### URLs

| URL | What |
|-----|------|
| `https://dev.s10drd.com` | React frontend |
| `https://dev.api.s10drd.com` | API (routed through Caddy) |
| `http://localhost:5001` | API (direct) |
| `http://localhost:3100` | Auth proxy |
| `http://localhost:3200` | D365BC mock |
| `http://localhost:9001` | MinIO console (minioadmin/minioadmin) |

### Login Credentials

All users share password: `LocalDev123!`
Example accounts: `robert@standardinteriors.com`, `alvaro@standardinteriors.com`

---

## Appendix: Feature Spec Template

When starting a new feature, create a spec file at:
```
~/NANCY/local-dev/tasks/features/feature-<name>.md
```

Include:
1. **What** — Plain english description of the feature
2. **Why** — Business reason
3. **Which repos** — Which repos need feature branches
4. **Database changes** — New tables, altered columns, seed data
5. **API endpoints** — Routes, request/response shapes
6. **Frontend components** — New pages, modals, table columns
7. **Role permissions** — Which roles can access this feature
8. **Test plan** — How to verify it works
