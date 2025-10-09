#!/usr/bin/env bash
# install.sh - copy agent to /usr/local/bin and enable systemd timer
# Run on target machine (requires sudo).
set -euo pipefail

PREFIX=${PREFIX:-/usr/local}
BIN_PATH="$PREFIX/bin"
SERVICE_PATH="/etc/systemd/system"

if [ "$(id -u)" -ne 0 ]; then
  echo "This installer requires sudo privileges. Run with sudo."
  exit 1
fi

mkdir -p "$BIN_PATH"
cp apagant_agent.sh "$BIN_PATH/apaganet_agent.sh"
chmod 755 "$BIN_PATH/apaganet_agent.sh"

cp apaganet-agent.service "$SERVICE_PATH/apaganet-agent.service"
cp apaganet-agent.timer "$SERVICE_PATH/apaganet-agent.timer"

systemctl daemon-reload
systemctl enable --now apaganet-agent.timer

echo "Installed and enabled apaganet-agent.timer"
echo "Check status: systemctl status apaganet-agent.timer"
