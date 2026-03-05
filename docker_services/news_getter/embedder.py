"""
Generates sentence embeddings using fastembed (ONNX-based, no PyTorch needed).

Model: BAAI/bge-small-en-v1.5
  - 384-dimensional vectors
  - ~130 MB on disk
  - Fast CPU inference

The model is pre-downloaded during the Docker build step, so there is no
network access required at runtime.
"""

import logging
import os

os.environ.setdefault("FASTEMBED_CACHE_PATH", "/app/models")

from fastembed import TextEmbedding  # noqa: E402 — must come after env var is set

logger = logging.getLogger(__name__)

MODEL_NAME = "BAAI/bge-small-en-v1.5"
VECTOR_SIZE = 384  # must match the Qdrant collection config in store.py

_model: TextEmbedding | None = None


def _get_model() -> TextEmbedding:
    global _model
    if _model is None:
        logger.info(f"Loading embedding model '{MODEL_NAME}'...")
        _model = TextEmbedding(model_name=MODEL_NAME)
        logger.info("Embedding model ready.")
    return _model


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
