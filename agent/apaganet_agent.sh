#!/usr/bin/env bash
# apagant_agent.sh - simple LAN scanner & report sender
# Requisitos: curl, jq, ip (o arp). nmap opcional.
set -euo pipefail

APAGANET_URL="${APAGANET_URL:-https://apaganet-zmsa.onrender.com}"
AGENT_TOKEN="${AGENT_TOKEN:-REPLACE_WITH_AGENT_TOKEN}"
AGENT_ID="${AGENT_ID:-1}"
TMP=$(mktemp /tmp/apaganet.XXXXXX)

gateway=$(ip route 2>/dev/null | awk '/default/ {print $3; exit}' || true)
[ -z "$gateway" ] && gateway="192.168.1.1"

httpstatus=0
bodiesnippet=""
if curl -sS -m 5 "http://$gateway/" -o "$TMP" 2>/dev/null; then
  httpstatus=200
  bodiesnippet=$(head -c 512 "$TMP" | tr -d '\n' | sed 's/"/\\\"/g')
fi

devices_lines=()
if command -v ip >/dev/null 2>&1; then
  while IFS= read -r line; do devices_lines+=("$line"); done < <(ip neigh show 2>/dev/null | awk '/lladdr/ {print $1 " " $5}')
elif command -v arp >/dev/null 2>&1; then
  while IFS= read -r line; do devices_lines+=("$line"); done < <(arp -n | awk '/ / {print $1 " " $3}')
elif command -v nmap >/dev/null 2>&1; then
  while IFS= read -r line; do devices_lines+=("$line"); done < <(nmap -sn "${gateway%.*}.0/24" -oG - | awk '/Up/ {print $2 " " $4}' | sed 's/(//;s/)//')
fi

devices_json="[]"
for l in "${devices_lines[@]:-}"; do
  ipaddr=$(echo "$l" | awk '{print $1}')
  mac=$(echo "$l" | awk '{print $2}')
  [ -z "$ipaddr" ] && continue
  hostname=""
  devices_json=$(echo "$devices_json" | jq --arg ip "$ipaddr" --arg mac "$mac" --arg host "$hostname" '. + [{ip:$ip,mac:$mac,hostname:$host,last_seen:(now|todate)}]')
done

curl -sS -X POST "${APAGANET_URL}/agents/report-modem-compat" \
  -H "Authorization: Bearer ${AGENT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "$(jq -n --arg ag "$AGENT_ID" --arg gw "$gateway" --argjson http "[{url:\"http://${gateway}/\",status:$httpstatus,bodySnippet:\"$bodiesnippet\"}]" --argjson decision '{"compatibility":"unknown","reason":"agent-scan"}' '{agent_id:$ag,gateway:$gw,http:$http,decision:$decision}')"

curl -sS -X POST "${APAGANET_URL}/agents/report-devices" \
  -H "Authorization: Bearer ${AGENT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "$(jq -n --arg ag "$AGENT_ID" --argjson devices "$devices_json" '{agent_id:$ag, devices:$devices}')"

rm -f "$TMP"
