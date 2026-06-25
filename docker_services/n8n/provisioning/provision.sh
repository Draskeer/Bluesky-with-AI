#!/bin/sh
# Provisioning automatique de n8n : credentials + data tables de logs + workflows.
# Exécuté par le conteneur n8n-init, une fois n8n démarré (DB partagée via volume).
set -e

echo "=== n8n provisioning ==="

# ---------------------------------------------------------------------------
# 1. Credentials (data en clair -> n8n les chiffre à l'import, IDs fixes)
#    Les IDs correspondent à ceux référencés dans les workflows.
# ---------------------------------------------------------------------------
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
n8n import:credentials --input=/tmp/credentials.json || echo "import credentials: échec (owner pas encore créé ?)"

# ---------------------------------------------------------------------------
# 2. Data tables de logs (IDs fixes via insertion SQLite directe, idempotent)
# ---------------------------------------------------------------------------
echo "--- Création des data tables de logs ---"
node /home/node/provisioning/seed-datatables.js || echo "seed data tables: échec"

# ---------------------------------------------------------------------------
# 3. Workflows
# ---------------------------------------------------------------------------
echo "--- Import des workflows ---"
for wf in /home/node/workflows/*.json; do
  [ -f "$wf" ] || continue
  echo "Import: $(basename "$wf")"
  n8n import:workflow --input="$wf" || echo "  (déjà existant ou erreur)"
done

echo "=== provisioning terminé ==="
echo "NOTE: active le workflow via le toggle de l'UI (http://localhost:5678)."
