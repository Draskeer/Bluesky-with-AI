#!/bin/sh
# Provisioning n8n : credentials (via API REST) + workflows + data tables.
# Execute par n8n-init apres que n8n soit healthy.
set -e

echo "=== n8n provisioning ==="

# 1. Credentials via API REST (n8n gère le chiffrement)
echo "--- Creation des credentials ---"
node /home/node/provisioning/create-credentials.js

# 2. Workflows (patch des IDs credentials avant import)
echo "--- Import des workflows ---"
for wf in /home/node/workflows/*.json; do
  [ -f "$wf" ] || continue
  echo "Import: $(basename "$wf")"
  node /home/node/provisioning/patch-workflow.js "$wf" /tmp/patched-workflow.json \
    && n8n import:workflow --input=/tmp/patched-workflow.json \
    || echo "  (erreur import $(basename "$wf"))"
done

# 3. Data tables de logs
echo "--- Creation des data tables de logs ---"
node /home/node/provisioning/seed-datatables.js || echo "seed data tables: echec"

echo "=== provisioning termine ==="
echo "NOTE: active le workflow via le toggle de l'UI (http://localhost:5678)."
