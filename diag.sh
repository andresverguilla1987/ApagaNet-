#!/usr/bin/env bash
# diag.sh - ApagaNet diagnostic script
# Usage: set env vars as needed then run: ./diag.sh
# Example:
#   export NETLIFY_URL="https://harmonious-dragon-71a2fa.netlify.app"
#   export APAGANET_URL="https://apaganet-zmsa.onrender.com"
#   export ADMIN_JWT="..."   # optional
#   export AGENT_TOKEN="..." # optional
#   ./diag.sh
set -euo pipefail
echo "==== ApagaNet diagnostic script ===="
echo "Timestamp: $(date -u +'%Y-%m-%dT%H:%M:%SZ')"
echo

# helpers
function curl_ok() {
  local url="$1"; shift
  echo "--> CURL $url"
  curl -i -s -S "$url" 2>&1 | sed -n '1,200p'
  echo
}
function curl_auth() {
  local url="$1"; local token="$2"
  echo "--> CURL (auth) $url"
  curl -i -s -S -H "Authorization: Bearer $token" "$url" 2>&1 | sed -n '1,200p'
  echo
}

# 1) Netlify site root
if [ -n "${NETLIFY_URL:-}" ]; then
  echo "[1] Netlify site root check (NETLIFY_URL=$NETLIFY_URL)"
  curl_ok "$NETLIFY_URL/"
else
  echo "[1] NETLIFY_URL not set - skip Netlify root check"
fi

# 2) Netlify proxy ping
if [ -n "${NETLIFY_URL:-}" ]; then
  echo "[2] Netlify -> proxy /api/ping check"
  curl_ok "$NETLIFY_URL/api/ping"
else
  echo "[2] NETLIFY_URL not set - skip proxy ping check"
fi

# 3) Backend ping direct
if [ -n "${APAGANET_URL:-}" ]; then
  echo "[3] Backend direct /ping check (APAGANET_URL=$APAGANET_URL)"
  curl_ok "$APAGANET_URL/ping"
else
  echo "[3] APAGANET_URL not set - skip backend ping"
fi

# 4) Check modem/devices endpoints via Netlify proxy and direct
if [ -n "${APAGANET_URL:-}" ]; then
  echo "[4] GET /agents/modem-compat/latest?agent_id=1 (direct)"
  curl_ok "$APAGANET_URL/agents/modem-compat/latest?agent_id=1"
  echo "[4b] GET /agents/devices/latest?agent_id=1 (direct)"
  curl_ok "$APAGANET_URL/agents/devices/latest?agent_id=1"
else
  echo "[4] APAGANET_URL not set - skip direct endpoints checks"
fi

if [ -n "${NETLIFY_URL:-}" ]; then
  echo "[4c] GET via Netlify proxy: /api/agents/modem-compat/latest?agent_id=1"
  curl_ok "$NETLIFY_URL/api/agents/modem-compat/latest?agent_id=1"
  echo "[4d] GET via Netlify proxy: /api/agents/devices/latest?agent_id=1"
  curl_ok "$NETLIFY_URL/api/agents/devices/latest?agent_id=1"
fi

# 5) Try with ADMIN_JWT if provided
if [ -n "${ADMIN_JWT:-}" ]; then
  echo "[5] GET with ADMIN_JWT against backend (direct)"
  curl_auth "$APAGANET_URL/agents/modem-compat/latest?agent_id=1" "$ADMIN_JWT"
  curl_auth "$APAGANET_URL/agents/devices/latest?agent_id=1" "$ADMIN_JWT"
else
  echo "[5] ADMIN_JWT not set - skip admin-auth GETs"
fi

# 6) If AGENT_TOKEN provided, try posting sample reports
if [ -n "${AGENT_TOKEN:-}" ]; then
  echo "[6] AGENT_TOKEN present - posting sample modem + devices reports (will not crash production)"
  echo "Posting modem report..."
  curl -sS -X POST "${APAGANET_URL%/}/agents/report-modem-compat" -H "Authorization: Bearer $AGENT_TOKEN" -H "Content-Type: application/json" -d '{
    "agent_id":"1",
    "gateway":"192.168.1.1",
    "http":[{"url":"http://192.168.1.1/","status":200,"bodySnippet":"<title>Router TP-Link</title>"}],
    "decision":{"compatibility":"compatible","reason":"diag-insert"}
  }' | jq . || true
  echo
  echo "Posting devices report..."
  curl -sS -X POST "${APAGANET_URL%/}/agents/report-devices" -H "Authorization: Bearer $AGENT_TOKEN" -H "Content-Type: application/json" -d '{
    "agent_id":"1",
    "devices":[{"ip":"192.168.1.45","mac":"AA:BB:CC:DD:EE:01","hostname":"Tablet-Juan","last_seen":"2025-10-07T23:24:31Z"}]
  }' | jq . || true
  echo
else
  echo "[6] AGENT_TOKEN not set - skip posting reports"
fi

# 7) If PGCONN provided, check DB tables and counts
if [ -n "${PGCONN:-}" ]; then
  echo "[7] PGCONN set - checking DB tables and recent rows (requires psql installed)"
  psql "$PGCONN" -c "\dt" || true
  psql "$PGCONN" -c "select id, agent_id, created_at from agent_modem_reports order by created_at desc limit 5;" || true
  psql "$PGCONN" -c "select id, agent_id, created_at from agent_device_reports order by created_at desc limit 5;" || true
else
  echo "[7] PGCONN not set - skip DB checks"
fi

# 8) quick DNS and TLS checks
if [ -n "${APAGANET_URL:-}" ]; then
  echo "[8] DNS/TLS info for APAGANET_URL host"
  host=$(echo "$APAGANET_URL" | sed -E 's#https?://##' | sed -E 's#/.*$##')
  echo "Host: $host"
  nslookup "$host" | sed -n '1,200p' || true
  echo
  echo "OpenSSL s_client connect (TLS) - show cert subject (may hang if openssl absent)"
  openssl s_client -connect ${host}:443 -servername ${host} </dev/null 2>/dev/null | sed -n '1,20p' || true
else
  echo "[8] APAGANET_URL not set - skip DNS/TLS checks"
fi

echo
echo "==== diagnostic complete ===="
