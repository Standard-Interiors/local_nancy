# NANCY Local Dev Setup Guide (Mac + Windows)

> **For AI agents:** This guide is designed to be executed step-by-step by Claude Code or similar AI coding agents. Every command is copy-paste ready. Every step has a verification command. Platform-specific commands are labeled `[MAC]` or `[WIN]`.

---

## What this gets you

A **highest fidelity** local NANCY ERP environment. No AWS, no cloud. Everything runs in Docker on your machine.

- Admin dashboard at `https://dev.s10drd.com`
- Log in as **any real employee** (Ashley, Maureen, etc.) — not fake test users
- .NET API, SQL Server, auth, file storage — all local
- **D365 Business Central mock** — vendor/item sync works locally instead of erroring out
- **Real production data** (customers, orders, pricing contracts, users)
- **Auto-provisioned S3 storage** (MinIO with auto-bucket creation)
- Login: any real employee email / `LocalDev123!`

### Design principle

> **Highest fidelity possible.** The local environment should behave identically to production. Real users, real data, real auth flow, real BC integration (mocked). If something works locally, it should work in prod. No fake users, no skipped services, no silent failures.

### Three critical components (REQUIRED — do not skip)

| Component | What it does | Without it |
|---|---|---|
| **Real user DB auth** (auth-proxy with MS_User lookup) | Log in as any real employee, see their actual store/role/data | Stuck with 3 fake users that don't exist in the real DB — can't test as real employees |
| **D365 BC mock** | Fakes Microsoft Dynamics 365 Business Central for vendor/item sync | Any BC integration in NANCY just errors out (500s) |
| **minio-init** | Auto-creates the S3 file upload bucket on startup | File uploads silently fail until someone manually creates the bucket |

---

## Before you start — gather these

| Item | Where to get it | Notes |
|---|---|---|
| **GitHub access** | `laitkor-org` organization | Your account needs read access to all 7 repos |
| **Database dump** — `GEOFFERPDB_LIVE_backup.sql` | Team lead (Jay / Robert) | ~423 MB SQL file. Full live backup with real data |
| **~20 GB free disk** | — | Docker images + DB + source code |

> **Security warning:** `GEOFFERPDB_LIVE_backup.sql` contains **real production PII** — customer names, employee emails, order details, pricing data. Do NOT commit it to any git repo, share screenshots with real data outside the team, or copy it to unencrypted storage.

---

## Repos and branches — source of truth

Clone all repos from **`laitkor-org`**. The `local-dev` infrastructure repo is at **`Standard-Interiors`**.

| Repo | Org | Branch to use | Required? |
|---|---|---|---|
| `GeoffERP-API` | `laitkor-org` | **`staging`** | Yes — .NET API |
| `Geoff-ERP` | `laitkor-org` | **`develop`** | Yes — React frontend |
| `ordering-system` | `laitkor-org` | `master` (default) | Yes — customer ordering portal |
| `seaming-frontend` | `laitkor-org` | `master` (default) | Yes — seaming SVG editor |
| `floorplan-backend` | `laitkor-org` | `main` (default) | Yes — floorplan/measurement |
| `GeoffQA` | `laitkor-org` | default | Optional — QA tooling |
| `geoff-automation-test` | `laitkor-org` | default | Optional — automation tests |
| `local_nancy` | `Standard-Interiors` | `master` | Yes — local-dev infra + docs |

---

## System requirements

| Resource | Minimum | Recommended |
|---|---|---|
| **RAM** | 8 GB | 16 GB |
| **Disk** | 10 GB free | 20 GB free |
| **Docker memory** | 4 GB allocated | 6-8 GB allocated |
| **OS** | macOS 12+ / Windows 10 21H2+ | macOS 13+ / Windows 11 |
| **CPU** | Any (Intel or Apple Silicon) | Apple Silicon or modern Intel |

---

## Dependencies — EXACT versions and install commands

### Docker Desktop (REQUIRED — install first)

Docker Desktop includes Docker Engine + Docker Compose v2. One install, both tools.

**[MAC]**
```bash
# Download and install from:
# https://www.docker.com/products/docker-desktop/
# Choose "Mac with Apple Chip" for M1/M2/M3/M4, or "Mac with Intel Chip"

# After install, open Docker Desktop app and let it finish initializing.
# Then verify:
docker --version          # Expect: Docker version 24.0+ (tested with 29.3.1)
docker compose version    # Expect: Docker Compose version v2.x+ (tested with v5.1.1)
```

**[WIN] (PowerShell as Administrator)**
```powershell
# Download and install from:
# https://www.docker.com/products/docker-desktop/
# IMPORTANT: During install, ensure "Use WSL 2 based engine" is checked

# After install, open Docker Desktop and let it finish initializing.
# Then verify in PowerShell:
docker --version          # Expect: Docker version 24.0+
docker compose version    # Expect: Docker Compose version v2.x+
```

**Docker Desktop settings (BOTH platforms):**
After install, open Docker Desktop > Settings > Resources:
- Memory: **6 GB minimum** (8 GB recommended)
- CPU: at least 4 cores
- Disk image: at least 20 GB

