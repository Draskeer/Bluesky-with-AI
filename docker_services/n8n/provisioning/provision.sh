#!/bin/sh
# Provisioning n8n : credentials + data tables + workflows.
# Execute par n8n-init apres que n8n soit healthy (owner deja cree par init-wrapper.sh).
set -e

echo "=== n8n provisioning ==="

# 1. Credentials (n8n les chiffre a l import avec N8N_ENCRYPTION_KEY, IDs fixes)
cat > /tmp/credentials.json <<JSON
[
  {
    "id": "AjUxu8oW8xTpjjAF",
    "name": "Postgres account",
    "type": "postgres",
    "data": {
      "host": "${PG_HOST:-postgres}",
      "port": ${PG_PORT:-5432},
      "database": "${PG_DB:-bluesky_ai}",
      "user": "${PG_USER:-bluesky}",
      "password": "${PG_PASSWORD:-bluesky_secret}",
      "ssl": "disable"
    }
  },
  {
    "id": "JMEmm98ahxB3zJ71",
    "name": "Qdrant account",
    "type": "qdrantApi",
    "data": {
      "qdrantUrl": "${QDRANT_URL:-http://qdrant:6333}",
      "apiKey": "${QDRANT_API_KEY}"
    }
  },
  {
    "id": "DSrdobixLxaxdSEf",
    "name": "OpenAi account",
    "type": "openAiApi",
    "data": {
      "apiKey": "sk-noauth",
      "url": "${LLM_BASE_URL:-http://llm-server:8000/v1}"
    }
  }
]
JSON

echo "--- Import des credentials ---"
n8n import:credentials --input=/tmp/credentials.json || echo "import credentials: echec"

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