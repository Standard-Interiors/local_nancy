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

### Database dumps (already in NANCY directory)

The user will have already placed the database dump file(s) in the `NANCY/` directory before starting. Do NOT delete or move them. Expect to find:

```
NANCY/
  GEOFFERPDB_LIVE_backup.sql    <-- ~423 MB, placed by user before setup
  restore-clean.sql             <-- ~443 MB, alternate seed (may or may not be present)
  (repos will be cloned here by the steps below)
```

> **If neither SQL file is present**, ask the team lead (Jay / Robert) for `GEOFFERPDB_LIVE_backup.sql` before proceeding. The setup cannot complete without a database dump.

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

There are **two SQL dump files**. Use `restore-clean.sql` — it's the one that works cleanly.

| File | Database name | Contents | Use this? |
|---|---|---|---|
| `restore-clean.sql` (~443 MB) | `GeoffERP` | Full data: 89 tables, 187 users, 321 customers, 21K+ orders | **YES** |
| `GEOFFERPDB_LIVE_backup.sql` (~423 MB) | `GEOFFERPDB_LIVE` | Live backup with AWS RDS paths that need sed rewriting | Only if you need the live DB name |

Both files should already be in `~/NANCY/` (placed there before setup started).

### 7a. Start SQL Server

```bash
cd ~/NANCY/local-dev/docker
docker compose -p local-dev up -d sqlserver
```

> **IMPORTANT:** Always use `-p local-dev` with docker compose. This sets the project name so volumes are named `local-dev_sqldata` etc. Without it, the project name defaults to the directory name (`docker`) and volumes don't match.

### 7b. Wait for healthy

```bash
echo "Waiting for SQL Server..."
for i in $(seq 1 24); do
  STATUS=$(docker inspect --format='{{.State.Health.Status}}' geoff-sqlserver 2>/dev/null)
  echo "  Attempt $i: $STATUS"
  [ "$STATUS" = "healthy" ] && echo "SQL Server is ready!" && break
  sleep 5
done
```

### 7c. Create the database and load data

The `restore-clean.sql` file expects the `GeoffERP` database to already exist (it starts with `USE [GeoffERP]`). Create it first, then seed.

**[MAC + WIN] Using Docker sidecar (recommended — no host sqlcmd needed):**

```bash
cd ~/NANCY

# Get the Docker network name
NETWORK=$(docker network ls --filter "name=local-dev" --format "{{.Name}}" | head -1)

# Step 1: Create the empty GeoffERP database
docker run --rm --network "$NETWORK" \
  mcr.microsoft.com/mssql-tools \
  /opt/mssql-tools/bin/sqlcmd \
  -S geoff-sqlserver -U sa -P 'LocalDev123!' \
  -Q "CREATE DATABASE GeoffERP"

# Step 2: Load the seed data (5-15 minutes for 443 MB)
docker run --rm -i \
  --network "$NETWORK" \
  -v "$(pwd)/restore-clean.sql:/tmp/restore-clean.sql:ro" \
  mcr.microsoft.com/mssql-tools \
  /opt/mssql-tools/bin/sqlcmd \
  -S geoff-sqlserver -U sa -P 'LocalDev123!' \
  -d GeoffERP \
  -i /tmp/restore-clean.sql
```

**[WIN] PowerShell alternative (if sqlcmd is installed on host):**

```powershell
cd ~/NANCY

# Create DB
sqlcmd -S "localhost,1433" -U sa -P "LocalDev123!" -Q "CREATE DATABASE GeoffERP"

# Load seed (5-15 minutes)
sqlcmd -S "localhost,1433" -U sa -P "LocalDev123!" -d GeoffERP -i restore-clean.sql
```

> **Note:** You'll see `SqlState 24000, Invalid cursor state` warnings near the end. These are from stored procedures and are **non-fatal** — the data loaded fine.

### 7d. Verify

```bash
NETWORK=$(docker network ls --filter "name=local-dev" --format "{{.Name}}" | head -1)

docker run --rm --network "$NETWORK" \
  mcr.microsoft.com/mssql-tools \
  /opt/mssql-tools/bin/sqlcmd \
  -S geoff-sqlserver -U sa -P 'LocalDev123!' -d GeoffERP \
  -Q "SELECT 'Tables' AS What, COUNT(*) AS Cnt FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE' UNION ALL SELECT 'Users', COUNT(*) FROM MS_User UNION ALL SELECT 'Customers', COUNT(*) FROM TR_CustomerSignup UNION ALL SELECT 'Orders', COUNT(*) FROM TR_OrderProduct" -W
```

**Expected:**

| What | Cnt |
|---|---|
| Tables | ~89 |
| Users | ~187 |
| Customers | ~321 |
| Orders | ~21,000+ |

If Customers or Orders show 0, the seed didn't finish — re-run Step 7c.

---

## Step 8 — Build and start all containers

```bash
cd ~/NANCY/local-dev/docker
docker compose -p local-dev build      # First time: 5-10 minutes. Subsequent: seconds.
docker compose -p local-dev up -d      # Start all 9 services in background.
```

> **Always use `-p local-dev`** to ensure consistent volume naming. Without it, Docker uses the directory name as project prefix and volumes won't match between commands.

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

---

### Adding the Three Critical Components to Windows

This section adds three services that the Mac setup has but the Windows setup is missing: (1) the real-database auth-proxy replacing the fake 3-user stub, (2) the D365 Business Central mock service, and (3) the minio-init one-shot container that auto-creates the S3 bucket.

