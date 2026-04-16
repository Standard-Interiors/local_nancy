# NANCY Local Dev Setup Guide (Mac + Windows)

## What this gets you

A fully local NANCY ERP environment — no AWS, no cloud dependencies. Everything runs in Docker on your machine. You'll be able to:

- Log into the admin dashboard at `https://dev.s10drd.com`
- Place orders, view customers, manage pricing contracts
- All backed by a local SQL Server with real seeded data
- Auth handled locally (no Cognito), D365 BC mocked locally

---

## Prerequisites

Install these BEFORE starting. All are free.

### Both platforms

| Tool | Mac Install | Windows Install | Why needed |
|---|---|---|---|
| **Docker Desktop** | [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/) | Same link | Runs all the containers |
| **Git** | `brew install git` | [git-scm.com](https://git-scm.com/) | Clone repos |
| **mkcert** | `brew install mkcert` | `choco install mkcert` or [GitHub releases](https://github.com/FiloSottile/mkcert/releases) | Generate trusted local TLS certificates |
| **Node.js 18+** | `brew install node@18` | [nodejs.org](https://nodejs.org/) | Run the React frontend on your machine |

### Windows only

| Tool | Install | Why needed |
|---|---|---|
| **Chocolatey** (optional) | [chocolatey.org/install](https://chocolatey.org/install) | Makes installing mkcert easier |
| **PowerShell 5.1+** | Built into Windows | Scripts are `.ps1` |

### Mac only

| Tool | Install | Why needed |
|---|---|---|
| **Homebrew** | [brew.sh](https://brew.sh/) | Package manager for Mac |
| **Rosetta 2** (Apple Silicon only) | `softwareupdate --install-rosetta` | Some containers are x86-only |

### Verify Docker is working

```bash
docker --version         # Should show 20.10+ or newer
docker compose version   # Should show v2.x (note: no hyphen)
```

If `docker compose` doesn't work but `docker-compose` does, you need a newer Docker Desktop.

---

## Step 1 — Clone all the repos

Create a working directory and clone everything into it. All repos must be siblings in the same parent folder.

```bash
mkdir ~/NANCY && cd ~/NANCY

git clone https://github.com/Standard-Interiors/GeoffERP-API.git
git clone https://github.com/Standard-Interiors/Geoff-ERP.git
git clone https://github.com/Standard-Interiors/floorplan-backend.git
git clone https://github.com/Standard-Interiors/seaming-frontend.git
git clone https://github.com/Standard-Interiors/ordering-system.git
git clone https://github.com/Standard-Interiors/local_nancy.git
```

### Switch to the local dev branch

Each repo has a `local_dev_env` branch with the patches needed for local development:

```bash
cd ~/NANCY/GeoffERP-API     && git checkout local_dev_env
cd ~/NANCY/Geoff-ERP        && git checkout local_dev_env
cd ~/NANCY/floorplan-backend && git checkout local_dev_env
cd ~/NANCY/seaming-frontend  && git checkout local_dev_env
cd ~/NANCY/ordering-system   && git checkout local_dev_env
```

### Get the local-dev infrastructure

The `local-dev/` directory contains Docker configs, mock services, and seed data. It lives alongside the repos:

```
~/NANCY/
  GeoffERP-API/          <-- .NET API
  Geoff-ERP/             <-- React frontend
  floorplan-backend/     <-- Python floorplan service
  seaming-frontend/      <-- Seaming SVG editor
  ordering-system/       <-- Customer ordering portal
  local-dev/             <-- Docker Compose, mocks, configs (THIS IS THE KEY DIRECTORY)
  local_nancy/           <-- This documentation repo
```

> **Important:** The `local-dev/` directory is NOT in a git repo. It must be shared separately (USB, zip, or internal file share). Ask the team lead for it. It contains a 443 MB database seed file that is too large for GitHub.

---

## Step 2 — Apply the API patches

Two files in `GeoffERP-API` need modifications to work locally. These are env-gated and will NOT affect production.

### Patch 1: Startup.cs (JWT auth)

**File:** `GeoffERP-API/GEOFF.API/Startup.cs`

**What to change:** The JWT authentication section needs an `if (environment == "Local")` branch that uses a symmetric signing key instead of AWS Cognito.

The `local_dev_env` branch should already have this change. Verify by checking for `"Local"` in Startup.cs:

```bash
cd ~/NANCY/GeoffERP-API
grep -n "Local" GEOFF.API/Startup.cs
```

You should see lines referencing `if (environment == "Local")`. If NOT present, the change hasn't been applied — ask the team lead.

**Why:** Without this, the API tries to call AWS Cognito on every request and fails.

### Patch 2: appsettings.json (placeholder fix)

**File:** `GeoffERP-API/GEOFF.API/appsettings.json`

**What to change:** Find the line with `PLACEHOLDER_CUSTOMER_PARENT_ID` and change it to `0`:

```json
"CustomerParentId": 0
```

**Why:** The placeholder is invalid JSON. The API can't parse the config file at startup without this fix. The real value is overridden by `appsettings.Local.json` (which sets it to `42`), so `0` is just a safe default that makes the file parseable.

---

## Step 3 — Generate TLS certificates

The local environment uses HTTPS with trusted self-signed certificates via mkcert. Each developer must generate their own.

### Install mkcert's root CA (one-time)

```bash
mkcert -install
```

This adds mkcert's root certificate to your system trust store. Chrome and other browsers will trust certificates signed by it.

### Generate the certificate

```bash
cd ~/NANCY/local-dev/certs

mkcert \
  dev.s10drd.com \
  dev.api.s10drd.com \
  dev.seaming.s10drd.com \
  dev.mapy.s10drd.com \
  order.s10drd.com
```

Rename the output files:

```bash
mv dev.s10drd.com+4.pem cert.pem
mv dev.s10drd.com+4-key.pem key.pem
```

**Windows note:** If using PowerShell, the commands are the same. Make sure you're in the `certs/` directory.

After this, `local-dev/certs/` should contain:
- `cert.pem` — the certificate
- `key.pem` — the private key

---

## Step 4 — Configure /etc/hosts

The local environment uses real-looking hostnames that must resolve to your machine.

### Mac

```bash
sudo nano /etc/hosts
```

Add these lines at the bottom:

```
127.0.0.1  dev.s10drd.com
127.0.0.1  dev.api.s10drd.com
127.0.0.1  dev.seaming.s10drd.com
127.0.0.1  dev.mapy.s10drd.com
127.0.0.1  order.s10drd.com
```

Save and exit (Ctrl+O, Enter, Ctrl+X).

Flush DNS cache:

```bash
sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder
```

### Windows

Open Notepad **as Administrator** and open:

```
C:\Windows\System32\drivers\etc\hosts
```

Add the same five lines at the bottom:

```
127.0.0.1  dev.s10drd.com
127.0.0.1  dev.api.s10drd.com
127.0.0.1  dev.seaming.s10drd.com
127.0.0.1  dev.mapy.s10drd.com
127.0.0.1  order.s10drd.com
```

Save the file. Flush DNS:

```powershell
ipconfig /flushdns
```

### Verify

```bash
ping dev.s10drd.com
```

Should resolve to `127.0.0.1`.

---

## Step 5 — Set up the .env file

The `.env` file contains shared secrets for all local services. A copy should already exist at `local-dev/.env`.

**Verify it exists:**

```bash
cat ~/NANCY/local-dev/.env
```

If missing, create it with these contents:

```env
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
```

---

## Step 6 — Set up the appsettings.Local.json

This file overrides the .NET API's config to point at local Docker services instead of AWS/Azure.

**Verify it exists:**

```bash
ls ~/NANCY/local-dev/appsettings.Local.json
```

If missing, copy the example and fill in:

```bash
cp ~/NANCY/local-dev/appsettings.Local.example ~/NANCY/local-dev/appsettings.Local.json
```

Then edit `appsettings.Local.json`. The key sections to set:

- `ConnectionStrings.geoffConn` = `Server=sqlserver,1433;Database=GeoffERP;User Id=sa;Password=LocalDev123!`
- `JWTKey.Key` = `GeoffLocalDevKey_MustBe32CharsOrMore!`
- `Jwt.Issuer` = `https://dev.api.s10drd.com`
- `Jwt.Audience` = `geoff-local`
- `AESKey.Key` = `1234567890123456`
- `AESKey.IV` = `1234567890123456`
- `AWSS3Bucket.BucketUrl` = `http://minio:9000/geoff-pdfs/`
- `AWSS3Bucket.AccessKey` = `minioadmin`
- `AWSS3Bucket.SecretKey` = `minioadmin`
- `D365BC.baseUrl` = `http://d365bc-mock:3200`
- `D365BC.loginEndPoint` = `http://d365bc-mock:3200`
- `Frontend_URL` = `https://dev.s10drd.com`

> Ask the team lead for a pre-filled copy if the example file has too many `FILL_IN` placeholders.

---

## Step 7 — Seed the database

The local SQL Server needs to be populated with data.

### Start just SQL Server first

```bash
cd ~/NANCY/local-dev
docker compose up -d sqlserver
```

Wait for it to become healthy:

```bash
docker compose ps
```

Look for `geoff-sqlserver ... Up ... (healthy)`. This can take 30-60 seconds.

### Load the seed data

The seed file is `restore-clean.sql` (443 MB SQL script).

**Mac:**

```bash
# Install sqlcmd if you don't have it
brew install sqlcmd

# Run the seed script (this takes 5-15 minutes)
sqlcmd -S localhost,1433 -U sa -P 'LocalDev123!' -i restore-clean.sql
```

**Windows (PowerShell):**

```powershell
# Install sqlcmd if you don't have it — download from:
# https://learn.microsoft.com/en-us/sql/tools/sqlcmd/sqlcmd-utility

# Run the seed script
sqlcmd -S localhost,1433 -U sa -P "LocalDev123!" -i restore-clean.sql
```

**Alternative — use a Docker sidecar (works on both platforms):**

```bash
# Copy the SQL file into the container
docker cp restore-clean.sql geoff-sqlserver:/tmp/restore-clean.sql

# Execute it inside the container (may take 10-20 minutes)
docker exec -it geoff-sqlserver /opt/mssql-tools/bin/sqlcmd \
  -S localhost -U sa -P 'LocalDev123!' \
  -i /tmp/restore-clean.sql
```

> **Note:** If `/opt/mssql-tools/bin/sqlcmd` doesn't exist inside the container (Azure SQL Edge on ARM may not have it), use the host-based `sqlcmd` approach above, or run a temporary sidecar:
> ```bash
> docker run --rm --network local-dev_default \
>   mcr.microsoft.com/mssql-tools \
>   /opt/mssql-tools/bin/sqlcmd \
>   -S geoff-sqlserver -U sa -P 'LocalDev123!' \
>   -i /tmp/restore-clean.sql
> ```

### Verify the database loaded

```bash
sqlcmd -S localhost,1433 -U sa -P 'LocalDev123!' \
  -Q "SELECT COUNT(*) AS TableCount FROM GeoffERP.INFORMATION_SCHEMA.TABLES"
```

Should return 100+ tables. If you see 0, the seed didn't work — check for errors above.

---

## Step 8 — Build and start all containers

```bash
cd ~/NANCY/local-dev
docker compose build
docker compose up -d
```

First build takes 5-10 minutes (downloading base images, compiling .NET, installing npm packages). Subsequent starts take seconds.

### Verify all containers are up

```bash
docker compose ps
```

You should see **9 containers** (minio-init is a one-shot that exits after creating the bucket):

| Container | Expected Status |
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

If any container is not `Up`, check its logs:

```bash
docker compose logs <service-name>
# Example: docker compose logs api
```

---

## Step 9 — Start the React frontend

The React frontend is NOT containerized. It runs on your host machine.

```bash
cd ~/NANCY/Geoff-ERP
npm install --legacy-peer-deps
npm start
```

This starts the dev server at `http://localhost:3000`. You don't need to open this URL directly — Caddy proxies `https://dev.s10drd.com` to it.

> **Windows note:** If `npm start` fails with EACCES or permission errors, try running your terminal as Administrator.

> **Mac Apple Silicon note:** If you get node-gyp build errors during `npm install`, make sure you have Xcode Command Line Tools: `xcode-select --install`

---

## Step 10 — Log in and verify

Open Chrome and go to:

```
https://dev.s10drd.com
```

### Login credentials

All users share the same local password:

- **Email:** `ashley@standardinteriors.com` (or any user in the system)
- **Password:** `LocalDev123!`

### What you should see

1. **Login page** — "Nancy ERP" branding with email/password fields
2. **Dashboard** — tiles showing Contacts, Proposals, Orders, Invoices A/R, Reports (all showing 500)
3. **Sidebar** (click hamburger menu) — Dashboard, Place An Order, Existing Orders, Deleted Orders, Sales Customer Info, Pricing Contracts

If you see the dashboard with data, everything is working.

---

## Architecture overview

Here's how all the pieces fit together:

```
Browser
  |
  |  https://dev.s10drd.com    (React frontend)
  |  https://dev.api.s10drd.com (API + auth)
  |  https://dev.seaming.s10drd.com
  |  https://dev.mapy.s10drd.com
  |  https://order.s10drd.com
  |
  v
/etc/hosts -> 127.0.0.1
  |
  v
[Caddy Reverse Proxy] :443 (TLS via mkcert)
  |
  +--> host.docker.internal:3000  (React dev server on your machine)
  |
  +--> auth-proxy:3100            (local auth, replaces AWS Cognito)
  |    +--> sqlserver:1433        (user lookup)
  |
  +--> api:5000                   (.NET API)
  |    +--> sqlserver:1433        (GeoffERP database)
  |    +--> minio:9000            (file storage, replaces S3)
  |    +--> d365bc-mock:3200      (replaces Microsoft Dynamics 365 BC)
  |
  +--> seaming-web:8082           (static file server)
  +--> ordering-web:8083          (static file server)
  +--> floorplan:80               (Python Flask app)
```

### What replaces what

| Production (AWS/Cloud) | Local Replacement |
|---|---|
| AWS Cognito | auth-proxy (Node.js, HS256 JWTs) |
| Microsoft Dynamics 365 BC | d365bc-mock (Node.js, in-memory) |
| AWS S3 | MinIO (S3-compatible, runs in Docker) |
| Azure SQL / RDS | SQL Server container (Azure SQL Edge) |
| CloudFront / ALB | Caddy reverse proxy |
| Route53 DNS | /etc/hosts entries |
| ACM Certificates | mkcert self-signed certificates |

---

## Port reference

| Port | Service | How to access |
|---|---|---|
| 443 | Caddy (HTTPS) | `https://dev.s10drd.com` etc. |
| 80 | Caddy (HTTP) | Redirects to HTTPS |
| 1433 | SQL Server | `localhost,1433` (for tools like SSMS or Azure Data Studio) |
| 3000 | React dev server | Via Caddy only (don't use directly) |
| 3100 | Auth proxy | Via Caddy only |
| 3200 | D365 BC mock | Internal container-to-container only |
| 5001 | API (direct) | `http://localhost:5001` (for debugging) |
| 9000 | MinIO S3 API | Internal |
| 9001 | MinIO Console | `http://localhost:9001` (admin: minioadmin/minioadmin) |

---

## Daily workflow

### Starting up

```bash
cd ~/NANCY/local-dev
docker compose up -d

cd ~/NANCY/Geoff-ERP
npm start
```

Then open `https://dev.s10drd.com`.

### Shutting down

```bash
cd ~/NANCY/local-dev
docker compose down
```

Your data is preserved in Docker volumes. Next time you `docker compose up -d`, everything comes back.

### Nuking everything and starting fresh

```bash
cd ~/NANCY/local-dev
docker compose down -v    # -v removes volumes (deletes all data!)
docker compose up -d      # Containers start with empty databases
# Re-seed the database (Step 7)
```

---

## Troubleshooting

### "Cannot connect to dev.s10drd.com"

1. Check `/etc/hosts` has the entries from Step 4
2. Check Caddy is running: `docker compose ps caddy`
3. Check the React frontend is running at port 3000: `curl http://localhost:3000`
4. Flush DNS cache (Step 4)

### "Login fails" or "401 Unauthorized"

1. Check auth-proxy is healthy: `docker compose ps auth-proxy`
2. Check auth-proxy logs: `docker compose logs auth-proxy`
3. Verify the database was seeded (Step 7) — auth-proxy needs the `MS_User` table
4. Make sure you're using password `LocalDev123!`

### API returns 500 errors

1. Check API logs: `docker compose logs api`
2. Common cause: `appsettings.Local.json` is missing or has invalid values
3. Common cause: SQL Server isn't healthy yet — wait 30 seconds and retry
4. Check the `appsettings.json` fix was applied (Step 2, Patch 2)

### Docker build fails on Apple Silicon Mac

1. Make sure Rosetta 2 is installed: `softwareupdate --install-rosetta`
2. The API and floorplan containers are forced to `linux/amd64` — this is normal and runs via emulation
3. If builds hang, increase Docker Desktop memory to 8GB+ (Settings > Resources)

### Docker build fails on Windows

1. Make sure Docker Desktop is set to **Linux containers** (not Windows containers)
2. Right-click Docker Desktop tray icon > "Switch to Linux containers" if needed
3. If you get line-ending errors in container scripts, configure git: `git config --global core.autocrlf input`

### Port conflicts

| If port is busy | Likely culprit | Fix |
|---|---|---|
| 80 or 443 | IIS (Windows) or Apache | Stop IIS: `iisreset /stop` |
| 1433 | Local SQL Server | Stop the local SQL Server service |
| 3000 | Another React app | Kill it or change CRA port: `PORT=3001 npm start` |

### MinIO console

Browse to `http://localhost:9001` and login with `minioadmin` / `minioadmin` to inspect uploaded files.

### Connecting to the database directly

Use **Azure Data Studio** (free, cross-platform) or **SSMS** (Windows only):

- **Server:** `localhost,1433`
- **Authentication:** SQL Login
- **Username:** `sa`
- **Password:** `LocalDev123!`
- **Database:** `GeoffERP`

---

## Files reference

Everything in `local-dev/`:

```
local-dev/
  docker-compose.yml         -- Orchestrates all 9 containers
  Caddyfile                  -- Reverse proxy routing (5 hostnames)
  Dockerfile.api             -- Builds .NET API (SDK 6.0, runtime 3.1)
  Dockerfile.floorplan       -- Builds Python floorplan service
  .env                       -- Shared secrets (DB, JWT, AES, MinIO)
  appsettings.Local.json     -- .NET API config overrides (mounted into container)
  appsettings.Local.example  -- Template if you need to recreate the above
  restore-clean.sql          -- 443 MB database seed (SQL script)
  hosts-entries.txt          -- /etc/hosts entries to add
  setup.ps1                  -- One-time setup script (Windows-oriented)
  start.ps1                  -- Start script
  stop.ps1                   -- Stop script
  restore-db.ps1             -- Database restore script (.bak format)
  certs/
    cert.pem                 -- TLS certificate (generate with mkcert)
    key.pem                  -- TLS private key
  auth-proxy/                -- Node.js auth service (replaces Cognito)
    Dockerfile
    package.json
    src/                     -- Express app (JWT generation, user lookup, etc.)
  d365bc-mock/               -- Node.js D365 BC mock
    Dockerfile
    package.json
    src/                     -- Express app (OAuth tokens, items, customers, sales, etc.)
```

---

## Required repo patches (summary)

Only 2 files in `GeoffERP-API` need changes. Everything else runs unmodified.

| File | Change | Why |
|---|---|---|
| `GeoffERP-API/GEOFF.API/Startup.cs` | Add `if (env == "Local")` JWT auth branch | Use local symmetric key instead of Cognito |
| `GeoffERP-API/GEOFF.API/appsettings.json` | `PLACEHOLDER_CUSTOMER_PARENT_ID` -> `0` | Fix invalid JSON so API can parse config |

Both changes are env-gated and safe for production. The `local_dev_env` branch on each repo should already have them.