**[WIN] CRITICAL:** Docker Desktop must be in **Linux containers** mode (default). If you see "Switch to Linux containers..." in the Docker tray menu, click it. If you see "Switch to Windows containers..." you're already correct.

---

### Git

**[MAC]**
```bash
# Usually pre-installed. Verify:
git --version    # Expect: git version 2.x

# If missing:
xcode-select --install    # Installs Git + Xcode CLI tools
```

**[WIN]**
```powershell
# Download from https://git-scm.com/download/win
# IMPORTANT: During install, select "Checkout as-is, commit Unix-style line endings"
# This prevents CRLF issues that break Docker container scripts.

git --version    # Expect: git version 2.x

# After install, configure line endings:
git config --global core.autocrlf input
```

---

### Node.js 18+ and npm

The React frontend runs on your host machine (not in Docker). It needs Node.js.

**[MAC]**
```bash
# Option A: Homebrew (recommended)
brew install node@18
echo 'export PATH="/opt/homebrew/opt/node@18/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc

# Option B: Direct download from https://nodejs.org/ (LTS version)

# Verify:
node --version    # Expect: v18.x or v20.x (tested with v20.20.2)
npm --version     # Expect: 9.x or 10.x (tested with 10.8.2)
```

**[WIN]**
```powershell
# Download LTS from https://nodejs.org/ and run the installer
# Check "Automatically install necessary tools" during setup

# Verify in a NEW terminal:
node --version    # Expect: v18.x or v20.x
npm --version     # Expect: 9.x or 10.x
```

---

### mkcert (local TLS certificates)

Creates trusted HTTPS certificates so Chrome doesn't show security warnings.

**[MAC]**
```bash
brew install mkcert
brew install nss       # For Firefox support (optional)
mkcert -install        # Adds mkcert CA to system trust store (needs sudo)
mkcert --version       # Expect: v1.4.x (tested with v1.4.4)
```

**[WIN] (PowerShell as Administrator)**
```powershell
# Option A: Chocolatey
choco install mkcert

# Option B: Direct download from https://github.com/FiloSottile/mkcert/releases
# Download mkcert-vX.X.X-windows-amd64.exe, rename to mkcert.exe, add to PATH

mkcert -install        # Adds mkcert CA to Windows certificate store
mkcert --version       # Expect: v1.4.x
```

---

### Apple Silicon only (M1/M2/M3/M4 Macs)

```bash
# Rosetta 2 — required for x86 Docker images (.NET API, floorplan)
softwareupdate --install-rosetta --agree-to-license

# Verify:
/usr/bin/arch -x86_64 /bin/echo "Rosetta works"    # Should print "Rosetta works"
```

---

### sqlcmd (for database seeding)

**[MAC]**
```bash
# go-sqlcmd (Microsoft's cross-platform version)
brew install sqlcmd

# Verify:
sqlcmd --version    # Expect: any version
```

**[WIN]**
```powershell
# Download from: https://learn.microsoft.com/en-us/sql/tools/sqlcmd/sqlcmd-utility
# Or install via winget:
winget install Microsoft.SqlCmd

# Verify:
sqlcmd -?    # Should show help output
```

---

### Pre-flight verification (run this to check everything at once)

**[MAC]**
```bash
echo "=== Pre-flight check ===" && \
docker --version && \
docker compose version && \
git --version && \
node --version && \
npm --version && \
mkcert --version && \
sqlcmd --version 2>/dev/null || sqlcmd -? 2>/dev/null | head -1 && \
echo "=== All dependencies OK ==="
```

**[WIN]**
```powershell
Write-Host "=== Pre-flight check ==="
docker --version
docker compose version
git --version
node --version
npm --version
mkcert --version
sqlcmd -? 2>$null | Select-Object -First 1
Write-Host "=== All dependencies OK ==="
```

---

## Step 1 — Clone all repos

All repos must be siblings in the same parent directory.

**[MAC]**
```bash
mkdir -p ~/NANCY && cd ~/NANCY

git clone https://github.com/laitkor-org/GeoffERP-API.git
git clone https://github.com/laitkor-org/Geoff-ERP.git
git clone https://github.com/laitkor-org/ordering-system.git
git clone https://github.com/laitkor-org/seaming-frontend.git
git clone https://github.com/laitkor-org/floorplan-backend.git
git clone https://github.com/laitkor-org/GeoffQA.git
git clone https://github.com/laitkor-org/geoff-automation-test.git

# local-dev infra repo (different org)
git clone https://github.com/Standard-Interiors/local_nancy.git local-dev
```

**[WIN]**
```powershell
mkdir C:\Users\$env:USERNAME\NANCY
cd C:\Users\$env:USERNAME\NANCY

git clone https://github.com/laitkor-org/GeoffERP-API.git
git clone https://github.com/laitkor-org/Geoff-ERP.git
git clone https://github.com/laitkor-org/ordering-system.git
git clone https://github.com/laitkor-org/seaming-frontend.git
git clone https://github.com/laitkor-org/floorplan-backend.git
git clone https://github.com/laitkor-org/GeoffQA.git
git clone https://github.com/laitkor-org/geoff-automation-test.git

# local-dev infra repo (different org)
git clone https://github.com/Standard-Interiors/local_nancy.git local-dev
```