**Prerequisites:** You are in the `NANCY\local-dev\` directory. Docker Desktop with WSL2 is running. SQL Server is up with the `GEOFFERPDB_LIVE` database seeded.

---

#### Component 1: Real User DB Auth (auth-proxy)

The current auth-proxy uses a simple `server.js` with three hardcoded fake users. This replaces it with the full implementation that queries the real `MS_User` table, seeds all users with bcrypt-hashed passwords, and generates proper JWTs with AES-encrypted claims.

**Step 1a: Delete the old auth-proxy directory and create the new structure**

```powershell
# Remove old auth-proxy contents
Remove-Item -Recurse -Force .\auth-proxy -ErrorAction SilentlyContinue

# Create directory structure
New-Item -ItemType Directory -Force -Path .\auth-proxy\src\services
New-Item -ItemType Directory -Force -Path .\auth-proxy\src\routes
New-Item -ItemType Directory -Force -Path .\auth-proxy\src\middleware
```

**Step 1b: Create `auth-proxy\Dockerfile`**

```powershell
@'
FROM node:18-slim

WORKDIR /app

COPY package.json ./
RUN npm install --production

COPY src/ ./src/

EXPOSE 3100

HEALTHCHECK --interval=15s --timeout=5s --retries=3 --start-period=30s \
  CMD wget -q --spider http://localhost:3100/health || exit 1

CMD ["node", "src/index.js"]
'@ | Set-Content -Path .\auth-proxy\Dockerfile -Encoding UTF8
```

**Step 1c: Create `auth-proxy\package.json`**

```powershell
@'
{
  "name": "geoff-auth-proxy",
  "version": "1.0.0",
  "description": "Local auth proxy for Geoff ERP — replaces AWS Cognito for local development",
  "main": "src/index.js",
  "scripts": {
    "start": "node src/index.js"
  },
  "dependencies": {
    "bcryptjs": "^2.4.3",
    "express": "^4.18.2",
    "jsonwebtoken": "^9.0.2",
    "mssql": "^10.0.2",
    "uuid": "^9.0.0"
  }
}
'@ | Set-Content -Path .\auth-proxy\package.json -Encoding UTF8
```

**Step 1d: Create `auth-proxy\src\index.js`**

```powershell
@'
const express = require('express');
const { connectWithRetry } = require('./services/db');
const { validateConfig } = require('./services/jwt');
const { runSeed } = require('./services/seedUsers');
const { errorHandler } = require('./middleware/errorHandler');

const PORT = parseInt(process.env.AUTH_PROXY_PORT || '3100');

async function start() {
  console.log('=== Geoff Auth Proxy (Local Dev) ===');

  validateConfig();
  console.log('[STARTUP] JWT config OK');

  await connectWithRetry();

  console.log('[STARTUP] Seeding local auth users...');
  await runSeed();

  const app = express();
  app.use(express.json({ limit: '10mb' }));

  // CORS
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  // Request logging
  app.use((req, res, next) => {
    if (req.path !== '/health') console.log(`[REQ] ${req.method} ${req.path}`);
    next();
  });

  // Routes
  app.use(require('./routes/customerSignIn'));
  app.use(require('./routes/signIn'));
  app.use(require('./routes/crossDomain'));
  app.use(require('./routes/health'));

  app.use(errorHandler);

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[STARTUP] Listening on port ${PORT}`);
    console.log(`[STARTUP] Default password: ${process.env.DEFAULT_PASSWORD || 'LocalDev123!'}`);
  });
}

start().catch(err => { console.error('[FATAL]', err.message); process.exit(1); });
'@ | Set-Content -Path .\auth-proxy\src\index.js -Encoding UTF8
```

**Step 1e: Create `auth-proxy\src\services\db.js`**

```powershell
@'
const sql = require('mssql');

const config = {
  server: process.env.DB_HOST || 'sqlserver',
  port: parseInt(process.env.DB_PORT || '1433'),
  database: process.env.DB_NAME || 'GeoffERP',
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || 'LocalDev123!',
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
  },
  pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
};

let pool = null;

async function getPool() {
  if (pool) return pool;
  pool = await sql.connect(config);
  return pool;
}

async function connectWithRetry(maxRetries = 30, delayMs = 3000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      pool = await sql.connect(config);
      console.log(`[DB] Connected to ${config.server}:${config.port}/${config.database}`);
      return pool;
    } catch (err) {
      console.log(`[DB] Attempt ${attempt}/${maxRetries}: ${err.message}`);
      if (attempt === maxRetries) {
        throw new Error(`AUTH_PROXY FATAL: Cannot connect to SQL Server after ${maxRetries} attempts.`);
      }
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
}

async function query(sqlText, params = {}) {
  const p = await getPool();
  const request = p.request();
  for (const [key, value] of Object.entries(params)) {
    request.input(key, value);
  }
  return request.query(sqlText);
}

module.exports = { connectWithRetry, getPool, query, sql };
'@ | Set-Content -Path .\auth-proxy\src\services\db.js -Encoding UTF8
```

**Step 1f: Create `auth-proxy\src\services\jwt.js`**

```powershell
@'
const jsonwebtoken = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { encrypt } = require('./crypto');

const JWT_KEY = process.env.JWT_KEY || 'GeoffLocalDevKey_MustBe32CharsOrMore!';
const JWT_ISSUER = process.env.JWT_ISSUER || 'https://dev.api.s10drd.com';
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'geoff-local';

function validateConfig() {
  if (!JWT_KEY || JWT_KEY.length < 32) {
    throw new Error('AUTH_PROXY FATAL: JWT_KEY must be >= 32 characters.');
  }
}

function generateToken(userName, storeId, userId) {
  return jsonwebtoken.sign(
    {
      jti: uuidv4(),
      valid: '1',
      store: encrypt(String(storeId)),
      uName: encrypt(String(userName)),
      uId: encrypt(String(userId)),
    },
    JWT_KEY,
    { algorithm: 'HS256', issuer: JWT_ISSUER, audience: JWT_AUDIENCE, expiresIn: 3600 }
  );
}

module.exports = { generateToken, validateConfig };
'@ | Set-Content -Path .\auth-proxy\src\services\jwt.js -Encoding UTF8
```

**Step 1g: Create `auth-proxy\src\services\crypto.js`**

```powershell
@'
const crypto = require('crypto');

const AES_KEY = process.env.AES_KEY || '1234567890123456';
const AES_IV = process.env.AES_IV || '1234567890123456';

function decrypt(base64Ciphertext) {
  const key = Buffer.from(AES_KEY, 'utf8');
  const iv = Buffer.from(AES_IV, 'utf8');
  const ciphertext = Buffer.from(base64Ciphertext, 'base64');
  const decipher = crypto.createDecipheriv('aes-128-cbc', key, iv);
  decipher.setAutoPadding(true);
  let decrypted = decipher.update(ciphertext, undefined, 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

function encrypt(plaintext) {
  const key = Buffer.from(AES_KEY, 'utf8');
  const iv = Buffer.from(AES_IV, 'utf8');
  const cipher = crypto.createCipheriv('aes-128-cbc', key, iv);
  cipher.setAutoPadding(true);
  let encrypted = cipher.update(plaintext, 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return encrypted.toString('base64');
}

module.exports = { encrypt, decrypt };
'@ | Set-Content -Path .\auth-proxy\src\services\crypto.js -Encoding UTF8
```

**Step 1h: Create `auth-proxy\src\services\seedUsers.js`**

```powershell
@'
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { query } = require('./db');

const DEFAULT_PASSWORD = process.env.DEFAULT_PASSWORD || 'LocalDev123!';

async function ensureTable() {
  const check = await query(`SELECT OBJECT_ID('MS_User', 'U') AS tbl_id`);
  if (check.recordset[0].tbl_id === null) {
    console.log('[SEED] MS_User table not found — DB snapshot not yet restored. Skipping.');
    return false;
  }

  await query(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'local_auth_users')
    BEGIN
      CREATE TABLE local_auth_users (
        UserId        INT PRIMARY KEY,
        password_hash NVARCHAR(200) NOT NULL,
        hash_key      NVARCHAR(200) NULL,
        created_at    DATETIME2 DEFAULT GETDATE(),
        CONSTRAINT FK_local_auth_MS_User FOREIGN KEY (UserId) REFERENCES MS_User(UserId)
      );
    END
  `);
  return true;
}

