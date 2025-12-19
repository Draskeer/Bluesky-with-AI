#!/bin/bash

# Script pour exporter les entities n8n (incluant les data tables)
# Exécutez ce script après avoir créé vos data tables dans l'interface n8n

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENTITIES_DIR="${SCRIPT_DIR}/entities"

echo "=== Export des entities n8n ==="

# Créer le dossier entities s'il n'existe pas
mkdir -p "$ENTITIES_DIR"

# Exporter les entities depuis le conteneur n8n
echo "Export en cours..."
docker exec n8n n8n export:entities --outputDir=/tmp/n8n-export

# Copier le fichier zip depuis le conteneur
echo "Copie des fichiers..."
docker cp n8n:/tmp/n8n-export/entities.zip "$ENTITIES_DIR/"

# Extraire le contenu
cd "$ENTITIES_DIR"
unzip -o entities.zip
rm entities.zip

echo ""
echo "=== Export terminé ==="
echo "Les fichiers ont été exportés dans: $ENTITIES_DIR"
echo ""
echo "Contenu exporté:"
ls -la "$ENTITIES_DIR"
echo ""
echo "Ces fichiers seront automatiquement importés lors du prochain démarrage de n8n."
