#!/usr/bin/env bash
# apply_patch.sh - backs up server.js, inserts routes block before the "404 & errores" section,
# copies compat_widget.js to public/, and saves migrations to migrations/.
# USAGE: run this from the repo root where server.js lives: ./apply_patch.sh
set -euo pipefail
BACKUP_DIR="patch_backups_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"
if [ ! -f server.js ]; then
  echo "server.js not found in current directory. Run this script from your repo root where server.js is located."
  exit 1
fi
echo "Backing up server.js to $BACKUP_DIR/server.js.bak"
cp server.js "$BACKUP_DIR/server.js.bak"

# Insert routes block before the 404 & errores comment
awk -v blockfile="routes_block.snippet" '
  BEGIN{ inserted=0 }
  { if (!inserted && $0 ~ /\/\/ ---------- 404 & errores ----------/) { 
      while ((getline line < blockfile) > 0) print line;
      inserted=1
    } 
    print $0
  }
' server.js > server.js.new && mv server.js.new server.js

echo "Inserted routes block into server.js (backup in $BACKUP_DIR)"
# copy compat widget to public/
mkdir -p public
cp compat_widget.js public/compat_widget.js
echo "Copied compat_widget.js to public/"

# add migrations
mkdir -p migrations
cp migration.sql migrations/migration_add_agent_reports.sql
echo "Copied migration SQL to migrations/migration_add_agent_reports.sql"

echo "Done. You should run the migration SQL against your database, then restart your server (or push to your host)." 
echo "Example to run migration with psql:"
echo "psql "host=$PGHOST user=$PGUSER dbname=$PGDATABASE password=$PGPASSWORD" -f migrations/migration_add_agent_reports.sql"
