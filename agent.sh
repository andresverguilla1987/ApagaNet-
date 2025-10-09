#!/usr/bin/env bash
set -euo pipefail

# ApagaNet agent.sh — detector simple de dispositivos en red local
# Uso:
#   ./agent.sh <AGENT_ID> [BACKEND_URL]
# Ejemplo:
#   ./agent.sh 1 https://apaganet-zmsa.onrender.com
#
# Variables opcionales:
#   BACKEND_URL, APAGANET_TOKEN (Bearer), INTERVAL_SEC (default 30)
#
# Requiere: bash, ip/arp, sed/awk, curl

AGENT_ID="${1:-${AGENT_ID:-}}"
BACKEND_URL="${2:-${BACKEND_URL:-}}"
INTERVAL_SEC="${INTERVAL_SEC:-30}"

if [[ -z "${AGENT_ID}" ]]; then
  echo "ERROR: Falta AGENT_ID. Uso: ./agent.sh <AGENT_ID> [BACKEND_URL]" >&2
  exit 1
fi

if [[ -z "${BACKEND_URL}" ]]; then
  echo "ERROR: Falta BACKEND_URL (ej: https://apaganet-zmsa.onrender.com)" >&2
  exit 1
fi

# Normaliza URL (sin / al final)
BACKEND_URL="${BACKEND_URL%%/}"

log() { printf '%s %s\n' "$(date -Is)" "$*" >&2; }

# Obtiene pares IP/MAC desde ip neigh y/o arp -an
scan_devices() {
  # Primero intenta 'ip neigh' (más moderno)
  if command -v ip >/dev/null 2>&1; then
    ip neigh show | awk '
      $0 ~ /lladdr/ {
        ip=$1;
        mac="";
        for (i=1;i<=NF;i++) if ($i=="lladdr" && (i+1)<=NF) { mac=$(i+1); break; }
        if (ip!="" && mac!="") print ip, mac;
      }' \
      | sort -u
  fi

  # Luego intenta arp -an (fallback)
  if command -v arp >/dev/null 2>&1; then
    arp -an | awk '
      {
        # formato típico: ? (192.168.0.5) at aa:bb:cc:dd:ee:ff [ether] on eth0
        match($0, /\(([0-9\.]+)\)/, m1);
        match($0, / at ([0-9a-fA-F:]{17}) /, m2);
        if (m1[1] != "" && m2[1] != "") print m1[1], m2[1];
      }' \
      | sort -u
  fi
}

# Construye JSON para enviar
build_json() {
  local items
  mapfile -t items < <(scan_devices | sort -u)

  local first=1
  printf '{'
  printf '"agent_id":"%s",' "${AGENT_ID}"
  printf '"generated_at":"%s",' "$(date -Is)"
  printf '"devices":['
  for line in "${items[@]:-}"; do
    ip=$(printf '%s' "$line" | awk '{print $1}')
    mac=$(printf '%s' "$line" | awk '{print $2}')
    [[ -z "$ip" || -z "$mac" ]] && continue
    [[ $first -eq 1 ]] || printf ','
    printf '{"ip":"%s","mac":"%s"}' "$ip" "$mac"
    first=0
  done
  printf ']}'  # cierre
}

# POST con fallback de rutas
post_report() {
  local json="$1"
  local token_hdr=()
  [[ -n "${APAGANET_TOKEN:-}" ]] && token_hdr=(-H "Authorization: Bearer ${APAGANET_TOKEN}")

  declare -a paths=(
    "/agents/devices/report"
    "/agents/report"
    "/api/agents/devices/report"
  )

  for p in "${paths[@]}"; do
    url="${BACKEND_URL}${p}"
    http_code=$(curl -sS -o /tmp/apaganet_resp.json -w "%{http_code}" \
      -H "Content-Type: application/json" "${token_hdr[@]}" \
      -X POST --data "${json}" "${url}" || echo "000")
    if [[ "${http_code}" == "200" || "${http_code}" == "201" || "${http_code}" == "202" ]]; then
      cat /tmp/apaganet_resp.json
      return 0
    else
      log "WARN $p -> HTTP ${http_code}"
    fi
  done

  log "ERROR: Ninguna ruta aceptó el reporte"
  return 1
}

log "ApagaNet agent iniciado (agent_id=${AGENT_ID}, backend=${BACKEND_URL})"
trap 'log "Saliendo..."; exit 0' INT TERM

while true; do
  json="$(build_json)"
  log "Reportando dispositivos..."
  post_report "${json}" || true
  sleep "${INTERVAL_SEC}"
done
