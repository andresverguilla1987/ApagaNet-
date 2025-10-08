#!/usr/bin/env bash
# make_agent_token.sh
# Generates a JWT for an agent (agent_id default 1) using Node's jsonwebtoken.
# Usage:
#   JWT_SECRET="your_jwt_secret" ./make_agent_token.sh [agent_id]
set -euo pipefail
AGENT_ID="${1:-1}"
if [ -z "${JWT_SECRET:-}" ]; then
  echo "ERROR: JWT_SECRET environment variable is not set."
  echo "Set it and re-run. Example: JWT_SECRET=dev-secret ./make_agent_token.sh 1"
  exit 1
fi
node -e "console.log(require('jsonwebtoken').sign({agent_id: process.argv[1], role:'agent'}, process.env.JWT_SECRET))" "$AGENT_ID"
