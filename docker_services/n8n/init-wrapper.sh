#!/bin/sh
# Wrapper n8n : demarre n8n, attend qu il soit pret, cree l owner, puis laisse tourner.
set -e

echo "[wrapper] Demarrage de n8n..."
n8n start &
N8N_PID=$!

echo "[wrapper] Attente du healthcheck n8n..."
until wget -qO /dev/null http://localhost:5678/healthz 2>/dev/null; do
  sleep 2
done

echo "[wrapper] n8n pret — creation du compte owner..."
node /home/node/provisioning/setup-owner.js

echo "[wrapper] Init terminee, n8n tourne (PID $N8N_PID)."
wait $N8N_PID