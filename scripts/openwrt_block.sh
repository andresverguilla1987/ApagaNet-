
#!/usr/bin/env bash
set -euo pipefail
USER="${1:?user}"; HOST="${2:?host}"; MAC="${3:?mac}"
DRY="${DRY_RUN:-true}"

CMD="uci add firewall rule >/dev/null; uci set firewall.@rule[-1].name='apaganet_block_${MAC//:/}'; uci set firewall.@rule[-1].src='lan'; uci set firewall.@rule[-1].src_mac='${MAC}'; uci set firewall.@rule[-1].target='REJECT'; uci commit firewall; /etc/init.d/firewall reload"

echo "[OpenWrt] block ${MAC} on ${HOST}"
echo "ssh ${USER}@${HOST} "${CMD}""
[[ "${DRY}" == "true" ]] && { echo "[DRY_RUN] sin aplicar"; exit 0; }
ssh -o StrictHostKeyChecking=no "${USER}@${HOST}" "${CMD}"