function generateHashKey(userId, email) {
  return crypto.createHash('sha256')
    .update(`local-hash-${userId}-${email}`)
    .digest('hex').substring(0, 64);
}

async function seedMissingUsers() {
  const result = await query(`
    SELECT u.UserId, u.Email
    FROM MS_User u
    LEFT JOIN local_auth_users la ON u.UserId = la.UserId
    WHERE la.UserId IS NULL AND u.IsDeleted = 0 AND u.Email IS NOT NULL AND u.Email != ''
  `);

  if (result.recordset.length === 0) {
    console.log('[SEED] All users already seeded.');
    return 0;
  }

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  let seeded = 0;
  for (const user of result.recordset) {
    try {
      await query(
        `INSERT INTO local_auth_users (UserId, password_hash, hash_key) VALUES (@userId, @passwordHash, @hashKey)`,
        { userId: user.UserId, passwordHash, hashKey: generateHashKey(user.UserId, user.Email) }
      );
      seeded++;
    } catch (err) {
      // skip duplicates
    }
  }
  console.log(`[SEED] Seeded ${seeded} users with password "${DEFAULT_PASSWORD}"`);
  return seeded;
}

async function runSeed() {
  try {
    const ready = await ensureTable();
    if (ready) await seedMissingUsers();
  } catch (err) {
    console.log(`[SEED] WARNING: ${err.message}`);
    console.log('[SEED] Auth proxy will start anyway — restore DB and restart to seed.');
  }
}

module.exports = { runSeed };
'@ | Set-Content -Path .\auth-proxy\src\services\seedUsers.js -Encoding UTF8
```

**Step 1i: Create `auth-proxy\src\services\userLookup.js`**

```powershell
@'
const { query } = require('./db');

// Real schema: MS_User has Email (not EmailId), no StoreId, no IsActive
async function findUserByEmail(email) {
  const result = await query(
    `SELECT u.UserId, u.UserName, u.Email, u.RoleId, u.IsDeleted, u.IsAdminAccess,
            la.password_hash, la.hash_key
     FROM MS_User u
     LEFT JOIN local_auth_users la ON u.UserId = la.UserId
     WHERE u.Email = @email`,
    { email }
  );
  return result.recordset[0] || null;
}

async function findUserByHashKey(hashKey) {
  const result = await query(
    `SELECT u.UserId, u.UserName, u.Email, u.RoleId, u.IsDeleted, u.IsAdminAccess,
            la.password_hash, la.hash_key
     FROM MS_User u
     INNER JOIN local_auth_users la ON u.UserId = la.UserId
     WHERE la.hash_key = @hashKey`,
    { hashKey }
  );
  return result.recordset[0] || null;
}