> **If `git clone` fails with "Repository not found"**: GitHub masks private repos as 404 when unauthenticated. Sign in to GitHub in a browser, then run `gh auth setup-git` to register `gh` as the credential helper. Then retry.

### Switch to the correct branches

The `main` branches are stubs. The real app code lives on specific branches:

```bash
cd ~/NANCY/GeoffERP-API && git checkout staging
cd ~/NANCY/Geoff-ERP    && git checkout develop
cd ~/NANCY
```

The other 5 repos can stay on their default branch.

### Place the database dump

Put `GEOFFERPDB_LIVE_backup.sql` directly in the `NANCY/` folder (not in a subfolder):

```
NANCY/
  GEOFFERPDB_LIVE_backup.sql    <-- here (423 MB)
  GeoffERP-API/
  Geoff-ERP/
  local-dev/
  ...
```

### Expected directory structure

```
~/NANCY/
  GEOFFERPDB_LIVE_backup.sql   <-- live DB dump from team lead
  GeoffERP-API/                <-- branch: staging
  Geoff-ERP/                   <-- branch: develop
  floorplan-backend/           <-- branch: main (default)
  seaming-frontend/            <-- branch: master (default)
  ordering-system/             <-- branch: master (default)
  GeoffQA/                     <-- branch: default (optional)
  geoff-automation-test/       <-- branch: default (optional)
  local-dev/                   <-- cloned from Standard-Interiors/local_nancy
```

### Verify

```bash
ls ~/NANCY/GeoffERP-API/GEOFF.API/Startup.cs && \
ls ~/NANCY/Geoff-ERP/package.json && \
ls ~/NANCY/floorplan-backend/requirements.txt && \
ls ~/NANCY/local-dev/ && \
echo "Directory structure OK"
```

---

## Step 2 — Apply the API patches

Two files in GeoffERP-API need changes. The `local_dev_env` branch should already have them.

### Verify Patch 1: Startup.cs

```bash
grep -c '"Local"' ~/NANCY/GeoffERP-API/GEOFF.API/Startup.cs
```

**Expected:** A number > 0 (means the Local JWT auth branch exists).
**If 0:** The patch isn't applied. Ask the team lead or apply from the `local_dev_env` branch.

### Verify Patch 2: appsettings.json

```bash
grep "CustomerParentId" ~/NANCY/GeoffERP-API/GEOFF.API/appsettings.json
```

**Expected:** `"CustomerParentId": 0` (a number, not `PLACEHOLDER_CUSTOMER_PARENT_ID`)
**If you see `PLACEHOLDER_CUSTOMER_PARENT_ID`:** Change it to `0`:

**[MAC]**
```bash
sed -i '' 's/PLACEHOLDER_CUSTOMER_PARENT_ID/0/' ~/NANCY/GeoffERP-API/GEOFF.API/appsettings.json
```

**[WIN]**
```powershell
(Get-Content ~/NANCY/GeoffERP-API/GEOFF.API/appsettings.json) -replace 'PLACEHOLDER_CUSTOMER_PARENT_ID', '0' | Set-Content ~/NANCY/GeoffERP-API/GEOFF.API/appsettings.json
```

---

## Step 3 — Generate TLS certificates

```bash
cd ~/NANCY/local-dev
mkdir -p certs && cd certs

mkcert \
  dev.s10drd.com \
  dev.api.s10drd.com \
  dev.seaming.s10drd.com \
  dev.mapy.s10drd.com \
  order.s10drd.com

mv dev.s10drd.com+4.pem cert.pem
mv dev.s10drd.com+4-key.pem key.pem
```

### Verify

```bash
ls -la ~/NANCY/local-dev/certs/cert.pem ~/NANCY/local-dev/certs/key.pem
```

Both files must exist and be non-empty.

---

## Step 4 — Configure hosts file

### [MAC]

```bash
# Append host entries (requires sudo password)
sudo bash -c 'cat >> /etc/hosts << EOF

# NANCY Local Dev
127.0.0.1  dev.s10drd.com
127.0.0.1  dev.api.s10drd.com
127.0.0.1  dev.seaming.s10drd.com
127.0.0.1  dev.mapy.s10drd.com
127.0.0.1  order.s10drd.com
EOF'

# Flush DNS cache
sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder
```

### [WIN] (PowerShell as Administrator)

```powershell
$hostsPath = "$env:SystemRoot\System32\drivers\etc\hosts"
$entries = @"

# NANCY Local Dev
127.0.0.1  dev.s10drd.com
127.0.0.1  dev.api.s10drd.com
127.0.0.1  dev.seaming.s10drd.com
127.0.0.1  dev.mapy.s10drd.com
127.0.0.1  order.s10drd.com
"@
Add-Content -Path $hostsPath -Value $entries
ipconfig /flushdns
```

