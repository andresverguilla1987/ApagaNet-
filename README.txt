ApagaNet helper ZIP - quick tokens & test reports
================================================

Files included:
- make_agent_token.sh   -> generate an agent JWT (requires node & jsonwebtoken)
- make_admin_token.sh   -> generate an admin JWT for testing (requires node & jsonwebtoken)
- post_reports.sh       -> posts modem + devices reports to APAGANET_URL using AGENT_TOKEN
- check_endpoints.sh    -> GET checks for the new endpoints using ADMIN_JWT
- insert_sql.sh         -> insert test rows directly into Postgres (uses psql)
- README.txt            -> this file

Quick usage (minimal):
1) Unzip and cd into the folder.
2) Generate an agent token (requires setting JWT_SECRET env var):
   JWT_SECRET="dev-secret" ./make_agent_token.sh 1
   -> copy printed token into AGENT_TOKEN
3) Export APAGANET_URL (example):
   export APAGANET_URL="https://apaganet-zmsa.onrender.com"
4) Export AGENT_TOKEN from step 2:
   export AGENT_TOKEN="eyJ..."
5) Post test reports:
   ./post_reports.sh
6) Generate an admin token (for GET checks):
   JWT_SECRET="dev-secret" ./make_admin_token.sh
   export ADMIN_JWT="<token>"
7) Check GET endpoints:
   export APAGANET_URL="https://apaganet-zmsa.onrender.com"
   export ADMIN_JWT="<token>"
   ./check_endpoints.sh

Notes:
- These scripts assume your backend validates JWT signed with the same JWT_SECRET you set when generating tokens.
- If your backend uses a different auth flow, instead use insert_sql.sh to insert test rows directly into the DB.
- Keep secrets safe; do not commit JWT_SECRET into source control.