async function findUserById(userId) {
  const result = await query(
    `SELECT u.UserId, u.UserName, u.Email, u.RoleId, u.IsDeleted, u.IsAdminAccess,
            la.password_hash, la.hash_key
     FROM MS_User u
     LEFT JOIN local_auth_users la ON u.UserId = la.UserId
     WHERE u.UserId = @userId`,
    { userId }
  );
  return result.recordset[0] || null;
}

module.exports = { findUserByEmail, findUserByHashKey, findUserById };
'@ | Set-Content -Path .\auth-proxy\src\services\userLookup.js -Encoding UTF8
```

**Step 1j: Create `auth-proxy\src\routes\signIn.js`**

```powershell
@'
const express = require('express');
const bcrypt = require('bcryptjs');
const { findUserByEmail } = require('../services/userLookup');
const { generateToken } = require('../services/jwt');
const { decrypt } = require('../services/crypto');
const { authError } = require('../middleware/errorHandler');
const router = express.Router();

// POST /Authentication/api/Login/SignIn  AND  POST /api/Auth/SignIn
// Used by: Geoff-ERP React app (AES-encrypted credentials)
async function handleSignIn(req, res, next) {
  try {
    let emailId, password;
    // Try AES-decrypt first (production flow). If that fails, assume plaintext (Geoff-ERP React app).
    try {
      emailId = decrypt(req.body.EmailId);
      password = decrypt(req.body.Password);
    } catch (e) {
      emailId = req.body.EmailId;
      password = req.body.Password;
      if (!emailId || !password) {
        throw authError(400, `Missing EmailId or Password. Error: ${e.message}`);
      }
      console.log(`[AUTH] SignIn using plaintext payload`);
    }

    console.log(`[AUTH] SignIn: ${emailId}`);
    const user = await findUserByEmail(emailId);

    if (!user) throw authError(401, `No user with email '${emailId}'.`);
    if (user.IsDeleted) throw authError(401, `User '${emailId}' is deleted.`);
    if (!user.password_hash) throw authError(401, `User '${emailId}' has no local password. Restart auth-proxy.`);

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) throw authError(401, `Invalid password for '${emailId}'. Default: LocalDev123!`);

    const token = generateToken(user.UserName || user.Email, 1, user.UserId);
    console.log(`[AUTH] SignIn OK: ${emailId}`);

    res.json({
      message: 'Success',
      result: [{
        token,
        userId: user.UserId,
        roleid: user.RoleId || 1,
        isAdminAccess: user.IsAdminAccess || false,
        hashKey: user.hash_key || '',
        userName: user.UserName || '',
        emailId: user.Email,
        uniqueChannelName: `local-channel-${user.UserId}`,
      }],
      error: null,
    });
  } catch (err) { next(err); }
}

router.post('/Authentication/api/Login/SignIn', handleSignIn);
router.post('/authentication/api/login/SignIn', handleSignIn);
router.post('/authentication/api/login/signin', handleSignIn);
router.post('/api/Auth/SignIn', handleSignIn);
router.post('/api/Auth/signin', handleSignIn);

module.exports = router;
'@ | Set-Content -Path .\auth-proxy\src\routes\signIn.js -Encoding UTF8
```

**Step 1k: Create `auth-proxy\src\routes\customerSignIn.js`**

```powershell
@'
const express = require('express');
const bcrypt = require('bcryptjs');
const { findUserByEmail } = require('../services/userLookup');
const { generateToken } = require('../services/jwt');
const { authError } = require('../middleware/errorHandler');
const router = express.Router();

// POST /authentication/api/login/CustomerSignIn
// Used by: ordering-system (plaintext credentials)
router.post('/authentication/api/login/CustomerSignIn', async (req, res, next) => {
  try {
    const { EmailId, Password } = req.body;
    if (!EmailId || !Password) throw authError(400, 'EmailId and Password are required.');

    console.log(`[AUTH] CustomerSignIn: ${EmailId}`);
    const user = await findUserByEmail(EmailId);

    if (!user) throw authError(401, `No user with email '${EmailId}'. Was the DB restored?`);
    if (user.IsDeleted) throw authError(401, `User '${EmailId}' is deleted.`);
    if (!user.password_hash) throw authError(401, `User '${EmailId}' has no local password. Restart auth-proxy to seed.`);

    const valid = await bcrypt.compare(Password, user.password_hash);
    if (!valid) throw authError(401, `Invalid password for '${EmailId}'. Default: LocalDev123!`);

    const token = generateToken(user.UserName || user.Email, 1, user.UserId);
    console.log(`[AUTH] CustomerSignIn OK: ${EmailId} (userId=${user.UserId})`);

    res.json({
      message: 'Success',
      result: [{
        token,
        userId: user.UserId,
        roleid: user.RoleId || 1,
        isAdminAccess: user.IsAdminAccess || false,
        hashKey: user.hash_key || '',
        userName: user.UserName || '',
        emailId: user.Email,
        uniqueChannelName: `local-channel-${user.UserId}`,
      }],
      error: null,
    });
  } catch (err) { next(err); }
});

module.exports = router;
'@ | Set-Content -Path .\auth-proxy\src\routes\customerSignIn.js -Encoding UTF8
```

**Step 1l: Create `auth-proxy\src\routes\crossDomain.js`**

```powershell
@'
const express = require('express');
const { findUserByHashKey, findUserById } = require('../services/userLookup');
const { generateToken } = require('../services/jwt');
const { authError } = require('../middleware/errorHandler');
const router = express.Router();

