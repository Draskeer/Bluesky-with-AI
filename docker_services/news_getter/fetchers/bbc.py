"""
Fetches news from BBC public RSS feeds.

BBC provides free, unauthenticated RSS feeds for all major categories.
Each article gets a deterministic UUID derived from its URL so duplicates
are detected reliably across runs.
"""

import logging
import uuid

import feedparser

logger = logging.getLogger(__name__)

# BBC public RSS feeds — stable and unauthenticated
BBC_FEEDS: list[tuple[str, str]] = [
    ("world", "http://feeds.bbci.co.uk/news/world/rss.xml"),
    ("uk", "http://feeds.bbci.co.uk/news/uk/rss.xml"),
    ("technology", "http://feeds.bbci.co.uk/news/technology/rss.xml"),
    ("science", "http://feeds.bbci.co.uk/news/science_and_environment/rss.xml"),
    ("business", "http://feeds.bbci.co.uk/news/business/rss.xml"),
]


def fetch_bbc_news() -> list[dict]:
    articles: list[dict] = []
    seen_ids: set[str] = set()

    for category, feed_url in BBC_FEEDS:
        try:
            feed = feedparser.parse(feed_url)
            for entry in feed.entries:
                url = entry.get("link", "").strip()
                if not url:
                    continue

                # Deterministic UUID from the canonical URL
                article_id = str(uuid.uuid5(uuid.NAMESPACE_URL, url))
                if article_id in seen_ids:
                    continue
                seen_ids.add(article_id)

                title = entry.get("title", "")
                summary = entry.get("summary", "")
                articles.append(
                    {
                        "id": article_id,
                        "url": url,
                        "title": title,
                        "summary": summary,
                        # Combined text used for embedding
                        "content": f"{title}. {summary}".strip(". "),
                        "source": "BBC News",
                        "category": category,
                        "published": entry.get("published", ""),
                    }
                )
        except Exception as exc:
            logger.error(f"Error fetching BBC '{category}' feed: {exc}")

    return articles
