#!/usr/bin/env bash
# make_tokens.sh - helper to generate AGENT_TOKEN and ADMIN_JWT if you have JWT_SECRET
# Usage: JWT_SECRET=... ./make_tokens.sh
set -euo pipefail
if [ -z "${JWT_SECRET:-}" ]; then
  echo "JWT_SECRET not set. Usage: JWT_SECRET=... ./make_tokens.sh"
  exit 1
fi
AGENT_TOKEN=$(node -e "console.log(require('jsonwebtoken').sign({agent_id:'1', role:'agent'}, process.env.JWT_SECRET))")
ADMIN_JWT=$(node -e "console.log(require('jsonwebtoken').sign({role:'admin', id:'admin1'}, process.env.JWT_SECRET))")
echo "AGENT_TOKEN=$AGENT_TOKEN"
echo "ADMIN_JWT=$ADMIN_JWT"
