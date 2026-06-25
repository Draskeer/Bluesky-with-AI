"""
Handles all Qdrant operations: connection, collection creation, and upserting.

Deduplication strategy
----------------------
Each article has a deterministic UUID derived from its URL (uuid5).
Before upserting, we retrieve all matching IDs from Qdrant and skip any that
already exist.  This means re-running the scheduler never creates duplicates,
even if the same article appears across multiple BBC categories or NewsAPI pages.
"""

import logging
import os
import time

from qdrant_client import QdrantClient
from qdrant_client.models import Distance, PointStruct, VectorParams

logger = logging.getLogger(__name__)

COLLECTION_NAME = "news_articles"
VECTOR_SIZE = 384  # must match embedder.py (paraphrase-multilingual-MiniLM-L12-v2)


# ---------------------------------------------------------------------------
# Client factory
# ---------------------------------------------------------------------------


def _get_client() -> QdrantClient:
    return QdrantClient(
        host=os.getenv("QDRANT_HOST", "qdrant"),
        port=int(os.getenv("QDRANT_PORT", "6333")),
        api_key=os.getenv("QDRANT_API_KEY") or None,
        https=False,  # Qdrant runs plain HTTP inside Docker; api_key would otherwise force TLS
        prefer_grpc=False,
        timeout=30,
    )


# ---------------------------------------------------------------------------
# Startup wait
# ---------------------------------------------------------------------------


def wait_for_qdrant(max_retries: int = 30, delay: int = 10) -> bool:
    """Block until Qdrant is reachable or the retry budget is exhausted."""
    for attempt in range(1, max_retries + 1):
        try:
            _get_client().get_collections()
            logger.info("Connected to Qdrant.")
            return True
        except Exception:
            logger.info(f"Waiting for Qdrant... ({attempt}/{max_retries})")
            time.sleep(delay)
    return False


# ---------------------------------------------------------------------------
# Collection management
# ---------------------------------------------------------------------------


def _ensure_collection(client: QdrantClient) -> None:
    existing = {c.name for c in client.get_collections().collections}

    if COLLECTION_NAME in existing:
        # Si la dimension stockée ne correspond plus (changement de modèle
        # d'embedding), on recrée la collection : mélanger des vecteurs de
        # tailles/espaces différents rendrait la recherche incohérente.
        try:
            info = client.get_collection(COLLECTION_NAME)
            current = info.config.params.vectors.size
        except Exception:
            current = None
        if current == VECTOR_SIZE:
            return
        logger.warning(
            f"Collection '{COLLECTION_NAME}' a une dimension {current} != {VECTOR_SIZE} "
            f"-> recréation (ré-embedding complet)."
        )
        client.delete_collection(COLLECTION_NAME)

    client.create_collection(
        collection_name=COLLECTION_NAME,
        vectors_config=VectorParams(size=VECTOR_SIZE, distance=Distance.COSINE),
    )
    logger.info(f"Created Qdrant collection '{COLLECTION_NAME}' (size={VECTOR_SIZE}).")


# ---------------------------------------------------------------------------
# Upsert with deduplication
# ---------------------------------------------------------------------------


def store_articles(articles: list[dict]) -> int:
    """
    Store articles that have an embedding.  Returns the number of *new*
    articles inserted (duplicates are silently skipped).
    """
    articles = [a for a in articles if a.get("embedding")]
    if not articles:
        return 0

    client = _get_client()
    _ensure_collection(client)

    ids = [a["id"] for a in articles]

    # Retrieve existing point IDs in one round-trip
    existing_ids: set[str] = set()
    try:
        results = client.retrieve(
            collection_name=COLLECTION_NAME,
            ids=ids,
            with_payload=False,
            with_vectors=False,
        )
        existing_ids = {str(p.id) for p in results}
    except Exception as exc:
        logger.warning(
            f"Could not pre-check existing points: {exc}. Proceeding with upsert."
        )

    new_articles = [a for a in articles if a["id"] not in existing_ids]
    if not new_articles:
        return 0

    points = [
        PointStruct(
            id=a["id"],
            vector=a["embedding"],
            payload={
                "url": a["url"],
                "title": a["title"],
                "summary": a["summary"],
                "source": a["source"],
                "category": a["category"],
                "published": a["published"],
            },
        )
        for a in new_articles
    ]

    client.upsert(collection_name=COLLECTION_NAME, points=points)
    return len(points)