### Verify

```bash
ping -c 1 dev.s10drd.com 2>/dev/null || ping -n 1 dev.s10drd.com
```

Should resolve to `127.0.0.1`.

---

## Step 5 — Create the .env file

**Only needed if `~/NANCY/local-dev/.env` doesn't already exist.**

```bash
cat > ~/NANCY/local-dev/.env << 'EOF'
DB_HOST=sqlserver
DB_PORT=1433
DB_NAME=GeoffERP
DB_USER=sa
DB_PASSWORD=LocalDev123!
JWT_KEY=GeoffLocalDevKey_MustBe32CharsOrMore!
JWT_ISSUER=https://dev.api.s10drd.com
JWT_AUDIENCE=geoff-local
AES_KEY=1234567890123456
AES_IV=1234567890123456
AUTH_PROXY_PORT=3100
DEFAULT_PASSWORD=LocalDev123!
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin
AWS_ACCESS_KEY_S3=minioadmin
AWS_SECRET_KEY_S3=minioadmin
AWS_BUCKET_NAME_S3=geoff-pdfs
AWS_REGION_S3=us-east-1
EOF
```

### Verify

```bash
grep DB_PASSWORD ~/NANCY/local-dev/.env    # Should show: DB_PASSWORD=LocalDev123!
```

---

## Step 6 — Create appsettings.Local.json

**Only needed if `~/NANCY/local-dev/appsettings.Local.json` doesn't already exist.**

This is the .NET API's config that redirects all cloud services to local Docker containers.

<details>
<summary>Click to expand full appsettings.Local.json (copy-paste ready)</summary>

```bash
cat > ~/NANCY/local-dev/appsettings.Local.json << 'ENDJSON'
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft": "Warning"
    }
  },
  "ConnectionStrings": {
    "geoffConn": "Server=sqlserver,1433;Database=GeoffERP;User Id=sa;Password=LocalDev123!;TrustServerCertificate=True",
    "ExcelConString": ""
  },
  "AWSCognito": {
    "ClientId": "not-used-local",
    "UserPoolId": "not-used-local",
    "IdentityPoolId": "not-used-local",
    "IdentityProvider": "cognito-idp.us-east-1.amazonaws.com",
    "AccessKey": "not-used-local",
    "SecretKey": "not-used-local",
    "CustomAttribute": {
      "RoleId": "custom:RoleId",
      "MultipleRole": "custom:multipleroleid"
    }
  },
  "AESKey": {
    "AesKey": "1234567890123456",
    "IV": "1234567890123456"
  },
  "JWTKey": {
    "Key": "GeoffLocalDevKey_MustBe32CharsOrMore!",
    "Issuer": "https://dev.api.s10drd.com",
    "Audience": "geoff-local"
  },
  "Jwt": {
    "Key": "GeoffLocalDevKey_MustBe32CharsOrMore!",
    "Issuer": "https://dev.api.s10drd.com",
    "Audience": "geoff-local"
  },
  "RoleAccessPath": "../GEOFF.API/RoleAccess",
  "Vendor": { "DefaultVendor": "GeOff" },
  "AWSS3Bucket": {
    "AccessKey": "minioadmin",
    "SecretKey": "minioadmin",
    "BucketName": "geoff-pdfs",
    "BucketUrl": "http://minio:9000/geoff-pdfs/"
  },
  "AllowedfileExt": { "Ext": ".jpeg,.jpg,.png,.xlsx,.xls,.pdf,.csv,.svg" },
  "CrossDomain": {
    "Measure": "https://dev.seaming.s10drd.com",
    "Ordering": "https://order.s10drd.com"
  },
  "UploadFolder": {
    "SVG": "../GEOFF.API/Upload/SVG",
    "PNG": "../GEOFF.API/Upload/PNG"
  },
  "PusherDetail": {
    "AppId": "local",
    "PublicKey": "local",
    "SecretKey": "local",
    "Cluster": "local",
    "Channel": "local-dev",
    "Event": "update-order-status"
  },
  "Roles": { "CustomerParentId": 42 },
  "Store": { "DefaultStore": 12 },
  "EmailConfiguration": {
    "From": "local@dev.local",
    "SmtpServer": "localhost",
    "Port": 587,
    "Username": "local",
    "Password": "local",
    "Subject": "Local Dev",
    "EmailText": "",
    "VarificationUrl": "https://order.s10drd.com"
  },
  "Frontend_URL": { "Url": "https://dev.s10drd.com" },
  "Mail": { "Content": "" },
  "PricingContract": { "WallBase_ProductStructureID": 172 },
  "LaborCategory": {
    "StandardStair_LaborCategoryID": 1114,
    "SpecializedStair_LaborCategoryID": 1115
  },
  "AvalaraTax": {
    "UserId": "local",
    "Password": "local",
    "BaseUrl": "https://rest.avatax.com",
    "EndPoint": "/api/v2/transactions/create"
  },
  "Odoo": {
    "APIKey": "local",
    "BaseUrl": "https://localhost",
    "CountryState": "odooCountryState.json"
  },
  "APIStatus": { "UserId": 1 },
  "D365BC": {
    "bcTenant": "mock-tenant",
    "bcClientId": "mock-client",
    "loginEndPoint": "http://d365bc-mock:3200",
    "bcClientSecret": "mock-secret",
    "bcEnvironment": "local",
    "bcCompany": "mock-company",
    "baseUrl": "http://d365bc-mock:3200"
  },
  "OrderEmail": { "ToEmailAddress": "local@dev.local" },
  "AwsCloudWatchLog": {
    "AccessKey": "local",
    "SecretKey": "local",
    "LogGroupName": "local-dev"
  },
  "HubSpot": {
    "ApiKey": "local",
    "ClientSecret": "local",
    "MultifamilyPipelineId": "1260367605",
    "DugoutStageId": "2024343266"
  },
  "BC365Integration": {
    "bcClientId": "local",
    "RequireJWT": true,
    "JWTSecret": "GeoffLocalDevKey_MustBe32CharsOrMore!",
    "JWTIssuer": "NancyERP",
    "JWTAudience": "BC365Client",
    "JWTExpiryMinutes": "60",
    "LogPath": "./Logs/BC",
    "apiOrigin": "http://d365bc-mock:3200",
    "bcApiKey": "local"
  },
  "RingCentral": {
    "ClientId": "local",
    "ClientSecret": "local",
    "JwtToken": "local",
    "PollingIntervalMinutes": 9999,
    "ServerUrl": "https://localhost"
  }
}
ENDJSON
```

