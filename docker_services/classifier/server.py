#!/usr/bin/env python3
"""
Service de classification (CPU, inférence seule).

Modèles :
  - /sentiment   : cardiffnlp/twitter-xlm-roberta-base-sentiment
                   → mood ∈ {positive, neutral, negative}

  - /topic       : cardiffnlp/tweet-topic-21-multi  (entraîné sur des tweets réels, 19 catégories)
                   + zero-shot NLI fallback si confiance tweet-topic < 0.50
                   + _FIRST_PERSON_OPINION_RE pour filtrer les opinions explicites à la 1ère personne
                   → checkable=true si sujet factuel (news/science/sport/business/santé)
                   → checkable=false sinon (opinion, perso) → sentiment seul

  - /verify      : MoritzLaurer/mDeBERTa-v3-base-xnli-multilingual-nli-2mil7
                   Compare le tweet aux news Qdrant → fake / real / unverified

Le LLM (Qwen) n'est appelé qu'en dernier recours sur les cas ambigus.
"""

import os
from typing import List, Optional

import torch
import torch.nn.functional as F
from fastapi import FastAPI
from pydantic import BaseModel
from transformers import (
    AutoModelForSequenceClassification,
    AutoTokenizer,
    pipeline,
)

torch.set_num_threads(int(os.getenv("TORCH_THREADS", "2")))

SENTIMENT_MODEL    = os.getenv("SENTIMENT_MODEL",    "cardiffnlp/twitter-xlm-roberta-base-sentiment")
NLI_MODEL          = os.getenv("NLI_MODEL",          "MoritzLaurer/mDeBERTa-v3-base-xnli-multilingual-nli-2mil7")
SUBJECTIVITY_MODEL = os.getenv("SUBJECTIVITY_MODEL", "")  # non utilisé — voir _is_opinion()
TOPIC_MODEL        = os.getenv("TOPIC_MODEL",        "cardiffnlp/tweet-topic-21-multi")

# ── Seuils NLI (fact-checking) ─────────────────────────────────────────────────
SIM_MIN      = float(os.getenv("SIM_MIN",      "0.50"))
NLI_HI       = float(os.getenv("NLI_HI",       "0.75"))
FAKE_MARGIN  = float(os.getenv("FAKE_MARGIN",  "0.15"))
MAX_ARTICLES = int(os.getenv("MAX_ARTICLES",   "12"))
ENTAIL_SOFT  = float(os.getenv("ENTAIL_SOFT",  "0.65"))
CORRO_MIN    = int(os.getenv("CORRO_MIN",      "4"))
COVERAGE_MIN = int(os.getenv("COVERAGE_MIN",   "5"))
ENABLE_LLM_ESCALATION = os.getenv("ENABLE_LLM_ESCALATION", "false").lower() == "true"

# ── Topics checkables (tweet-topic-21-multi) ───────────────────────────────────
# Ces catégories correspondent à des affirmations factuelles publiques vérifiables.
# Les autres (diaries, food, gaming, music…) → personnel/culturel → pas de fact-check.
TOPIC_CHECKABLE_LABELS = set(os.getenv(
    "TOPIC_CHECKABLE_LABELS",
    # "politics" n'existe pas dans tweet-topic-21 : la politique passe par news_&_social_concern
    "news_&_social_concern,science_&_technology,"
    "sports,business_&_entrepreneurs,fitness_&_health",
).split(","))

# Confiance mini du modèle topic pour accepter sa réponse (sinon → personal par défaut)
TOPIC_CONF_MIN = float(os.getenv("TOPIC_CONF_MIN", "0.10"))


# ── Chargement des modèles ─────────────────────────────────────────────────────

print(f"📦 Sentiment: {SENTIMENT_MODEL}...")
sentiment_pipe = pipeline(
    "sentiment-analysis",
    model=SENTIMENT_MODEL,
    tokenizer=SENTIMENT_MODEL,
    top_k=None,
    truncation=True,
    max_length=256,
)
print("✓ sentiment prêt")

