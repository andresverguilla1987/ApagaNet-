#!/usr/bin/env bash
# check_endpoints.sh - quick GET checks for the new endpoints using ADMIN_JWT.
# Usage:
#   export APAGANET_URL="https://apaganet-zmsa.onrender.com"
#   export ADMIN_JWT="<token-from-make_admin_token>"
#   ./check_endpoints.sh
set -euo pipefail
: "${APAGANET_URL:?APAGANET_URL must be set}"
: "${ADMIN_JWT:?ADMIN_JWT must be set}"
echo "GET /agents/modem-compat/latest?agent_id=1"
curl -i -s -H "Authorization: Bearer $ADMIN_JWT" "${APAGANET_URL%/}/agents/modem-compat/latest?agent_id=1" | jq . || true
echo ""
echo "GET /agents/devices/latest?agent_id=1"
curl -i -s -H "Authorization: Bearer $ADMIN_JWT" "${APAGANET_URL%/}/agents/devices/latest?agent_id=1" | jq . || true
