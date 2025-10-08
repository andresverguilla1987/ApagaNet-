#!/usr/bin/env bash
# post_reports.sh - posts test modem and device reports to ApagaNet using AGENT_TOKEN and APAGANET_URL.
# Usage:
#   export APAGANET_URL="https://apaganet-zmsa.onrender.com"
#   export AGENT_TOKEN="<token-from-make_agent_token>"
#   ./post_reports.sh
set -euo pipefail
: "${APAGANET_URL:?APAGANET_URL must be set (e.g. https://apaganet-zmsa.onrender.com)}"
: "${AGENT_TOKEN:?AGENT_TOKEN must be set (generate with make_agent_token.sh)}"

echo "Posting modem report (agent_id=1) to $APAGANET_URL"
curl -sS -X POST "${APAGANET_URL%/}/agents/report-modem-compat"   -H "Authorization: Bearer $AGENT_TOKEN"   -H "Content-Type: application/json"   -d '{
    "agent_id":"1",
    "gateway":"192.168.1.1",
    "http":[{"url":"http://192.168.1.1/","status":200,"bodySnippet":"<title>Router TP-Link</title>"}],
    "decision":{"compatibility":"compatible","reason":"TP-Link detected"}
  }' | jq . || true

echo ""
echo "Posting devices report (agent_id=1) to $APAGANET_URL"
curl -sS -X POST "${APAGANET_URL%/}/agents/report-devices"   -H "Authorization: Bearer $AGENT_TOKEN"   -H "Content-Type: application/json"   -d '{
    "agent_id":"1",
    "devices":[{"ip":"192.168.1.45","mac":"AA:BB:CC:DD:EE:01","hostname":"Tablet-Juan","last_seen":"2025-10-07T23:24:31Z"}]
  }' | jq . || true

echo ""
echo "Done. If responses show ok:true, refresh your frontend tester and try again."