</details>

### Verify

```bash
python3 -c "import json; json.load(open('$HOME/NANCY/local-dev/appsettings.Local.json')); print('Valid JSON')"
```

---

## Step 7 — Seed the database

### 7a. Start SQL Server

```bash
cd ~/NANCY/local-dev
docker compose up -d sqlserver
```

### 7b. Wait for healthy

```bash
# Poll until healthy (up to 2 minutes)
echo "Waiting for SQL Server..."
for i in $(seq 1 24); do
  STATUS=$(docker inspect --format='{{.State.Health.Status}}' geoff-sqlserver 2>/dev/null)
  echo "  Status: $STATUS"
  [ "$STATUS" = "healthy" ] && echo "SQL Server is ready!" && break
  sleep 5
done
```

### 7c. Load the seed data

The seed file is `restore-clean.sql` (443 MB). This takes 5-20 minutes depending on hardware.

**Recommended approach (works on both platforms — uses a sidecar container):**

```bash
cd ~/NANCY/local-dev

# Get the Docker network name
NETWORK=$(docker network ls --filter "name=local-dev" --format "{{.Name}}" | head -1)

# Run sqlcmd in a sidecar container connected to the same network
docker run --rm -i \
  --network "$NETWORK" \
  -v "$(pwd)/restore-clean.sql:/tmp/restore-clean.sql:ro" \
  mcr.microsoft.com/mssql-tools \
  /opt/mssql-tools/bin/sqlcmd \
  -S geoff-sqlserver -U sa -P 'LocalDev123!' \
  -i /tmp/restore-clean.sql
```

**Alternative — host sqlcmd (if installed in Step 0):**

```bash
cd ~/NANCY/local-dev
sqlcmd -S localhost,1433 -U sa -P 'LocalDev123!' -i restore-clean.sql
```

**[WIN] PowerShell alternative:**

```powershell
cd ~/NANCY/local-dev
sqlcmd -S "localhost,1433" -U sa -P "LocalDev123!" -i restore-clean.sql
```

### 7d. Verify

```bash
docker run --rm \
  --network "$NETWORK" \
  mcr.microsoft.com/mssql-tools \
  /opt/mssql-tools/bin/sqlcmd \
  -S geoff-sqlserver -U sa -P 'LocalDev123!' \
  -Q "SELECT COUNT(*) AS TableCount FROM GeoffERP.INFORMATION_SCHEMA.TABLES" \
  -h -1 -W
```

**Expected:** A number 100+ (the GeoffERP database has ~130 tables).

---

## Step 8 — Build and start all containers

```bash
cd ~/NANCY/local-dev
docker compose build     # First time: 5-10 minutes. Subsequent: seconds.
docker compose up -d     # Start all 9 services in background.
```

### Verify all containers

```bash
docker compose ps
```

**Expected — 9 running containers:**

| Container | Status |
|---|---|
| `geoff-sqlserver` | Up (healthy) |
| `geoff-auth-proxy` | Up (healthy) |
| `geoff-d365bc-mock` | Up (healthy) |
| `geoff-api` | Up |
| `geoff-caddy` | Up |
| `geoff-floorplan` | Up |
| `geoff-minio` | Up (healthy) |
| `geoff-seaming` | Up |
| `geoff-ordering` | Up |

(`geoff-minio-init` will show Exited(0) — that's correct, it's a one-shot init container.)

