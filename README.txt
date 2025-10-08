ApagaNet Diagnostic Package
===========================

Files:
- diag.sh         -> main diagnostic script (bash)
- make_tokens.sh  -> generate AGENT_TOKEN and ADMIN_JWT using JWT_SECRET (requires node)
- README.txt      -> this file with instructions

How to run (recommended: Render Web Shell or local terminal):
1) Upload/extract package on the machine where you will run diagnostics (Render web shell or your laptop).
2) Make scripts executable:
   chmod +x diag.sh make_tokens.sh
3) Recommended env vars to set before running:
   export NETLIFY_URL="https://<tu-netlify-site>.netlify.app"
   export APAGANET_URL="https://apaganet-zmsa.onrender.com"
   export AGENT_TOKEN="<token-from-render-or-generated>"   # optional, used to POST reports
   export ADMIN_JWT="<admin-jwt>"                          # optional, used for admin GETs
   export PGCONN="host=... user=... password=... dbname=..." # optional
   export JWT_SECRET="apaganet-secret-dev"                # optional (for make_tokens.sh)
4) Run diagnostics:
   ./diag.sh | tee diag_output.txt
5) Inspect diag_output.txt and paste any failing sections (404, 401, SQL errors) back to the team/assistant.

Notes:
- diag.sh will try to POST test reports if AGENT_TOKEN is provided.
- If you don't have AGENT_TOKEN but know JWT_SECRET, run: JWT_SECRET=... ./make_tokens.sh to generate tokens.
- Do not commit secrets into git. Use ephemeral tokens for diagnostics.
