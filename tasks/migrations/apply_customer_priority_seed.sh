#!/usr/bin/env bash
# apply_customer_priority_seed.sh
# Seeds the TR_CustomerPriority table with the canonical local test list.
# Idempotent via the API's delete-then-insert per-store semantics.
#
# Prerequisites:
#   - Local stack up (docker compose up -d)
#   - Feature flag ON (set in local-dev/config/appsettings.Local.json)
#   - MS_User has admin credentials that match DEFAULT_USER below
#   - apply_customer_priority_menu.sh already run (so the admin page is accessible)

set -euo pipefail

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
CSV_FILE="${SCRIPT_DIR}/customer_priority_seed_denver.csv"
DEFAULT_USER="${DEFAULT_USER:-robert@standardinteriors.com}"
DEFAULT_PASS="${DEFAULT_PASS:-LocalDev123!}"
API_BASE="${API_BASE:-https://dev.api.s10drd.com}"
STORE_ID="${STORE_ID:-12}"  # 12 = Denver

if [[ ! -f "$CSV_FILE" ]]; then
    echo "ERROR: CSV file not found at $CSV_FILE" >&2
    exit 1
fi

echo "[SEED] Logging in as $DEFAULT_USER..."
LOGIN_RESPONSE=$(curl -sk -X POST "${API_BASE}/Authentication/api/Login/SignIn" \
    -H 'Content-Type: application/json' \
    -d "{\"EmailId\":\"${DEFAULT_USER}\",\"Password\":\"${DEFAULT_PASS}\"}")

TOKEN=$(echo "$LOGIN_RESPONSE" | python3 -c 'import json,sys; d=json.load(sys.stdin); r=d.get("result") or []; print(r[0]["token"] if r else "")')

if [[ -z "$TOKEN" ]]; then
    echo "ERROR: Login failed. Response was:" >&2
    echo "$LOGIN_RESPONSE" >&2
    exit 1
fi

USER_ID=$(echo "$LOGIN_RESPONSE" | python3 -c 'import json,sys; d=json.load(sys.stdin); r=d.get("result") or [{}]; print(r[0].get("userId",""))')
echo "[SEED] Logged in as UserId=$USER_ID"

echo "[SEED] Uploading $CSV_FILE to Store $STORE_ID..."
UPLOAD_RESPONSE=$(curl -sk -X POST "${API_BASE}/User/api/CustomerPriority/Import" \
    -H "Authorization: Bearer ${TOKEN}" \
    -F "file=@${CSV_FILE};type=text/csv" \
    -F "storeId=${STORE_ID}" \
    -F "userId=${USER_ID}")

echo "[SEED] Response:"
echo "$UPLOAD_RESPONSE" | python3 -m json.tool

SUCCESS=$(echo "$UPLOAD_RESPONSE" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("responsestatus",""))' 2>/dev/null || echo "")
if [[ "$SUCCESS" == "Success" ]]; then
    echo "[SEED] OK — priority list seeded for Store $STORE_ID."
else
    echo "[SEED] FAILED — check response above." >&2
    exit 1
fi