### Quick health checks

```bash
# Auth proxy
curl -sk https://dev.api.s10drd.com/health && echo ""

# D365 BC mock
curl -s http://localhost:3200/health && echo ""

# API (direct)
curl -s http://localhost:5001/api/values 2>/dev/null; echo "(any response = API is up)"

# MinIO
curl -s http://localhost:9000/minio/health/live && echo ""
```

---

## Step 9 — Start the React frontend

```bash
cd ~/NANCY/Geoff-ERP
npm install --legacy-peer-deps    # First time: 1-3 minutes
npm start                         # Starts dev server at localhost:3000
```

**Important:** Leave this terminal running. The React dev server must stay up for the dashboard to work.

**[MAC] Apple Silicon note:** If `npm install` fails with node-gyp errors:
```bash
xcode-select --install    # Install Xcode CLI tools if missing
```

**[WIN] note:** If `npm start` fails with EACCES errors, run your terminal as Administrator.

### Verify

```bash
curl -sk https://dev.s10drd.com | head -1    # Should return HTML
```

---

## Step 10 — Log in

Open Chrome: `https://dev.s10drd.com`

| Field | Value |
|---|---|
| Email | Any real employee (e.g. `ashley@standardinteriors.com`, `maureen@standardinteriors.com`) |
| Password | `LocalDev123!` (same for all users locally) |

**Expected after login:**
- Dashboard with tiles: Contacts (500), Proposals (500), Orders (500), Invoices A/R (500), Reports (500)
- Sidebar (hamburger menu): Dashboard, Place An Order, Existing Orders, Deleted Orders, Sales Customer Info, Pricing Contracts

---

## Docker images reference

Every Docker image used by the stack:

| Service | Image | Platform | Purpose |
|---|---|---|---|
| sqlserver | `mcr.microsoft.com/azure-sql-edge:latest` | Multi-arch (ARM64 native) | SQL Server (ARM-compatible variant) |
| auth-proxy | Custom build (`./auth-proxy/Dockerfile`) | `node:18-slim` base | Replaces AWS Cognito |
| d365bc-mock | Custom build (`./d365bc-mock/Dockerfile`) | `node:18-slim` base | Replaces Microsoft D365 BC |
| api | Custom build (`Dockerfile.api`) | `linux/amd64` forced | .NET Core 3.1 API (built with SDK 6.0) |
| floorplan | Custom build (`Dockerfile.floorplan`) | `linux/amd64` forced | Python 3.10 + wkhtmltopdf |
| minio | `minio/minio` | Multi-arch | S3-compatible storage (replaces AWS S3) |
| minio-init | `minio/mc` | Multi-arch | One-shot: creates default bucket |
| seaming-web | `python:3.10-slim` | Multi-arch | Static file server for seaming editor |
| ordering-web | `python:3.10-slim` | Multi-arch | Static file server for ordering portal |
| caddy | `caddy:2` | Multi-arch | Reverse proxy + TLS termination |

**Apple Silicon note:** The `api` and `floorplan` services are forced to `linux/amd64` and run under Rosetta 2 emulation. This is intentional — the .NET Core 3.1 runtime and wkhtmltopdf have no ARM64 images.

---

## Architecture

```
Browser (Chrome)
  |
  | /etc/hosts -> 127.0.0.1
  v
[Caddy :443] ---- TLS (mkcert certs) ----
  |
  |-- dev.s10drd.com ----------> host.docker.internal:3000 (React on host)
  |
  |-- dev.api.s10drd.com -----> auth-proxy:3100 (login routes only)
  |                         \-> api:5000 (everything else)
  |
  |-- dev.seaming.s10drd.com -> seaming-web:8082
  |-- dev.mapy.s10drd.com ----> floorplan:80
  |-- order.s10drd.com -------> ordering-web:8083
  
[api:5000]
  +--> sqlserver:1433       (GeoffERP database)
  +--> minio:9000           (file uploads)
  +--> d365bc-mock:3200     (vendor/item sync)

[auth-proxy:3100]
  +--> sqlserver:1433       (user lookup + password check)
```

### Cloud-to-local mapping

| Production | Local | Container |
|---|---|---|
| AWS Cognito | auth-proxy (HS256 JWT) | `geoff-auth-proxy` |
| Microsoft D365 Business Central | d365bc-mock (in-memory) | `geoff-d365bc-mock` |
| AWS S3 | MinIO | `geoff-minio` |
| Azure SQL / RDS | Azure SQL Edge | `geoff-sqlserver` |
| CloudFront / ALB | Caddy | `geoff-caddy` |
| Route53 DNS | /etc/hosts | (host machine) |
| ACM Certificates | mkcert | (host machine) |

---

## Port map

