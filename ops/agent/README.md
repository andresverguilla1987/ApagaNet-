# ops/agent — ApagaNet agent scripts

This folder contains scripts and systemd units to run a small LAN scanner (agent) that reports modem compatibility
and device lists to the ApagaNet backend.

**DO NOT** commit your secrets. Use `ops/agent/.env` on the server (gitignored).

Files:
- `apaganet_agent.sh` — agent script (test locally without sudo)
- `install.sh` — installer (requires sudo, copies files to /usr/local/bin and enables systemd timer)
- `apaganet-agent.service` — systemd service for one-shot runs
- `apaganet-agent.timer` — systemd timer to run every 5 minutes
- `.env.example` — example env file (no secrets)
- `.gitignore` — to prevent committing secrets

## How to use

1. Copy files to target machine (scp / rsync)
2. On target machine, create `/etc/default/apaganet_agent` with:
   ```
   APAGANET_URL="https://apaganet-zmsa.onrender.com"
   AGENT_TOKEN="YOUR_AGENT_TOKEN"
   AGENT_ID="1"
   ```
   Save with permissions 600.
3. Test without sudo:
   ```
   export APAGANET_URL="https://apaganet-zmsa.onrender.com"
   export AGENT_TOKEN="YOUR_AGENT_TOKEN"
   export AGENT_ID="1"
   ./apaganet_agent.sh
   ```
4. Install system-wide (requires sudo):
   ```
   sudo ./install.sh
   sudo systemctl status apaganet-agent.timer
   sudo journalctl -u apaganet-agent.service -f
   ```

## Security
- Keep `AGENT_TOKEN` secret. Do not commit to GitHub.
- Use `.env` or `/etc/default/apaganet_agent` to provide secrets on the server.
