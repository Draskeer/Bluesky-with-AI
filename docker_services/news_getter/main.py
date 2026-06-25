import logging
import os
import threading
import time

import schedule
import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from embedder import embed_articles, embed_texts
from fetchers.bbc import fetch_bbc_news
from fetchers.newsapi_fetcher import fetch_newsapi
from fetchers.rss_generic import fetch_rss_sources
from store import store_articles, wait_for_qdrant

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

# 2.5 hours = 150 minutes (overridable via env var)
INTERVAL_MINUTES = int(os.getenv("INTERVAL_MINUTES", "150"))
# Port exposed for the embedding API consumed by the n8n pipeline
EMBED_API_PORT = int(os.getenv("EMBED_API_PORT", "8001"))


def fetch_and_store() -> None:
    logger.info("=== Starting news fetch cycle ===")
    articles = []

    # BBC News via public RSS feeds (runs every cycle — no rate limit)
    bbc_articles = fetch_bbc_news()
    articles.extend(bbc_articles)
    logger.info(f"BBC: {len(bbc_articles)} articles fetched")

    # Sources de référence diverses FR + EN (RSS publics, sans rate limit)
    rss_articles = fetch_rss_sources()
    articles.extend(rss_articles)
    logger.info(f"RSS multi-sources: {len(rss_articles)} articles fetched")

    # NewsAPI (capped at 8 requests/day to stay safely under the 10 req/day free limit)
    newsapi_articles = fetch_newsapi()
    articles.extend(newsapi_articles)
    if newsapi_articles:
        logger.info(f"NewsAPI: {len(newsapi_articles)} articles fetched")

    if not articles:
        logger.info("No articles fetched this cycle.")
        return

    articles = embed_articles(articles)
    new_count = store_articles(articles)
    skipped = len(articles) - new_count
    logger.info(f"Stored {new_count} new articles (skipped {skipped} duplicates)")
    logger.info("=== Cycle complete ===")


def run_scheduler() -> None:
    """Background loop: initial fetch then periodic refresh of the news index."""
    if not wait_for_qdrant():
        logger.error("Could not connect to Qdrant after multiple retries. Scheduler disabled.")
        return

    fetch_and_store()
    schedule.every(INTERVAL_MINUTES).minutes.do(fetch_and_store)
    logger.info(f"Scheduler active — next run in {INTERVAL_MINUTES} minutes")

    while True:
        schedule.run_pending()
        time.sleep(30)


# ---------------------------------------------------------------------------
# Embedding API (consumed by the n8n message pipeline for RAG search)
# ---------------------------------------------------------------------------

app = FastAPI(title="news_getter embedding API")


class EmbedRequest(BaseModel):
    text: str | None = None
    texts: list[str] | None = None


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/embed")
def embed(req: EmbedRequest):
    """Embed a message in the same vector space as the stored news articles.

    Accepts {"text": "..."} (single) or {"texts": [...]} (batch).
    Returns the 384-d bge vector(s) for a Qdrant search against `news_articles`.
    """
    if req.text is not None:
        vectors = embed_texts([req.text])
        return {"vector": vectors[0], "size": len(vectors[0])}
    if req.texts:
        vectors = embed_texts(req.texts)
        return {"vectors": vectors, "size": len(vectors[0]) if vectors else 0}
    raise HTTPException(status_code=400, detail="'text' ou 'texts' requis")


if __name__ == "__main__":
    logger.info("News getter starting up...")

    # Scheduler runs in the background; the embedding API runs in the foreground.
    threading.Thread(target=run_scheduler, daemon=True).start()

    logger.info(f"Embedding API listening on 0.0.0.0:{EMBED_API_PORT}")
    uvicorn.run(app, host="0.0.0.0", port=EMBED_API_PORT)