| Port | Service | Access |
|---|---|---|
| 80 | Caddy HTTP | `http://dev.s10drd.com` (redirects to 443) |
| 443 | Caddy HTTPS | `https://dev.s10drd.com` (main entry point) |
| 1433 | SQL Server | `localhost,1433` (Azure Data Studio / SSMS) |
| 3000 | React dev server | Via Caddy only (don't browse directly) |
| 3100 | Auth proxy | Via Caddy only |
| 3200 | D365 BC mock | Container-internal only |
| 5001 | .NET API (host-mapped) | `http://localhost:5001` (direct debug) |
| 9000 | MinIO S3 API | Container-internal |
| 9001 | MinIO web console | `http://localhost:9001` (login: minioadmin/minioadmin) |

---

## Daily commands

### Start everything

```bash
cd ~/NANCY/local-dev && docker compose up -d
cd ~/NANCY/Geoff-ERP && npm start
# Open https://dev.s10drd.com
```

### Stop everything

```bash
cd ~/NANCY/local-dev && docker compose down
# Ctrl+C in the npm start terminal
```

### Restart a single service

```bash
docker compose restart api           # Restart just the API
docker compose restart auth-proxy    # Restart just auth
docker compose logs -f api           # Tail API logs
```

### Full reset (deletes all data)

```bash
cd ~/NANCY/local-dev
docker compose down -v         # Remove containers + volumes
docker compose build --no-cache  # Rebuild from scratch
docker compose up -d sqlserver   # Start SQL first
# Wait for healthy, then re-seed (Step 7)
docker compose up -d             # Start everything
```

---

## Troubleshooting

### Cannot connect to dev.s10drd.com

```bash
# 1. Check hosts file
grep s10drd /etc/hosts                                    # [MAC]
type C:\Windows\System32\drivers\etc\hosts | findstr s10drd  # [WIN]

# 2. Check Caddy is up
docker compose ps caddy

# 3. Check React is running
curl -s http://localhost:3000 | head -1

# 4. Check Caddy logs
docker compose logs caddy
```

### Login fails / 401

```bash
# 1. Check auth-proxy
docker compose ps auth-proxy
docker compose logs auth-proxy | tail -20

# 2. Verify DB has users
docker run --rm --network local-dev_default \
  mcr.microsoft.com/mssql-tools \
  /opt/mssql-tools/bin/sqlcmd \
  -S geoff-sqlserver -U sa -P 'LocalDev123!' \
  -Q "SELECT COUNT(*) FROM GeoffERP.dbo.MS_User" -h -1 -W
# Expected: 50+ users
```

### API returns 500

```bash
docker compose logs api | tail -30
# Common causes:
# - appsettings.Local.json missing or invalid JSON
# - SQL Server not healthy yet (wait 30s, retry)
# - PLACEHOLDER_CUSTOMER_PARENT_ID not fixed (Step 2)
```

### Docker build fails (Apple Silicon)

```bash
# Ensure Rosetta 2 is installed
softwareupdate --install-rosetta --agree-to-license

# Increase Docker memory to 8GB
# Docker Desktop > Settings > Resources > Memory

# If .NET build hangs, try:
docker compose build api --no-cache
```

### Docker build fails (Windows)

```powershell
# 1. Ensure Linux containers mode
# Right-click Docker tray > "Switch to Linux containers" if available

# 2. Fix line endings
git config --global core.autocrlf input
# Re-clone repos if line endings are already wrong

# 3. Check WSL 2 is installed
wsl --status
```

### Port 80/443 already in use

```bash
# [MAC] Check what's using the port:
sudo lsof -i :80
sudo lsof -i :443

# [WIN] Check what's using the port:
netstat -ano | findstr :80
netstat -ano | findstr :443
# IIS fix: iisreset /stop
# Apache fix: net stop Apache2.4
```

### Port 1433 already in use (local SQL Server running)

```bash
# [MAC]
brew services stop mssql-server 2>/dev/null

# [WIN]
net stop MSSQLSERVER       # Stop default instance
net stop "SQL Server (MSSQLEXPRESS)"  # Stop Express
```

---

## Connecting to the database

Use **Azure Data Studio** (free, Mac + Windows) or **SSMS** (Windows only).

| Setting | Value |
|---|---|
| Server | `localhost,1433` |
| Authentication | SQL Login |
| User | `sa` |
| Password | `LocalDev123!` |
| Database | `GEOFFERPDB_LIVE` (Windows) or `GeoffERP` (Mac) |
| Trust server certificate | Yes |

---

## Credentials summary

| What | Value |
|---|---|
| **App login** | Any real employee email (e.g. `ashley@standardinteriors.com`) / `LocalDev123!` |
| SQL Server | `sa` / `LocalDev123!` |
| MinIO | `minioadmin` / `minioadmin` |
| JWT signing key | `GeoffLocalDevKey_MustBe32CharsOrMore!` |
| AES key / IV | `1234567890123456` / `1234567890123456` |

All users in the database get the same local password (`LocalDev123!`). None of these values are used in production.

---

## Lessons learned (real problems from Windows setup)

These are landmines discovered during real end-to-end setups on clean Windows machines. Most cost 30+ minutes to diagnose. If you hit something, check here first.

### Prerequisites / environment

1. **Git has no credential helper on Windows out of the box.** `git clone` returns "Repository not found" (not 403 — GitHub masks private repos). Fix: `gh auth setup-git`.

2. **Docker Desktop requires WSL2 kernel separately.** The installer enables WSL but often doesn't install the kernel. Docker fails to start after reboot. Fix: `wsl --install --no-distribution` in admin PowerShell, reboot.

3. **Docker stale processes after a crash.** Next launch shows "These processes are running" dialog. Click **Stop processes** — don't kill them from Task Manager.

4. **`mcr.microsoft.com` has intermittent EOF errors.** Docker pulls from Microsoft occasionally fail mid-download. Just retry — usually works on attempt 2.

### API compile errors on `staging` (pre-existing)

The `staging` branch has **5 pre-existing compile errors** that block `dotnet publish`. None are caused by local dev — they're upstream bugs. All need hand-patching:

| Error | File | Fix |
|---|---|---|
| Duplicate `ActivityLogModule` class | `GEOFF.BUSINESS/MasterModule/` and `AdminModule/AdminMaster/` | Rename `MasterModule/ActivityLogModule.cs` to `.bak` |
| `MS_Store.Status` doesn't exist | `GEOFF.BUSINESS/AdminModule/AdminMaster/Store.cs` | Comment out the two lines that set/read `.Status` |
| `Store` namespace shadows `Store` class | `GEOFF.API/Areas/Admin/MasterController.cs`, `StoreController.cs` | Add `using StoreBL = GEOFF.BUSINESSLAYER.AdminModule.AdminMaster.Store;` then swap references |
| `Vendor` namespace shadows `Vendor` class | `GEOFF.API/Areas/ValueList/Controllers/VendorController.cs` | Same pattern — `using VendorBL = ...` |
| `ActivityLogController` uses old namespace | `GEOFF.API/Areas/Master/Controllers/ActivityLogController.cs` | Change `GEOFF.CORE.ViewModel.Master` to `GEOFF.MODELS.ViewModel.AdminMaster` |
| `GenerateJSONWebToken` signature mismatch | `GEOFF.API/Controllers/AuthenticationController.cs` | Add `using GEOFF.CORE.Class.Authorization;` and pass `new RoleAccess()` as 2nd arg |

### ERP frontend (Geoff-ERP) — dependency pitfalls

This took 12+ build attempts on Windows. Root causes in order of severity:

1. **Missing `.dockerignore`** — host's stale `node_modules/` overwrites freshly installed one. Always create `.dockerignore` excluding `node_modules`, `package-lock.json`, `.git`.
2. **`react-loading-overlay@1.0.1` is React 16 only** — peer dep black hole. Replace with inline `<ClipLoader>` wrapper.
3. **`package-lock.json` on develop is pinned to react-scripts 4.x transitives** — don't copy it into the Docker image. Let npm resolve fresh.
4. **CRA 5 treats deprecation warnings as errors** — set `SKIP_PREFLIGHT_CHECK`, `ESLINT_NO_DEV_ERRORS`, `GENERATE_SOURCEMAP=false` on the container.
5. **`react-redux@9` requires `redux@5`** — incompatible with `redux-saga`. Pin to `^8.1.0`.
6. **Don't remove `react-icons-kit`** — Header.jsx imports it even though it looks unused.
7. **Drop the `postinstall` script** — it copies `es6-promise.map` from paths that don't exist in Docker.

### Floorplan backend

- **Port mismatch**: `config.py` hard-codes `PORT = 80`. Map `5008:80` and proxy to `floorplan:80`.
- **boto3 `NoRegionError`**: Needs `AWS_DEFAULT_REGION` env var even when talking to MinIO. `AWS_REGION_S3` alone doesn't count.

### Caddy / TLS

- **mkcert CA must be re-installed per browser.** Run `mkcert -install` and fully close/reopen browser.
- **`auto_https off`** in Caddyfile is essential — otherwise Caddy tries to get real Let's Encrypt certs and hangs.

### Auth proxy

- **Tokens sign with HS256 using the same key the API validates with.** If you change `JWT_KEY` in compose, also change `appsettings.Local.json` `JWTKey.Key`. They must match.

### Database restore

- **The live backup references AWS RDS paths** (`D:\rdsdbdata\DATA\...`). SQL Server restore fails without `sed` rewriting them to container paths.
- **`restore-clean.sql` vs `GEOFFERPDB_LIVE_backup.sql`** — the "clean" one has no orders/contacts. If dashboard shows count tiles but tables are empty, you restored the wrong file.
- **`sqlcmd` is at `/opt/mssql-tools18/bin/sqlcmd`** in the 2019-latest image (not `/opt/mssql-tools/bin/`).

### Known non-blocking issues

- **216 webpack deprecation warnings** on frontend startup — React 17-to-18 migration noise. Cosmetic.
- **`/GetStore` returns 500** after login — doesn't block dashboard. Needs store-scoped JWT claim we don't send.
- **`dev.mapy.s10drd.com/`** returns JSON placeholder — by design. Real endpoints are `/api/...`.
