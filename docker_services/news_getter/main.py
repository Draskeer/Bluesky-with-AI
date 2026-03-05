import logging
import os
import time

import schedule
from dotenv import load_dotenv

from embedder import embed_articles
from fetchers.bbc import fetch_bbc_news
from fetchers.newsapi_fetcher import fetch_newsapi
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


def fetch_and_store() -> None:
    logger.info("=== Starting news fetch cycle ===")
    articles = []

    # BBC News via public RSS feeds (runs every cycle — no rate limit)
    bbc_articles = fetch_bbc_news()
    articles.extend(bbc_articles)
    logger.info(f"BBC: {len(bbc_articles)} articles fetched")

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


if __name__ == "__main__":
    logger.info("News getter starting up...")

    if not wait_for_qdrant():
        logger.error("Could not connect to Qdrant after multiple retries. Exiting.")
        raise SystemExit(1)

    # Run once immediately on startup, then on schedule
    fetch_and_store()

    schedule.every(INTERVAL_MINUTES).minutes.do(fetch_and_store)
    logger.info(f"Scheduler active — next run in {INTERVAL_MINUTES} minutes")

    while True:
        schedule.run_pending()
        time.sleep(30)
