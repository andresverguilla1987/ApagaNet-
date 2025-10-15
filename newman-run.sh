#!/usr/bin/env bash
set -euo pipefail

mkdir -p reports

if ! command -v newman >/dev/null 2>&1; then
  echo "Instalando newman y reporter htmlextra (requiere Node/npm)"
  npm i -g newman newman-reporter-htmlextra
fi

newman run ApagaNet.smoketests.postman_collection.json   -e ApagaNet.postman_environment.json   --timeout-request 15000   --delay-request 200   --reporters cli,htmlextra   --reporter-htmlextra-export reports/apaganet-smoke.html

echo "Reporte listo: reports/apaganet-smoke.html"