// POST /authentication/api/login/CrossDomainAuthentication?LoginLink=<hash>
// Used by: seaming-frontend and ordering-system
router.post('/authentication/api/login/CrossDomainAuthentication', async (req, res, next) => {
  try {
    const loginLink = req.query.LoginLink || req.query.loginlink || '';
    if (!loginLink) throw authError(400, 'LoginLink query parameter is required.');

    console.log(`[AUTH] CrossDomain: hash=${loginLink.substring(0, 16)}...`);

    let user = await findUserByHashKey(loginLink);
    if (!user && /^\d+$/.test(loginLink)) user = await findUserById(parseInt(loginLink));
    if (!user) throw authError(401, `No user found for LoginLink '${loginLink.substring(0, 20)}...'.`);
    if (user.IsDeleted) throw authError(401, `User '${user.Email}' is deleted.`);

    const token = generateToken(user.UserName || user.Email, 1, user.UserId);
    console.log(`[AUTH] CrossDomain OK: ${user.Email} (userId=${user.UserId})`);

    res.json({ message: 'Success', result: [{ token, userId: user.UserId }], error: null });
  } catch (err) { next(err); }
});

module.exports = router;
'@ | Set-Content -Path .\auth-proxy\src\routes\crossDomain.js -Encoding UTF8
```

**Step 1m: Create `auth-proxy\src\routes\health.js`**

```powershell
@'
const express = require('express');
const { getPool } = require('../services/db');
const router = express.Router();

router.get('/health', async (req, res) => {
  try {
    const pool = await getPool();
    await pool.request().query('SELECT 1');
    res.json({ status: 'ok', db: 'connected' });
  } catch (err) {
    res.status(503).json({ status: 'error', db: err.message });
  }
});

module.exports = router;
'@ | Set-Content -Path .\auth-proxy\src\routes\health.js -Encoding UTF8
```

**Step 1n: Create `auth-proxy\src\middleware\errorHandler.js`**

```powershell
@'
function errorHandler(err, req, res, next) {
  console.error(`[ERROR] ${req.method} ${req.path}: ${err.message}`);
  res.status(err.statusCode || 500).json({
    message: 'Failed',
    result: null,
    error: err.message,
  });
}

function authError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

module.exports = { errorHandler, authError };
'@ | Set-Content -Path .\auth-proxy\src\middleware\errorHandler.js -Encoding UTF8
```

**Step 1o: Update the `.env` file -- change `DB_NAME` to match your Windows database**

The `.env` ships with `DB_NAME=GeoffERP` but your Windows SQL Server uses `GEOFFERPDB_LIVE`. Fix it:

```powershell
(Get-Content .\.env) -replace '^DB_NAME=.*$', 'DB_NAME=GEOFFERPDB_LIVE' | Set-Content .\.env -Encoding UTF8
```

Verify:

```powershell
Select-String -Path .\.env -Pattern 'DB_NAME'
```

You should see `DB_NAME=GEOFFERPDB_LIVE`.

**Step 1p: Also update the connection string in `appsettings.Local.json`**

The API's connection string must point to the same database. Open `appsettings.Local.json` and change the `geoffConn` database from `GeoffERP` to `GEOFFERPDB_LIVE`:

```powershell
(Get-Content .\appsettings.Local.json) -replace 'Database=GeoffERP', 'Database=GEOFFERPDB_LIVE' | Set-Content .\appsettings.Local.json -Encoding UTF8
```

**Step 1q: Update the `auth-proxy` service in `docker-compose.yml`**

Replace the existing `auth-proxy` service block. The key changes: `env_file: .env` instead of inline environment vars, and `depends_on: sqlserver` with `condition: service_healthy` instead of `depends_on: api`.

Find your existing `auth-proxy:` block in `docker-compose.yml` and replace it entirely with:

```yaml
  auth-proxy:
    build:
      context: ./auth-proxy
    container_name: geoff-auth-proxy
    ports:
      - "3100:3100"
    env_file:
      - .env
    depends_on:
      sqlserver:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3100/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"]
      interval: 15s
      timeout: 5s
      retries: 3
      start_period: 30s
```

**Step 1r: Rebuild and verify auth-proxy**

```powershell
docker compose build auth-proxy
docker compose up -d auth-proxy
# Wait for it to become healthy
Start-Sleep -Seconds 15
docker compose ps auth-proxy
# Test the health endpoint
docker exec geoff-auth-proxy wget -qO- http://localhost:3100/health
```

Expected output from health: `{"status":"ok","db":"connected"}`

Test a login (replace with a real email from your `MS_User` table, or use any email that exists):

```powershell
Invoke-RestMethod -Uri "http://localhost:3100/api/Auth/SignIn" -Method POST -ContentType "application/json" -Body '{"EmailId":"admin@test.com","Password":"LocalDev123!"}'
```

A successful response will have `"message":"Success"` with a token in `result[0].token`.

---

#### Component 2: D365 Business Central Mock

This is a medium-fidelity mock of Microsoft Dynamics 365 Business Central. It provides in-memory endpoints for items, customers, sales orders, salespersons, commissions, price lists, batch operations, and OAuth token issuance. Without it, any code path in NANCY that syncs to D365BC will fail.

**Step 2a: Create the directory structure**

```powershell
New-Item -ItemType Directory -Force -Path .\d365bc-mock\src\middleware
New-Item -ItemType Directory -Force -Path .\d365bc-mock\src\routes
```

**Step 2b: Create `d365bc-mock\Dockerfile`**

```powershell
@'
FROM node:18-slim

