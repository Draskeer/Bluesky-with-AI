"""
Fetcher RSS générique pour des sources d'actualité réputées (FR + EN).

But : enrichir la base de référence Qdrant avec des sources DIVERSES et
VÉRIFIÉES, afin que la vérification factuelle (RAG + NLI) dispose de preuves
pertinentes quelle que soit la langue / le sujet du post analysé.

Chaque source est un flux RSS public et stable. On garde uniquement des médias
d'information à fort niveau de vérification éditoriale (pas d'opinion/partisan).
Le format de sortie est identique aux autres fetchers (id uuid5 d'URL -> dédup).
"""

import logging
import re
import uuid

import feedparser

logger = logging.getLogger(__name__)

# (nom_source, catégorie, url_rss) — ~135 médias de référence FR + EN, multi-pays
# (UK, US, CA, AU, NZ, IE, IN, ZA, SG ; FR, BE, CH, LU, QC, Maghreb, Afrique, Liban).
# Tous vérifiés actifs (renvoient des articles) via feedparser dans le conteneur.
# La dédup se fait par UUID d'URL d'article (un même article repris par
# plusieurs flux n'est stocké qu'une fois) — utile pour le score de corroboration.
RSS_SOURCES: list[tuple[str, str, str]] = [
    # --- International / Anglais ---
    ("The Economist", "international", "https://www.economist.com/international/rss.xml"),
    ("Deutsche Welle EN", "world", "https://rss.dw.com/rdf/rss-en-all"),
    ("Deutsche Welle Top", "world", "https://rss.dw.com/atom/rss-en-top"),
    ("Reuters via GNews", "world", "https://news.google.com/rss/search?q=site:reuters.com+when:2d&hl=en-US&gl=US&ceid=US:en"),
    ("AP via GNews", "world", "https://news.google.com/rss/search?q=site:apnews.com+when:2d&hl=en-US&gl=US&ceid=US:en"),
    ("Bloomberg via GNews", "business", "https://news.google.com/rss/search?q=site:bloomberg.com+when:2d&hl=en-US&gl=US&ceid=US:en"),
    ("The Independent", "world", "https://www.independent.co.uk/news/world/rss"),
    ("BBC Politics", "politics", "https://feeds.bbci.co.uk/news/politics/rss.xml"),
    ("NYT World", "world", "https://rss.nytimes.com/services/xml/rss/nyt/World.xml"),
    ("NYT Politics", "politics", "https://rss.nytimes.com/services/xml/rss/nyt/Politics.xml"),
    ("Washington Post World", "world", "https://feeds.washingtonpost.com/rss/world"),
    ("CNN", "world", "http://rss.cnn.com/rss/edition.rss"),
    ("CNN World", "world", "http://rss.cnn.com/rss/edition_world.rss"),
    ("Sky News World", "world", "https://feeds.skynews.com/feeds/rss/world.xml"),
    ("Sky News Home", "news", "https://feeds.skynews.com/feeds/rss/home.xml"),
    ("NBC News", "news", "http://feeds.nbcnews.com/nbcnews/public/news"),
    ("CBS News World", "world", "https://www.cbsnews.com/latest/rss/world"),
    ("ABC News Intl", "world", "https://abcnews.go.com/abcnews/internationalheadlines"),
    ("Fox News", "news", "https://moxie.foxnews.com/google-publisher/latest.xml"),
    ("Fox News Monde", "world", "https://moxie.foxnews.com/google-publisher/world.xml"),
    ("The Hill", "politics", "https://thehill.com/news/feed/"),
    ("Politico", "politics", "https://rss.politico.com/politics-news.xml"),
    ("Time", "news", "https://time.com/feed/"),
    ("Newsweek", "news", "https://www.newsweek.com/rss"),
    ("The Atlantic", "news", "https://www.theatlantic.com/feed/all/"),
    ("Vox", "news", "https://www.vox.com/rss/index.xml"),
    ("Axios", "news", "https://api.axios.com/feed/"),
    ("Business Insider", "business", "https://www.businessinsider.com/rss"),
    ("CNBC World", "business", "https://www.cnbc.com/id/100727362/device/rss/rss.html"),
    ("Wired", "tech", "https://www.wired.com/feed/rss"),
    ("The Verge", "tech", "https://www.theverge.com/rss/index.xml"),
    ("The Conversation", "news", "https://theconversation.com/global/articles.atom"),
    ("PBS NewsHour", "news", "https://www.pbs.org/newshour/feeds/rss/headlines"),
    ("NPR News", "news", "https://feeds.npr.org/1001/rss.xml"),
    ("NPR World", "world", "https://feeds.npr.org/1004/rss.xml"),
    ("The Guardian World", "world", "https://www.theguardian.com/world/rss"),
    ("The Guardian US", "us", "https://www.theguardian.com/us-news/rss"),
    ("The Guardian Politics", "politics", "https://www.theguardian.com/politics/rss"),
    ("The Guardian Env", "environment", "https://www.theguardian.com/environment/rss"),
    ("Al Jazeera", "world", "https://www.aljazeera.com/xml/rss/all.xml"),
    ("Euronews EN", "news", "https://www.euronews.com/rss?format=mrss&level=theme&name=news"),
    ("France24 EN", "world", "https://www.france24.com/en/rss"),
    ("RTE News", "news", "https://www.rte.ie/feeds/rss/?index=/news/"),
    ("SCMP", "world", "https://www.scmp.com/rss/91/feed"),
    ("Times of India", "world", "https://timesofindia.indiatimes.com/rssfeedstopstories.cms"),
    ("ABC Australia", "world", "https://www.abc.net.au/news/feed/51120/rss.xml"),
    ("UN News", "world", "https://news.un.org/feed/subscribe/en/news/all/rss.xml"),
    ("The Local FR", "france", "https://www.thelocal.fr/feeds/rss.php"),
    # --- Français ---
    ("Le Monde", "une", "https://www.lemonde.fr/rss/une.xml"),
    ("Le Monde International", "international", "https://www.lemonde.fr/international/rss_full.xml"),
    ("Le Figaro", "actualites", "https://www.lefigaro.fr/rss/figaro_actualites.xml"),
    ("Le Figaro International", "international", "https://www.lefigaro.fr/rss/figaro_international.xml"),
    ("Le Figaro Eco", "economie", "https://www.lefigaro.fr/rss/figaro_economie.xml"),
    ("Le Parisien", "une", "https://feeds.leparisien.fr/leparisien/rss"),
    ("BFMTV", "news", "https://www.bfmtv.com/rss/news-24-7/"),
    ("BFMTV International", "international", "https://www.bfmtv.com/rss/international/"),
    ("France 24", "monde", "https://www.france24.com/fr/rss"),
    ("Franceinfo", "titres", "https://www.franceinfo.fr/titres.rss"),
    ("France Info Monde", "monde", "https://www.francetvinfo.fr/monde.rss"),
    ("RFI", "monde", "https://www.rfi.fr/fr/rss"),
    ("RFI Afrique", "afrique", "https://www.rfi.fr/fr/afrique/rss"),
    ("Libération", "une", "https://www.liberation.fr/arc/outboundfeeds/rss/?outputType=xml"),
    ("L'Express", "alaune", "https://www.lexpress.fr/rss/alaune.xml"),
    ("Le Nouvel Obs", "une", "https://www.nouvelobs.com/rss.xml"),
    ("Le HuffPost", "actualites", "https://www.huffingtonpost.fr/feeds/index.xml"),
    ("La Tribune", "economie", "https://www.latribune.fr/rss/rubriques/actualite.html"),
    ("Courrier International", "monde", "https://www.courrierinternational.com/feed/all/rss.xml"),
    ("Mediapart", "une", "https://www.mediapart.fr/articles/feed"),
    ("Slate FR", "une", "https://www.slate.fr/rss.xml"),
    ("20 Minutes", "une", "https://www.20minutes.fr/feeds/rss-une.xml"),
    ("20 Minutes Monde", "monde", "https://www.20minutes.fr/feeds/rss-monde.xml"),
    ("Ouest-France", "une", "https://www.ouest-france.fr/rss/une"),
    ("Sud Ouest", "une", "https://www.sudouest.fr/rss.xml"),
    ("La Dépêche", "une", "https://www.ladepeche.fr/rss.xml"),
    ("Nice-Matin", "une", "https://www.nicematin.com/rss"),
    ("Euronews FR", "monde", "https://fr.euronews.com/rss"),
    # --- Francophone (BE / CH / CA) ---
    ("RTBF", "une", "https://rss.rtbf.be/article/rss/highlight_rtbf_info.xml"),
    ("La Libre", "une", "https://www.lalibre.be/arc/outboundfeeds/rss/?outputType=xml"),
    ("Le Temps", "monde", "https://www.letemps.ch/articles.rss"),
    ("Le Devoir", "une", "https://www.ledevoir.com/rss/manchettes.xml"),
    ("Radio-Canada", "une", "https://ici.radio-canada.ca/rss/4159"),

    # ===== Élargissement multi-pays (2026-06-24, tous testés actifs dans le conteneur) =====
    # Médias bloquant l'UA du conteneur (Cloudflare) servis via Google News (site:),
    # comme Reuters/AP plus haut. Dédup par UUID d'URL d'article.
    # --- Anglophone : Royaume-Uni ---
    ("BBC World", "world", "https://feeds.bbci.co.uk/news/world/rss.xml"),
    ("BBC Business", "business", "https://feeds.bbci.co.uk/news/business/rss.xml"),
    ("The Telegraph", "news", "https://www.telegraph.co.uk/rss.xml"),
    ("Evening Standard", "news", "https://www.standard.co.uk/rss"),
    ("Channel 4 News", "news", "https://www.channel4.com/news/feed"),
    ("Metro UK", "news", "https://metro.co.uk/feed/"),
    ("The Mirror", "news", "https://www.mirror.co.uk/news/?service=rss"),
    # --- Anglophone : États-Unis ---
    ("USA Today", "us", "https://news.google.com/rss/search?q=site:usatoday.com+when:3d&hl=en&gl=US&ceid=US:en"),
    ("LA Times World", "world", "https://www.latimes.com/world-nation/rss2.0.xml"),
    ("ProPublica", "news", "https://www.propublica.org/feeds/propublica/main"),
    ("Christian Science Monitor", "world", "https://rss.csmonitor.com/feeds/world"),
    ("NPR Politics", "politics", "https://feeds.npr.org/1014/rss.xml"),
    ("Wall Street Journal World", "world", "https://feeds.a.dj.com/rss/RSSWorldNews.xml"),
    # --- Anglophone : Canada ---
    ("CBC", "canada", "https://news.google.com/rss/search?q=site:cbc.ca+when:3d&hl=en&gl=CA&ceid=CA:en"),
    ("CTV News", "canada", "https://news.google.com/rss/search?q=site:ctvnews.ca+when:3d&hl=en&gl=CA&ceid=CA:en"),
    ("Globe and Mail", "canada", "https://news.google.com/rss/search?q=site:theglobeandmail.com+when:3d&hl=en&gl=CA&ceid=CA:en"),
    ("Global News", "news", "https://globalnews.ca/feed/"),
    ("National Post", "news", "https://nationalpost.com/feed/"),
    # --- Anglophone : Australie / Nouvelle-Zélande ---
    ("Sydney Morning Herald", "world", "https://www.smh.com.au/rss/world.xml"),
    ("The Age", "news", "https://www.theage.com.au/rss/feed.xml"),
    ("Guardian Australia", "australia", "https://www.theguardian.com/australia-news/rss"),
    ("SBS News", "news", "https://www.sbs.com.au/news/feed"),
    ("RNZ", "world", "https://www.rnz.co.nz/rss/world.xml"),
    ("NZ Herald", "world", "https://www.nzherald.co.nz/arc/outboundfeeds/rss/section/world/?outputType=xml"),
    # --- Anglophone : Irlande / Inde / Afrique du Sud / Asie ---
    ("Irish Times", "world", "https://www.irishtimes.com/cmlink/news-1.1319192"),
    ("The Hindu", "world", "https://www.thehindu.com/news/international/feeder/default.rss"),
    ("Indian Express", "inde", "https://news.google.com/rss/search?q=site:indianexpress.com+when:3d&hl=en&gl=IN&ceid=IN:en"),
    ("NDTV World", "world", "https://feeds.feedburner.com/ndtvnews-world-news"),
    ("News24 SA", "afriquesud", "https://news.google.com/rss/search?q=site:news24.com+when:3d&hl=en&gl=ZA&ceid=ZA:en"),
    ("Mail & Guardian", "afriquesud", "https://news.google.com/rss/search?q=site:mg.co.za+when:3d&hl=en&gl=ZA&ceid=ZA:en"),
    ("Straits Times World", "world", "https://www.straitstimes.com/news/world/rss.xml"),
    ("Channel News Asia", "world", "https://www.channelnewsasia.com/rssfeeds/8395986"),
    # --- Francophone : France (compléments) ---
    ("Le Point", "monde", "https://news.google.com/rss/search?q=site:lepoint.fr+when:3d&hl=fr&gl=FR&ceid=FR:fr"),
    ("Les Echos", "economie", "https://news.google.com/rss/search?q=site:lesechos.fr+when:3d&hl=fr&gl=FR&ceid=FR:fr"),
    ("La Croix", "monde", "https://news.google.com/rss/search?q=site:la-croix.com+when:3d&hl=fr&gl=FR&ceid=FR:fr"),
    ("Marianne", "une", "https://news.google.com/rss/search?q=site:marianne.net+when:3d&hl=fr&gl=FR&ceid=FR:fr"),
    ("France Culture", "actu", "https://www.radiofrance.fr/franceculture/rss"),
    # --- Francophone : Belgique / Suisse / Luxembourg ---
    ("Le Soir", "belgique", "https://news.google.com/rss/search?q=site:lesoir.be+when:3d&hl=fr&gl=BE&ceid=BE:fr"),
    ("L'Avenir", "belgique", "https://www.lavenir.net/arc/outboundfeeds/rss/?outputType=xml"),
    ("RTS Info", "suisse", "https://news.google.com/rss/search?q=site:rts.ch+when:3d&hl=fr&gl=CH&ceid=CH:fr"),
    ("Swissinfo", "suisse", "https://news.google.com/rss/search?q=site:swissinfo.ch+when:3d&hl=fr&gl=CH&ceid=CH:fr"),
    ("Tribune de Genève", "suisse", "https://news.google.com/rss/search?q=site:tdg.ch+when:3d&hl=fr&gl=CH&ceid=CH:fr"),
    ("Le Quotidien LU", "luxembourg", "https://lequotidien.lu/feed/"),
    # --- Francophone : Canada / Québec ---
    ("La Presse", "actualites", "https://www.lapresse.ca/actualites/rss"),
    ("Journal de Montréal", "actualite", "https://www.journaldemontreal.com/actualite/rss.xml"),
    ("Radio-Canada Intl", "international", "https://ici.radio-canada.ca/rss/4163"),
    # --- Francophone : Afrique / Maghreb / Moyen-Orient ---
    ("Jeune Afrique", "afrique", "https://www.jeuneafrique.com/feed/"),
    ("TV5Monde Info", "monde", "https://information.tv5monde.com/rss.xml"),
    ("Le360 Maroc", "maroc", "https://news.google.com/rss/search?q=site:le360.ma+when:3d&hl=fr&gl=MA&ceid=MA:fr"),
    ("TSA Algérie", "algerie", "https://www.tsa-algerie.com/feed/"),
    ("Actualité CD", "rdc", "https://actualite.cd/feed"),
    ("L'Orient-Le Jour", "liban", "https://news.google.com/rss/search?q=site:lorientlejour.com+when:3d&hl=fr&gl=LB&ceid=LB:fr"),
]

