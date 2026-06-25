#!/bin/sh
# Provisioning n8n : credentials + data tables + workflows.
# Execute par n8n-init apres que n8n soit healthy.
# Les scripts SQLite gèrent leur propre attente (busyTimeout + retry projet).
set -e

echo "=== n8n provisioning ==="

# 1. Credentials (SQLite direct + chiffrement AES, IDs fixes)
echo "--- Creation des credentials ---"
node /home/node/provisioning/create-credentials.js || echo "create-credentials: echec"

# 2. Data tables de logs
echo "--- Creation des data tables de logs ---"
node /home/node/provisioning/seed-datatables.js || echo "seed data tables: echec"

# 3. Workflows
echo "--- Import des workflows ---"
for wf in /home/node/workflows/*.json; do
  [ -f "$wf" ] || continue
  echo "Import: $(basename "$wf")"
  n8n import:workflow --input="$wf" || echo "  (deja existant ou erreur)"
done

echo "=== provisioning termine ==="
echo "NOTE: active le workflow via le toggle de l UI (http://localhost:5678)."