print("📦 Opinion : regex premier-personne uniquement (tweet-topic gère le reste)")
print("✓ opinion filter prêt")

print(f"📦 Topic tweet: {TOPIC_MODEL}...")
topic_pipe = pipeline(
    "text-classification",
    model=TOPIC_MODEL,
    tokenizer=TOPIC_MODEL,
    top_k=None,
    truncation=True,
    max_length=256,
)
print("✓ topic prêt")

print(f"📦 NLI: {NLI_MODEL}...")
nli_tokenizer = AutoTokenizer.from_pretrained(NLI_MODEL)
nli_model     = AutoModelForSequenceClassification.from_pretrained(NLI_MODEL)
nli_model.eval()
NLI_ID2LABEL  = {int(k): v.lower() for k, v in nli_model.config.id2label.items()}
print(f"✓ NLI prêt  (labels: {NLI_ID2LABEL})")

# Zero-shot NLI : fallback topic pour les tweets quand tweet-topic est peu confiant
# (le modèle tweet-topic est entraîné sur l'anglais — peut dérailler sur le français)
print("📦 Zero-shot topic (fallback, réutilise NLI)...")
zeroshot_pipe = pipeline("zero-shot-classification", model=nli_model, tokenizer=nli_tokenizer)
ZEROSHOT_CHECKABLE = ["politique", "économie", "santé", "science", "actualité internationale", "société"]
ZEROSHOT_PERSONAL  = ["vie personnelle", "opinion personnelle", "conversation quotidienne", "humour"]
ZEROSHOT_LABELS    = ZEROSHOT_CHECKABLE + ZEROSHOT_PERSONAL
print("✓ zero-shot topic prêt")

# Seuil de confiance en dessous duquel on bascule vers le zero-shot NLI
TOPIC_FALLBACK_THRESHOLD = float(os.getenv("TOPIC_FALLBACK_THRESHOLD", "0.50"))

app = FastAPI(title="classifier")


# ── Schémas ────────────────────────────────────────────────────────────────────

class TopicRequest(BaseModel):
    text: str

class SentimentRequest(BaseModel):
    text: str

class Article(BaseModel):
    title:   Optional[str]   = ""
    summary: Optional[str]   = ""
    score:   Optional[float] = 0.0

class VerifyRequest(BaseModel):
    message:  str
    articles: List[Article] = []
    sim_min:  Optional[float] = None
    nli_hi:   Optional[float] = None


# ── Helpers ────────────────────────────────────────────────────────────────────

MOODS = {"positive", "neutral", "negative"}


def _nli(premise: str, hypothesis: str) -> dict:
    """Retourne {entailment, neutral, contradiction}."""
    inputs = nli_tokenizer(
        premise, hypothesis, truncation=True, max_length=256, return_tensors="pt"
    )
    with torch.no_grad():
        logits = nli_model(**inputs).logits[0]
    probs = F.softmax(logits, dim=-1).tolist()
    return {NLI_ID2LABEL[i]: float(probs[i]) for i in range(len(probs))}


import re as _re

# Marqueurs de premier personne / opinion explicite.
# Uniquement les cas où le tweet-topic ne peut pas trancher seul :
# "Je pense que Trump est nul" → topic=news (checkable) mais c'est clairement une opinion.
# On ne couvre QUE les marqueurs à très haute précision pour éviter les faux positifs.
_FIRST_PERSON_OPINION_RE = _re.compile(
    r"(?:"
    r"\bje\s+(?:pense|trouve|crois|d[eé]teste|adore|kiff)\b"
    r"|\b[aà]\s+mon\s+avis\b"
    r"|\bselon\s+moi\b"
    r"|\bd'apr[eè]s\s+moi\b"
    r"|\bpour\s+moi[,\s]"
    r"|\bpersonnellement\b"
    r"|\bj'en\s+peux\s+plus\b"
    r")",
    _re.IGNORECASE,
)