WORKDIR /app

COPY package.json ./
RUN npm install --production --no-audit --no-fund

COPY src ./src

EXPOSE 3200

HEALTHCHECK --interval=10s --timeout=5s --retries=5 \
  CMD wget -qO- http://localhost:3200/health || exit 1

CMD ["node", "src/index.js"]
'@ | Set-Content -Path .\d365bc-mock\Dockerfile -Encoding UTF8
```

**Step 2c: Create `d365bc-mock\package.json`**

```powershell
@'
{
  "name": "d365bc-mock",
  "version": "1.0.0",
  "description": "Medium-fidelity mock of Microsoft Dynamics 365 Business Central for local development",
  "main": "src/index.js",
  "scripts": {
    "start": "node src/index.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "uuid": "^9.0.0"
  }
}
'@ | Set-Content -Path .\d365bc-mock\package.json -Encoding UTF8
```

**Step 2d: Create `d365bc-mock\src\index.js`**

```powershell
@'
const express = require('express');
const { stats } = require('./store');
const { acceptBearer } = require('./middleware/auth');
const { requestLogger } = require('./middleware/logger');

const PORT = parseInt(process.env.PORT || '3200');

const app = express();

// JSON body for normal requests
app.use(express.json({ limit: '50mb' }));
// URL-encoded for OAuth token requests
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
// Raw binary body for picture uploads (only when content-type is image/*)
app.use((req, res, next) => {
  const ct = req.headers['content-type'] || '';
  if (ct.startsWith('image/') || ct === 'application/octet-stream') {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => { req.body = Buffer.concat(chunks); next(); });
    req.on('error', next);
    return;
  }
  next();
});

app.use(requestLogger);

// Health check (no auth required)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'd365bc-mock', stats: stats() });
});

// Admin stats (for developers — visible state of the mock)
app.get('/_admin/stats', (req, res) => {
  res.json(stats());
});

// Token endpoint (no auth required — this IS the auth)
app.use(require('./routes/token'));

// All other BC endpoints — accept any Bearer token
app.use(acceptBearer);
app.use(require('./routes/items'));
app.use(require('./routes/customers'));
app.use(require('./routes/sales'));
app.use(require('./routes/salespersons'));
app.use(require('./routes/commissions'));
app.use(require('./routes/pricelist'));
app.use(require('./routes/batch'));
app.use(require('./routes/bcCallback'));

// Fallback — log and 404
app.use((req, res) => {
  console.log(`[404] ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    error: {
      code: 'ResourceNotFound',
      message: `Mock does not handle: ${req.method} ${req.originalUrl}`,
    },
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('[ERROR]', err);
  res.status(500).json({ error: { code: 'InternalError', message: err.message } });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('=== D365BC Mock Service ===');
  console.log(`Listening on port ${PORT}`);
  console.log(`Health: http://localhost:${PORT}/health`);
  console.log(`Stats:  http://localhost:${PORT}/_admin/stats`);
});
'@ | Set-Content -Path .\d365bc-mock\src\index.js -Encoding UTF8
```

**Step 2e: Create `d365bc-mock\src\store.js`**

```powershell
@'
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

function logRequest(method, path, status, body) {
  store.requestLog.unshift({
    at: new Date().toISOString(),
    method,
    path,
    status,
    bodyPreview: body ? JSON.stringify(body).substring(0, 200) : null,
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

function releaseSalesOrder(jobNo) {
  const order = store.salesOrders.get(jobNo);
  if (!order) return null;
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
  return {
    items: store.items.size,
    customers: store.customers.size,
    salesOrders: store.salesOrders.size,
    ordersReleased: [...store.salesOrders.values()].filter(o => o._status === 'released').length,
    salespersons: store.salespersons.size,
    commissions: store.commissions.length,
    tokens: store.tokens.size,
    recentRequests: store.requestLog.slice(0, 20),
  };
}

module.exports = {
  store,
  logRequest,
  putItem, getItem, queryItems, getItemByBcId, updateItemPicture,
  putCustomer, getCustomer,
  putSalesOrder, releaseSalesOrder, deleteSalesOrder, getSalesOrder,
  putSalesperson, getSalesperson,
  addCommission,
  issueToken,
  stats,
};
'@ | Set-Content -Path .\d365bc-mock\src\store.js -Encoding UTF8
```

**Step 2f: Create `d365bc-mock\src\middleware\auth.js`**

```powershell
@'
// Mock auth — accept any Bearer token. Log missing tokens as warnings.
function acceptBearer(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    console.warn(`[AUTH] ${req.method} ${req.path} — no Bearer token (accepting anyway for mock)`);
    req.bcToken = null;
  } else {
    req.bcToken = match[1];
  }
  next();
}

module.exports = { acceptBearer };
'@ | Set-Content -Path .\d365bc-mock\src\middleware\auth.js -Encoding UTF8
```

**Step 2g: Create `d365bc-mock\src\middleware\logger.js`**

```powershell
@'
const { logRequest } = require('../store');

function requestLogger(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    console.log(`[REQ] ${req.method} ${req.path} → ${res.statusCode} (${ms}ms)`);
    if (req.method !== 'GET' && req.path !== '/health') {
      logRequest(req.method, req.path, res.statusCode, req.body);
    }
  });
  next();
}

module.exports = { requestLogger };
'@ | Set-Content -Path .\d365bc-mock\src\middleware\logger.js -Encoding UTF8
```

**Step 2h: Create `d365bc-mock\src\routes\token.js`**

```powershell
@'
const express = require('express');
const { issueToken } = require('../store');
const router = express.Router();

// Microsoft OAuth2 token endpoint
// Real: https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token
// Mock: http://d365bc-mock:3200/:tenant/oauth2/v2.0/token (we accept both path shapes)
function handleToken(req, res) {
  const clientId = req.body.client_id || req.query.client_id;
  const token = issueToken(clientId);
  res.json({
    token_type: 'Bearer',
    expires_in: 3600,
    ext_expires_in: 3600,
    access_token: token,
  });
}

router.post('/:tenant/oauth2/v2.0/token', handleToken);
router.post('/oauth2/v2.0/:tenant/token', handleToken);
router.post('/common/oauth2/v2.0/token', handleToken);

module.exports = router;
'@ | Set-Content -Path .\d365bc-mock\src\routes\token.js -Encoding UTF8
```

**Step 2i: Create `d365bc-mock\src\routes\items.js`**

```powershell
@'
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
'@ | Set-Content -Path .\d365bc-mock\src\routes\items.js -Encoding UTF8
```

**Step 2j: Create `d365bc-mock\src\routes\customers.js`**

```powershell
@'
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
'@ | Set-Content -Path .\d365bc-mock\src\routes\customers.js -Encoding UTF8
```

**Step 2k: Create `d365bc-mock\src\routes\sales.js`**

```powershell
@'
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
'@ | Set-Content -Path .\d365bc-mock\src\routes\sales.js -Encoding UTF8
```

**Step 2l: Create `d365bc-mock\src\routes\salespersons.js`**

```powershell
@'
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
'@ | Set-Content -Path .\d365bc-mock\src\routes\salespersons.js -Encoding UTF8
```

**Step 2m: Create `d365bc-mock\src\routes\commissions.js`**

```powershell
@'
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
'@ | Set-Content -Path .\d365bc-mock\src\routes\commissions.js -Encoding UTF8
```

**Step 2n: Create `d365bc-mock\src\routes\pricelist.js`**

```powershell
@'
const express = require('express');
const router = express.Router();

// POST .../itemPrices('BCItemNo')/Microsoft.NAV.addPricePurchase
router.post(
  /^\/v2\.0\/[^/]+\/[^/]+\/api\/abcGroup\/nancy\/v1\.0\/companies\([^)]+\)\/itemPrices\(([^)]+)\)\/(.+)$/,
  (req, res) => {
    const bcItemNo = (req.params[0] || '').replace(/'/g, '');
    const action = req.params[1] || '';
    if (action !== 'Microsoft.NAV.addPricePurchase') {
      return res.status(400).json({ error: { code: 'BadAction', message: `Unknown action ${action}` } });
    }
    res.status(200).json({
      value: `Purchase price added for ${bcItemNo}`,
      bcItemNo,
      payload: req.body,
    });
  }
);