_TAG_RE = re.compile(r"<[^>]+>")


def _clean(text: str) -> str:
    """Retire le HTML et normalise les espaces (meilleures prémisses NLI)."""
    return _TAG_RE.sub("", text or "").replace("\xa0", " ").strip()


def fetch_rss_sources() -> list[dict]:
    articles: list[dict] = []
    seen_ids: set[str] = set()

    for source, category, feed_url in RSS_SOURCES:
        try:
            feed = feedparser.parse(feed_url)
            count = 0
            for entry in feed.entries:
                url = entry.get("link", "").strip()
                if not url:
                    continue

                article_id = str(uuid.uuid5(uuid.NAMESPACE_URL, url))
                if article_id in seen_ids:
                    continue
                seen_ids.add(article_id)

                title = _clean(entry.get("title", ""))
                summary = _clean(entry.get("summary", ""))
                if not title:
                    continue

                articles.append(
                    {
                        "id": article_id,
                        "url": url,
                        "title": title,
                        "summary": summary,
                        "content": f"{title}. {summary}".strip(". "),
                        "source": source,
                        "category": category,
                        "published": entry.get("published", ""),
                    }
                )
                count += 1
            logger.info(f"RSS {source}: {count} articles")
        except Exception as exc:
            logger.error(f"Error fetching RSS '{source}': {exc}")

    return articles