def _is_opinion(text: str) -> bool:
    """True uniquement si le texte contient un marqueur de premier personne / opinion.

    Le tweet-topic model (cardiffnlp/tweet-topic-21-multi) est responsable de détecter
    si un texte parle d'un sujet d'actualité (news, sport, science, business).
    Cette fonction ne sert qu'à filtrer les cas où le topic est checkable MAIS le texte
    est clairement une opinion à la première personne :
      "Je pense que Trump est le pire président" → topic=news → checkable → MAIS opinion.
      "Trump a emboché une autruche !!!"         → topic=news → checkable → PAS opinion.
      "SCOOP ! Ogive nucléaire interceptée !!!"  → topic=news → checkable → PAS opinion.
    """
    return bool(_FIRST_PERSON_OPINION_RE.search(text))


# ── Endpoints ──────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {
        "status":   "ok",
        "sentiment": SENTIMENT_MODEL,
        "topic":     TOPIC_MODEL,
        "nli":       NLI_MODEL,
        "opinion":   "first-person-regex (tweet-topic handles topic routing)",
    }


@app.post("/topic")
def topic(req: TopicRequest):
    """Gate de routage : le message est-il un fait vérifiable ?

    Étape 1 — tweet-topic-21-multi : classifie le sujet du tweet.
               Si confiance < 0.50, bascule vers zero-shot NLI avec labels français.
               Les catégories news/science/sport/business/santé → fact-checkable.

    Étape 2 — _is_opinion() : filtre les opinions explicites à la 1ère personne
               ("je pense", "à mon avis", "selon moi"…) même quand le topic est checkable.

    → checkable=true  : claim factuel → n8n enchaîne embed → Qdrant → /verify
    → checkable=false : opinion ou hors-actu → sentiment seul
    """
    text = (req.text or "").strip()
    if not text:
        return {"checkable": False, "topic": None, "confidence": 0.0, "scope": "personal"}

    # ── Étape 1 : classification du sujet ─────────────────────────────────────
    # Primaire : tweet-topic-21-multi (entraîné sur des vrais tweets)
    raw = topic_pipe(text)[0]
    raw_sorted = sorted(raw, key=lambda r: r["score"], reverse=True)
    top_label = raw_sorted[0]["label"]
    top_score = float(raw_sorted[0]["score"])

    # Fallback zero-shot NLI si le modèle tweet-topic est peu confiant
    # (fréquent sur des tweets français — le modèle est entraîné en anglais)
    if top_score < TOPIC_FALLBACK_THRESHOLD:
        zs = zeroshot_pipe(text, candidate_labels=ZEROSHOT_LABELS, multi_label=False)
        zs_top, zs_score = zs["labels"][0], float(zs["scores"][0])
        checkable = zs_top in ZEROSHOT_CHECKABLE
        top_label = zs_top
        top_score = zs_score
    else:
        checkable = (top_label in TOPIC_CHECKABLE_LABELS) and (top_score >= TOPIC_CONF_MIN)

    # ── Étape 2 : filtre opinion premier-personne ────────────────────────────
    opinion_detected = False
    if checkable:
        opinion_detected = _is_opinion(text)
        if opinion_detected:
            checkable = False

    return {
        "checkable":        checkable,
        "topic":            top_label,
        "confidence":       round(top_score, 4),
        "scope":            "global" if checkable else "personal",
        "opinion_detected": opinion_detected,
    }


@app.post("/sentiment")
def sentiment(req: SentimentRequest):
    text = (req.text or "").strip()
    if not text:
        return {"mood": "neutral", "confidence": 0.0}
    scores = sentiment_pipe(text)[0]
    best   = max(scores, key=lambda s: s["score"])
    mood   = best["label"].lower()
    if mood not in MOODS:
        mood = "neutral"
    return {"mood": mood, "confidence": round(float(best["score"]), 4)}


