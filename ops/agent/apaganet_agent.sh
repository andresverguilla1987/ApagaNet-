#!/usr/bin/env bash
# apagant_agent.sh - simple LAN scanner & report sender (stable)
# Place in ops/agent for repo; DO NOT commit secrets.
set -euo pipefail

APAGANET_URL="${APAGANET_URL:-https://apaganet-zmsa.onrender.com}"
AGENT_TOKEN="${AGENT_TOKEN:-REPLACE_WITH_AGENT_TOKEN}"
AGENT_ID="${AGENT_ID:-1}"

# gateway guess
gateway="$(ip route 2>/dev/null | awk '/default/ {print $3; exit}' || true)"
[ -z "$gateway" ] && gateway="192.168.1.1"

# probe gateway (capture short body)
tmpfile="$(mktemp /tmp/apaganet_gw.XXXXXX)" || tmpfile="/tmp/apaganet_gw.html"
httpstatus=0
bodiesnippet=""
if curl -sS -m 5 -o "$tmpfile" "http://$gateway/" 2>/dev/null; then
  if [ -s "$tmpfile" ]; then
    httpstatus=200
    bodiesnippet="$(head -c 512 "$tmpfile" | tr -d '\n' | sed 's/"/\\"/g')"
  fi
fi

# collect devices via ip neigh or arp
devices_lines=""
if command -v ip >/dev/null 2>&1; then
  devices_lines="$(ip neigh show 2>/dev/null | awk '/lladdr/ {print $1 " " $5}')"
elif command -v arp >/dev/null 2>&1; then
  devices_lines="$(arp -a 2>/dev/null | awk '{print $2 " " $4}' | tr -d '()')"
else
  devices_lines=""
fi

# build devices JSON
devices_json='[]'
while IFS= read -r line; do
  [ -z "$line" ] && continue
  ipaddr="$(echo "$line" | awk '{print $1}')"
  mac="$(echo "$line" | awk '{print $2}')"
  [ -z "$ipaddr" ] && continue
  last_seen="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  devices_json="$(echo "$devices_json" | jq --arg ip "$ipaddr" --arg mac "$mac" --arg ls "$last_seen" '. + [{ip:$ip,mac:$mac,hostname:"",last_seen:$ls}]')"
done <<< "$devices_lines"

# construct modem payload using jq
modem_payload="$(jq -n \
  --arg ag "$AGENT_ID" \
  --arg gw "$gateway" \
  --arg url "http://$gateway/" \
  --arg bs "$bodiesnippet" \
  --argjson status 0 \
  '{agent_id:$ag, gateway:$gw, http:[{url:$url, status:$status, bodySnippet:$bs}], decision:{compatibility:"unknown",reason:"agent-scan"}}')"

# POST modem report
curl -sS -X POST "${APAGANET_URL}/agents/report-modem-compat" \
  -H "Authorization: Bearer ${AGENT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "$modem_payload" || echo "Warning: POST report-modem-compat failed" >&2

# POST devices report
devices_payload="$(echo "$devices_json" | jq --arg ag "$AGENT_ID" '{agent_id:$ag, devices:.}')"
curl -sS -X POST "${APAGANET_URL}/agents/report-devices" \
  -H "Authorization: Bearer ${AGENT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "$devices_payload" || echo "Warning: POST report-devices failed" >&2

[ -f "$tmpfile" ] && rm -f "$tmpfile" || true
