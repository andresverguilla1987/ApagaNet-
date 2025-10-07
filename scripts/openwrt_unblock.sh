
#!/usr/bin/env bash
set -euo pipefail
USER="${1:?user}"; HOST="${2:?host}"; MAC="${3:?mac}"
DRY="${DRY_RUN:-true}"

# Encuentra la sección por nombre y elimínala
CMD="sec=$(uci show firewall | grep -E "name='apaganet_block_${MAC//:/}'" | head -n1 | sed -E 's/^firewall\.([^=]+)=.*/\1/'); if [ -n \"$sec\" ]; then uci delete firewall.$sec; uci commit firewall; /etc/init.d/firewall reload; fi"

echo "[OpenWrt] unblock ${MAC} on ${HOST}"
echo "ssh ${USER}@${HOST} "${CMD}""
[[ "${DRY}" == "true" ]] && { echo "[DRY_RUN] sin aplicar"; exit 0; }
ssh -o StrictHostKeyChecking=no "${USER}@${HOST}" "${CMD}"