@app.post("/verify")
def verify(req: VerifyRequest):
    sim_min = req.sim_min if req.sim_min is not None else SIM_MIN
    nli_hi  = req.nli_hi  if req.nli_hi  is not None else NLI_HI
    message = (req.message or "").strip()

    relevant = sorted(
        [a for a in req.articles if (a.score or 0) >= sim_min],
        key=lambda a: a.score or 0,
        reverse=True,
    )[:MAX_ARTICLES]

    if not relevant:
        return {
            "verdict": "unverified", "is_fake": False, "confidence": 0.0,
            "needs_llm": False, "evidence_title": None, "reason": "no_related_news",
            "fake_score": 0.0, "real_score": 0.0,
        }

    best_contra = {"p": 0.0, "title": None}
    best_entail = {"p": 0.0, "title": None}
    n_support   = 0
    n_refute    = 0
    for a in relevant:
        premise = f"{a.title or ''}. {a.summary or ''}".strip()
        s = _nli(premise, message)
        e, c = s.get("entailment", 0.0), s.get("contradiction", 0.0)
        if e >= ENTAIL_SOFT:
            n_support += 1
        if c >= nli_hi:
            n_refute += 1
        if c > best_contra["p"]:
            best_contra = {"p": c, "title": a.title}
        if e > best_entail["p"]:
            best_entail = {"p": e, "title": a.title}

    total         = len(relevant)
    corroboration = round(n_support / total, 3) if total else 0.0
    extra = {
        "corroboration":  corroboration,
        "support":        n_support,
        "refute":         n_refute,
        "sources_checked": total,
    }

    fake_s = round(best_contra["p"], 4)
    real_s = round(best_entail["p"], 4)

    # FAKE : contradiction domine clairement
    if (n_refute > n_support
            and best_contra["p"] >= nli_hi
            and best_contra["p"] >= best_entail["p"] + FAKE_MARGIN):
        return {
            "verdict": "fake", "is_fake": True,
            "confidence": fake_s,
            "needs_llm": False, "evidence_title": best_contra["title"],
            "reason": "nli_contradiction",
            "fake_score": fake_s, "real_score": real_s, **extra,
        }

    # REAL : entailment fort ou corroboration multi-sources
    if best_entail["p"] >= nli_hi or n_support >= CORRO_MIN:
        return {
            "verdict": "real", "is_fake": False,
            "confidence": round(max(best_entail["p"], corroboration), 4),
            "needs_llm": False, "evidence_title": best_entail["title"],
            "reason": "corroborated" if n_support >= CORRO_MIN else "nli_entailment",
            "fake_score": fake_s, "real_score": real_s, **extra,
        }

    # COUVERTURE : beaucoup de sources sur le même sujet + au moins 1 soutien NLI
    if total >= COVERAGE_MIN and n_refute == 0 and n_support >= 1:
        cov_conf = round(min(0.60 + 0.02 * total, 0.85), 4)
        return {
            "verdict": "real", "is_fake": False,
            "confidence": cov_conf,
            "needs_llm": False,
            "evidence_title": best_entail["title"] or (relevant[0].title if relevant else None),
            "reason": "topic_corroborated",
            "fake_score": fake_s, "real_score": real_s, **extra,
        }

    # UNVERIFIED : sujet couvert mais pas de signal net
    return {
        "verdict": "unverified", "is_fake": False,
        "confidence": round(max(best_contra["p"], best_entail["p"]), 4),
        "needs_llm": ENABLE_LLM_ESCALATION,
        "evidence_title": best_entail["title"] or best_contra["title"],
        "reason": "nli_ambiguous",
        "fake_score": fake_s, "real_score": real_s, **extra,
    }


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8002"))
    print(f"\n🚀 classifier sur http://0.0.0.0:{port}")
    uvicorn.run(app, host="0.0.0.0", port=port)
