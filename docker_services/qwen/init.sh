QDRANT_URL="${QDRANT_URL:-http://localhost:6333}"
QDRANT_API_KEY="${QDRANT_API_KEY:-}"
COLLECTION_NAME="news_articles"

echo "🚀 Création de la collection '$COLLECTION_NAME' sur $QDRANT_URL..."

curl -X PUT "$QDRANT_URL/collections/$COLLECTION_NAME" \
  -H "Content-Type: application/json" \
  -H "api-key: $QDRANT_API_KEY" \
  -d '{
    "vectors": {
      "size": 384,
      "distance": "Cosine"
    },
    "optimizers_config": {
      "default_segment_number": 2
    },
    "replication_factor": 1
  }'

echo ""
echo "📌 Création des index de payload pour les filtres..."

# Index sur la catégorie (politique, finance, tech)
curl -X PUT "$QDRANT_URL/collections/$COLLECTION_NAME/index" \
  -H "Content-Type: application/json" \
  -H "api-key: $QDRANT_API_KEY" \
  -d '{
    "field_name": "category",
    "field_schema": "keyword"
  }'

# Index sur la source
curl -X PUT "$QDRANT_URL/collections/$COLLECTION_NAME/index" \
  -H "Content-Type: application/json" \
  -H "api-key: $QDRANT_API_KEY" \
  -d '{
    "field_name": "source",
    "field_schema": "keyword"
  }'

# Index sur la date de publication
curl -X PUT "$QDRANT_URL/collections/$COLLECTION_NAME/index" \
  -H "Content-Type: application/json" \
  -H "api-key: $QDRANT_API_KEY" \
  -d '{
    "field_name": "published_at",
    "field_schema": "datetime"
  }'

echo ""
echo "✅ Collection '$COLLECTION_NAME' prête !"

# ── fake_reports : signalements communautaires (384-dim, cosine) ──────────────
FAKE_COLLECTION="fake_reports"
echo ""
echo "🚀 Création de la collection '$FAKE_COLLECTION'..."
curl -s -X GET "$QDRANT_URL/collections/$FAKE_COLLECTION" \
  -H "api-key: $QDRANT_API_KEY" | grep -q '"status"' \
  && echo "  (déjà existante — skip)" \
  || curl -X PUT "$QDRANT_URL/collections/$FAKE_COLLECTION" \
       -H "Content-Type: application/json" \
       -H "api-key: $QDRANT_API_KEY" \
       -d '{
         "vectors": { "size": 384, "distance": "Cosine" },
         "optimizers_config": { "default_segment_number": 2 },
         "replication_factor": 1
       }' && echo "" && echo "✅ Collection '$FAKE_COLLECTION' prête !"

echo ""
echo "Variables d'environnement à configurer dans n8n :"
echo "  QDRANT_URL=$QDRANT_URL"