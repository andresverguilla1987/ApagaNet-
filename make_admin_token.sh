#!/usr/bin/env bash
# make_admin_token.sh
# Generates a JWT for an admin for testing protected GET endpoints.
# Usage:
#   JWT_SECRET="your_jwt_secret" ./make_admin_token.sh
set -euo pipefail
if [ -z "${JWT_SECRET:-}" ]; then
  echo "ERROR: JWT_SECRET environment variable is not set."
  echo "Set it and re-run. Example: JWT_SECRET=dev-secret ./make_admin_token.sh"
  exit 1
fi
node -e "console.log(require('jsonwebtoken').sign({role:'admin', id:'admin1'}, process.env.JWT_SECRET))"
