"""
Generates sentence embeddings using fastembed (ONNX-based, no PyTorch needed).

Model: sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2
  - 384-dimensional vectors
  - multilingue (FR + EN + ~50 langues) -> récupération cross-langue correcte
  - léger (~0.22 GB) et rapide en CPU : tient dans l'enveloppe mémoire Docker
    partagée (e5-large 2.2 GB faisait planter le conteneur en OOM).

Modèle "paraphrase" symétrique : PAS de préfixe query:/passage: (contrairement
à e5). On embed le texte brut des deux côtés (news indexées et message requête).

Le modèle est pré-téléchargé à l'étape de build Docker (offline au runtime).
"""

import logging
import os

os.environ.setdefault("FASTEMBED_CACHE_PATH", "/app/models")

from fastembed import TextEmbedding  # noqa: E402 — must come after env var is set

logger = logging.getLogger(__name__)

MODEL_NAME = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
VECTOR_SIZE = 384  # must match the Qdrant collection config in store.py

_model: TextEmbedding | None = None


def _get_model() -> TextEmbedding:
    global _model
    if _model is None:
        logger.info(f"Loading embedding model '{MODEL_NAME}'...")
        _model = TextEmbedding(model_name=MODEL_NAME)
        logger.info("Embedding model ready.")
    return _model


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Embeds une requête (message entrant) dans le même espace que les articles.

    Utilisé par l'endpoint /embed pour que le pipeline n8n recherche le message
    dans le *même* espace vectoriel que les news indexées (RAG correct).
    """
    if not texts:
        return []
    model = _get_model()
    return [vector.tolist() for vector in model.embed(texts)]


def embed_articles(articles: list[dict]) -> list[dict]:
    """Adds an 'embedding' key (list[float]) to each article dict in-place."""
    if not articles:
        return []

    model = _get_model()
    texts = [a.get("content") or a.get("title") or "" for a in articles]
    embeddings = list(model.embed(texts))

    for article, vector in zip(articles, embeddings):
        article["embedding"] = vector.tolist()

    return articles