module.exports = router;
'@ | Set-Content -Path .\d365bc-mock\src\routes\pricelist.js -Encoding UTF8
```

**Step 2o: Create `d365bc-mock\src\routes\batch.js`**

```powershell
@'
const express = require('express');
const { releaseSalesOrder, deleteSalesOrder, putSalesOrder } = require('../store');
const router = express.Router();

// OData $batch endpoint
const BATCH_REGEX = /^\/v2\.0\/[^/]+\/[^/]+\/api\/standardInteriors\/nancyERP\/v1\.0\/\$batch$/;

function processRequest(subReq) {
  const { method, url, body } = subReq;

  // Sales order actions: sales('Order','1001')/Microsoft.NAV.Release
  const salesMatch = url.match(/^sales\('([^']+)','([^']+)'\)\/(.+)$/i);
  if (salesMatch) {
    const [, type, jobNo, action] = salesMatch;
    if (action === 'Microsoft.NAV.Release') {
      const order = releaseSalesOrder(jobNo);
      if (!order) return { status: 404, body: { error: { code: 'NotFound', message: `Order ${jobNo} not found` } } };
      return { status: 200, body: { value: 'released successfully', jobNo } };
    }
    if (action === 'Microsoft.NAV.Delete') {
      const existed = deleteSalesOrder(jobNo);
      if (!existed) return { status: 404, body: { error: { code: 'NotFound', message: `Order ${jobNo} not found` } } };
      return { status: 200, body: { value: 'deleted successfully', jobNo } };
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
'@ | Set-Content -Path .\d365bc-mock\src\routes\batch.js -Encoding UTF8
```

**Step 2p: Create `d365bc-mock\src\routes\bcCallback.js`**

```powershell
@'
// Simulates callbacks that BC would make back to Geoff (reverse direction).
// Exposed as endpoints the mock offers, so developers can manually trigger
// a BC -> Geoff item sync event to test the inbound path.
const express = require('express');
const router = express.Router();

// Manual trigger: POST to our mock which forwards to Geoff API's /api/bcsync/callback
router.post('/_mock/trigger-item-sync', async (req, res) => {
  const geoffApiUrl = process.env.GEOFF_API_URL || 'http://api:5000';
  const { operation = 'Update', item } = req.body;

  try {
    const bcauthResp = await fetch(`${geoffApiUrl}/api/bcauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': process.env.BC365_API_ORIGIN || 'https://localhost',
        'x-api-key': process.env.BC365_API_KEY || 'local',
      },
      body: JSON.stringify({ clientId: process.env.BC365_CLIENT_ID || 'local' }),
    });
    const tokenData = await bcauthResp.json();
    const token = tokenData.token;

    if (!token) {
      return res.status(500).json({ error: 'Failed to get token from Geoff API', response: tokenData });
    }

    const syncResp = await fetch(`${geoffApiUrl}/api/bcsync/callback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ operation, item }),
    });
    const syncData = await syncResp.json().catch(() => ({ raw: 'non-json response' }));
    res.json({ triggered: true, status: syncResp.status, response: syncData });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
'@ | Set-Content -Path .\d365bc-mock\src\routes\bcCallback.js -Encoding UTF8
```

**Step 2q: Add the `d365bc-mock` service to `docker-compose.yml`**

Add this service block to your `docker-compose.yml`, after the `auth-proxy` service and before the `api` service:

```yaml
  d365bc-mock:
    build:
      context: ./d365bc-mock
    container_name: geoff-d365bc-mock
    ports:
      - "3200:3200"
    environment:
      PORT: "3200"
      GEOFF_API_URL: "http://api:5000"
      BC365_API_ORIGIN: "http://d365bc-mock:3200"
      BC365_API_KEY: "local"
      BC365_CLIENT_ID: "local"
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3200/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"]
      interval: 15s
      timeout: 5s
      retries: 3
      start_period: 10s
```

**Step 2r: Verify `appsettings.Local.json` has D365BC pointing to the mock**

Your `appsettings.Local.json` must have these two values inside the `D365BC` block:

```json
"loginEndPoint": "http://d365bc-mock:3200",
"baseUrl": "http://d365bc-mock:3200"
```

Check with:

```powershell
Select-String -Path .\appsettings.Local.json -Pattern 'd365bc-mock'
```

You should see both `loginEndPoint` and `baseUrl` pointing to `http://d365bc-mock:3200`. If they point elsewhere (e.g., a real Azure URL), update them manually in the JSON file.

**Step 2s: Build and verify d365bc-mock**

```powershell
docker compose build d365bc-mock
docker compose up -d d365bc-mock
Start-Sleep -Seconds 10
docker compose ps d365bc-mock
# Test health
Invoke-RestMethod -Uri "http://localhost:3200/health"
```

Expected: `{"status":"ok","service":"d365bc-mock","stats":{...}}`

---

#### Component 3: minio-init (S3 Bucket Auto-Creation)

This is a one-shot container that runs after MinIO starts, creates the default S3 bucket, and sets it to allow anonymous downloads. Without it, you have to manually create the bucket through the MinIO console every time volumes are wiped.

**Step 3a: Determine your bucket name**

Check what bucket name your `appsettings.Local.json` uses:

```powershell
Select-String -Path .\appsettings.Local.json -Pattern 'BucketName'
```

The Mac setup uses `geoff-pdfs`. If your Windows config shows `geoff-files`, use that instead. The commands below use the `.env` variable `AWS_BUCKET_NAME_S3` which defaults to `geoff-pdfs`. If your Windows `.env` already has the right value, no change is needed. If your Windows bucket name is different, update it:

```powershell
# Only run this if your bucket name is different from geoff-pdfs:
(Get-Content .\.env) -replace '^AWS_BUCKET_NAME_S3=.*$', 'AWS_BUCKET_NAME_S3=geoff-files' | Set-Content .\.env -Encoding UTF8
```

Also make sure the BucketUrl in `appsettings.Local.json` matches. If the bucket name in .env is `geoff-files`, then `BucketUrl` should be `http://minio:9000/geoff-files/` and `BucketName` should be `geoff-files`.

**Step 3b: Add the `minio-init` service to `docker-compose.yml`**

Add this directly after the `minio` service block:

```yaml
  # Create default bucket on startup
  minio-init:
    image: minio/mc
    container_name: geoff-minio-init
    depends_on:
      minio:
        condition: service_healthy
    entrypoint: >
      /bin/sh -c "
      mc alias set local http://minio:9000 ${MINIO_ROOT_USER:-minioadmin} ${MINIO_ROOT_PASSWORD:-minioadmin};
      mc mb --ignore-existing local/${AWS_BUCKET_NAME_S3:-geoff-pdfs};
      mc anonymous set download local/${AWS_BUCKET_NAME_S3:-geoff-pdfs};
      echo 'MinIO bucket ready';
      "
```

Note: The `${MINIO_ROOT_USER:-minioadmin}` and `${AWS_BUCKET_NAME_S3:-geoff-pdfs}` syntax pulls from your `.env` file. Docker Compose expands these automatically.

**Step 3c: Verify minio-init**

```powershell
docker compose up -d minio
# Wait for minio to be healthy
Start-Sleep -Seconds 10
docker compose up minio-init
```

Expected output ending with: `MinIO bucket ready`

Verify the bucket exists:

```powershell
docker exec geoff-minio-init mc ls local/
```

You should see your bucket name listed (e.g., `geoff-pdfs/` or `geoff-files/`).

---

#### Final: Bring Everything Up Together

After all three components are in place:

```powershell
docker compose down
docker compose build
docker compose up -d
```

Wait about 30 seconds for SQL Server to become healthy and auth-proxy to seed, then verify all three new services:

```powershell
# Check all containers are healthy/running
docker compose ps

# Auth proxy: health + DB connection
Invoke-RestMethod -Uri "http://localhost:3100/health"

# D365BC mock: health
Invoke-RestMethod -Uri "http://localhost:3200/health"

# MinIO bucket: check it was created (minio-init will have exited 0)
docker compose logs minio-init
```

All three should report healthy. The auth-proxy logs (`docker compose logs auth-proxy`) should show `[SEED] Seeded N users` confirming it found and hashed all users from `MS_User`.
