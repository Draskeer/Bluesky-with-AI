#!/usr/bin/env python3
"""
Service de classification (CPU, inférence seule — rapide et stable).

Trois tâches, basées sur des modèles BERT discriminatifs (un seul forward pass,
pas de génération) :

  - /topic     : classification zero-shot du sujet (réutilise le modèle NLI).
                 -> checkable=true si politique/éco/santé/science/société/actu
                    (sujet factuel vérifiable -> route vers Qdrant + /verify)
                 -> checkable=false sinon (perso/quotidien -> sentiment seul)

  - /sentiment : analyse de sentiment FR+EN (cardiffnlp/twitter-xlm-roberta-base-sentiment)
                 -> mood ∈ {positive, neutral, negative}

  - /verify    : fact-checking "léger" basé sur preuve (NLI / mDeBERTa-xnli).
                 Compare le message aux vraies news récupérées dans Qdrant :
                   contradiction forte -> FAKE
                   entailment fort     -> REAL
                   sinon               -> "unverified" (escalade LLM possible)

Le LLM génératif n'est appelé (par n8n) qu'en dernier recours sur les cas ambigus.
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

# Limiter les threads pour éviter de saturer tout le CPU sous charge concurrente
torch.set_num_threads(int(os.getenv("TORCH_THREADS", "2")))

SENTIMENT_MODEL = os.getenv("SENTIMENT_MODEL", "cardiffnlp/twitter-xlm-roberta-base-sentiment")
NLI_MODEL = os.getenv("NLI_MODEL", "MoritzLaurer/mDeBERTa-v3-base-xnli-multilingual-nli-2mil7")

# Seuils (réglables via env) — calibrés pour l'embedder MiniLM multilingue
# (pertinent ≈ 0.6-0.7, hors-sujet ≈ 0.3).
SIM_MIN = float(os.getenv("SIM_MIN", "0.50"))     # similarité Qdrant mini pour qu'un article serve de preuve
NLI_HI = float(os.getenv("NLI_HI", "0.70"))       # proba NLI mini pour trancher fake/real
FAKE_MARGIN = float(os.getenv("FAKE_MARGIN", "0.15"))  # la contradiction doit dépasser l'entailment d'au moins ça
MAX_ARTICLES = int(os.getenv("MAX_ARTICLES", "12"))    # nb d'articles examinés pour la corroboration
ENTAIL_SOFT = float(os.getenv("ENTAIL_SOFT", "0.50"))  # un article "soutient" le claim à partir de cette proba
CORRO_MIN = int(os.getenv("CORRO_MIN", "3"))           # nb de sources qui soutiennent (NLI) -> "real"
COVERAGE_MIN = int(os.getenv("COVERAGE_MIN", "5"))     # nb de sources proches (similarité) sans contradiction -> "plausible/corroboré"
# Escalade LLM (Qwen) désactivée par défaut : le modèle 0.5B répond "fake" par
# défaut (faux positifs massifs). Les cas ambigus -> "unverified" (is_fake=false).
ENABLE_LLM_ESCALATION = os.getenv("ENABLE_LLM_ESCALATION", "false").lower() == "true"
TOPIC_MIN = float(os.getenv("TOPIC_MIN", "0.0"))  # confiance mini zero-shot pour accepter "checkable"
TOPIC_HYPOTHESIS = os.getenv("TOPIC_HYPOTHESIS", "Ce texte parle de {}.")

# Sujets "factuels / vérifiables" -> déclenchent la similarité Qdrant + fact-check.
TOPIC_CHECKABLE = [
    "politique", "économie", "santé", "science",
    "actualité internationale", "société",
]
# Sujets personnels / sans portée factuelle publique -> sentiment seul.
TOPIC_PERSONAL = [
    "vie personnelle", "opinion personnelle",
    "conversation quotidienne", "humour",
]
TOPIC_LABELS = TOPIC_CHECKABLE + TOPIC_PERSONAL

print(f"📦 Chargement sentiment: {SENTIMENT_MODEL}...")
sentiment_pipe = pipeline(
    "sentiment-analysis",
    model=SENTIMENT_MODEL,
    tokenizer=SENTIMENT_MODEL,
    top_k=None,
    truncation=True,
    max_length=256,
)
print("✓ sentiment prêt")

print(f"📦 Chargement NLI: {NLI_MODEL}...")
nli_tokenizer = AutoTokenizer.from_pretrained(NLI_MODEL)
nli_model = AutoModelForSequenceClassification.from_pretrained(NLI_MODEL)
nli_model.eval()
# label -> position, robuste à l'ordre du modèle
NLI_ID2LABEL = {int(k): v.lower() for k, v in nli_model.config.id2label.items()}
print(f"✓ NLI prêt (labels: {NLI_ID2LABEL})")

# Zero-shot : réutilise le MÊME modèle NLI déjà chargé (aucun coût mémoire en plus).
print("📦 Préparation du classifieur zero-shot (réutilise NLI)...")
zeroshot_pipe = pipeline(
    "zero-shot-classification",
    model=nli_model,
    tokenizer=nli_tokenizer,
)
print("✓ zero-shot prêt")

app = FastAPI(title="classifier")


# ─────────────────────────────────────────────
# Schémas
# ─────────────────────────────────────────────

class TopicRequest(BaseModel):
    text: str


class SentimentRequest(BaseModel):
    text: str


class Article(BaseModel):
    title: Optional[str] = ""
    summary: Optional[str] = ""
    score: Optional[float] = 0.0


class VerifyRequest(BaseModel):
    message: str
    articles: List[Article] = []
    sim_min: Optional[float] = None
    nli_hi: Optional[float] = None


# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────

MOODS = {"positive", "neutral", "negative"}


def _nli(premise: str, hypothesis: str) -> dict:
    """Retourne {entailment, neutral, contradiction} (probabilités)."""
    inputs = nli_tokenizer(
        premise, hypothesis, truncation=True, max_length=256, return_tensors="pt"
    )
    with torch.no_grad():
        logits = nli_model(**inputs).logits[0]
    probs = F.softmax(logits, dim=-1).tolist()
    return {NLI_ID2LABEL[i]: float(probs[i]) for i in range(len(probs))}


# ─────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "sentiment": SENTIMENT_MODEL, "nli": NLI_MODEL}


@app.post("/topic")
def topic(req: TopicRequest):
    """Gate de routage : le message est-il un sujet factuel vérifiable ?

    checkable=true  -> politique/éco/santé/science/société/actu
                       => n8n enchaîne embed -> Qdrant -> /verify
    checkable=false -> perso/quotidien => sentiment seul, pas de fact-check
    """
    text = (req.text or "").strip()
    if not text:
        return {"checkable": False, "topic": None, "confidence": 0.0, "scope": "personal"}

    res = zeroshot_pipe(
        text,
        candidate_labels=TOPIC_LABELS,
        hypothesis_template=TOPIC_HYPOTHESIS,
        multi_label=False,
    )
    top = res["labels"][0]
    score = float(res["scores"][0])
    checkable = (top in TOPIC_CHECKABLE) and (score >= TOPIC_MIN)
    return {
        "checkable": checkable,
        "topic": top,
        "confidence": round(score, 4),
        "scope": "global" if checkable else "personal",
    }


@app.post("/sentiment")
def sentiment(req: SentimentRequest):
    text = (req.text or "").strip()
    if not text:
        return {"mood": "neutral", "confidence": 0.0}
    scores = sentiment_pipe(text)[0]  # liste de {label, score}
    best = max(scores, key=lambda s: s["score"])
    mood = best["label"].lower()
    if mood not in MOODS:
        mood = "neutral"
    return {"mood": mood, "confidence": round(float(best["score"]), 4)}


@app.post("/verify")
def verify(req: VerifyRequest):
    sim_min = req.sim_min if req.sim_min is not None else SIM_MIN
    nli_hi = req.nli_hi if req.nli_hi is not None else NLI_HI
    message = (req.message or "").strip()

    relevant = sorted(
        [a for a in req.articles if (a.score or 0) >= sim_min],
        key=lambda a: a.score or 0,
        reverse=True,
    )[:MAX_ARTICLES]

    # Aucune vraie news proche -> non vérifiable (probablement personnel / hors-actu).
    # On NE déclenche PAS le LLM : pas de claim ancrable.
    if not relevant:
        return {
            "verdict": "unverified",
            "is_fake": False,
            "confidence": 0.0,
            "needs_llm": False,
            "evidence_title": None,
            "reason": "no_related_news",
        }

    # Corroboration multi-sources : on compte, sur le top-K, combien d'articles
    # SOUTIENNENT (entailment) vs CONTREDISENT (contradiction) le message.
    # "Proche de plein de sources qui confirment" -> plus probable que ce soit vrai.
    best_contra = {"p": 0.0, "title": None}
    best_entail = {"p": 0.0, "title": None}
    n_support = 0   # articles qui soutiennent (entailment >= ENTAIL_SOFT)
    n_refute = 0    # articles qui contredisent (contradiction >= nli_hi)
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

    total = len(relevant)
    corroboration = round(n_support / total, 3) if total else 0.0
    extra = {
        "corroboration": corroboration,      # fraction des sources proches qui confirment
        "support": n_support, "refute": n_refute, "sources_checked": total,
    }

    # FAKE : la contradiction domine clairement (plus de réfutations que de
    # soutiens, contradiction forte et nettement au-dessus de l'entailment).
    if n_refute > n_support and best_contra["p"] >= nli_hi and best_contra["p"] >= best_entail["p"] + FAKE_MARGIN:
        return {
            "verdict": "fake", "is_fake": True,
            "confidence": round(best_contra["p"], 4),
            "needs_llm": False, "evidence_title": best_contra["title"],
            "reason": "nli_contradiction", **extra,
        }
    # REAL : soit un article soutient fortement (entailment fort), soit le claim
    # est corroboré par plusieurs sources indépendantes (>= CORRO_MIN).
    if best_entail["p"] >= nli_hi or n_support >= CORRO_MIN:
        return {
            "verdict": "real", "is_fake": False,
            "confidence": round(max(best_entail["p"], corroboration), 4),
            "needs_llm": False, "evidence_title": best_entail["title"],
            "reason": "corroborated" if n_support >= CORRO_MIN else "nli_entailment",
            **extra,
        }

    # CORROBORATION PAR COUVERTURE : beaucoup de sources de référence parlent du
    # même fait (>= COVERAGE_MIN) et AUCUNE ne le contredit -> probablement vrai.
    # Signal plus faible que l'entailment (similarité ≠ vérité), d'où une confiance
    # plafonnée. C'est l'intuition "proche de plein de sources => plus probable vrai".
    if total >= COVERAGE_MIN and n_refute == 0:
        cov_conf = round(min(0.60 + 0.02 * total, 0.85), 4)
        return {
            "verdict": "real", "is_fake": False,
            "confidence": cov_conf,
            "needs_llm": False, "evidence_title": best_entail["title"] or (relevant[0].title if relevant else None),
            "reason": "topic_corroborated", **extra,
        }

    # Sujet couvert mais ni confirmé ni réfuté de façon nette -> "unverified".
    # Pas d'escalade LLM par défaut (Qwen 0.5B = faux positifs). ENABLE_LLM_ESCALATION=true pour réactiver.
    return {
        "verdict": "unverified", "is_fake": False,
        "confidence": round(max(best_contra["p"], best_entail["p"]), 4),
        "needs_llm": ENABLE_LLM_ESCALATION,
        "evidence_title": best_entail["title"] or best_contra["title"],
        "reason": "nli_ambiguous", **extra,
    }


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8002"))
    print(f"\n🚀 classifier sur http://0.0.0.0:{port}")
    uvicorn.run(app, host="0.0.0.0", port=port)
