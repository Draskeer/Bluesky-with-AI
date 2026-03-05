"""
Fetches top headlines from NewsAPI (https://newsapi.org/).

Free dev plan constraints:
  - 10 requests / day
  - Articles delayed 24 h
  - 1 month history

This module enforces a daily cap of MAX_DAILY_REQUESTS (8) to stay safely
under the limit. Usage is tracked in a JSON file on the /data volume so it
survives container restarts.
"""

import json
import logging
import os
import uuid
from datetime import date
from pathlib import Path

logger = logging.getLogger(__name__)

_USAGE_FILE = Path("/data/newsapi_usage.json")
MAX_DAILY_REQUESTS = 8  # leave 2 requests as buffer under the 10/day limit


# ---------------------------------------------------------------------------
# Rate-limit helpers
# ---------------------------------------------------------------------------


def _load_usage() -> dict:
    if _USAGE_FILE.exists():
        try:
            data = json.loads(_USAGE_FILE.read_text())
            if data.get("date") == str(date.today()):
                return data
        except Exception:
            pass
    return {"date": str(date.today()), "count": 0}


def _save_usage(usage: dict) -> None:
    _USAGE_FILE.parent.mkdir(parents=True, exist_ok=True)
    _USAGE_FILE.write_text(json.dumps(usage))


# ---------------------------------------------------------------------------
# Fetcher
# ---------------------------------------------------------------------------


def fetch_newsapi() -> list[dict]:
    api_key = os.getenv("NEWSAPI_KEY", "").strip()
    if not api_key:
        return []

    usage = _load_usage()
    if usage["count"] >= MAX_DAILY_REQUESTS:
        logger.info(
            f"NewsAPI daily cap reached ({usage['count']}/{MAX_DAILY_REQUESTS}), skipping."
        )
        return []

    try:
        from newsapi import NewsApiClient

        client = NewsApiClient(api_key=api_key)
        response = client.get_top_headlines(language="en", page_size=100)

        usage["count"] += 1
        _save_usage(usage)
        logger.info(f"NewsAPI request #{usage['count']}/{MAX_DAILY_REQUESTS} today.")

        articles: list[dict] = []
        for item in response.get("articles", []):
            url = (item.get("url") or "").strip()
            if not url:
                continue

            title = item.get("title") or ""
            description = item.get("description") or ""
            content = item.get("content") or ""

            articles.append(
                {
                    "id": str(uuid.uuid5(uuid.NAMESPACE_URL, url)),
                    "url": url,
                    "title": title,
                    "summary": description,
                    "content": f"{title}. {description} {content}".strip(),
                    "source": (item.get("source") or {}).get("name") or "NewsAPI",
                    "category": "general",
                    "published": item.get("publishedAt") or "",
                }
            )

        return articles

    except Exception as exc:
        logger.error(f"NewsAPI fetch error: {exc}")
        return []
