#!/usr/bin/env python3
"""
Serveur API compatible OpenAI pour :
  - Chat completions : Qwen2.5-0.5B
  - Embeddings      : multilingual-e5-small (FR + EN)
                      → vecteur dupliqué x4 (384→1536) pour compatibilité n8n

Usage: python vllm.py
⚠️  Collection Qdrant doit être créée avec size: 1536
"""

from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel
from typing import List, Optional, Any
import uvicorn
import torch
import time
import numpy as np
from transformers import AutoModelForCausalLM, AutoTokenizer, AutoModel
import torch.nn.functional as F

app = FastAPI()

# ─────────────────────────────────────────────
# 1. Chargement modèle CHAT (Qwen2.5-0.5B)
# ─────────────────────────────────────────────
print("📦 Chargement du modèle Chat : Qwen2.5-0.5B...")
chat_model = AutoModelForCausalLM.from_pretrained("Qwen/Qwen2.5-0.5B")
chat_tokenizer = AutoTokenizer.from_pretrained("Qwen/Qwen2.5-0.5B")
print("✓ Modèle Chat chargé !")

# ─────────────────────────────────────────────
# 2. Chargement modèle EMBEDDING
# ─────────────────────────────────────────────
EMBEDDING_MODEL_NAME = "intfloat/multilingual-e5-small"
EMBEDDING_DIMS_REAL = 384   # dims réelles du modèle
EMBEDDING_DIMS_N8N  = 1536  # dims annoncées à n8n (x4) → n8n prend 1/4 = 384 ✅

print(f"📦 Chargement du modèle Embedding : {EMBEDDING_MODEL_NAME}...")
embed_tokenizer = AutoTokenizer.from_pretrained(EMBEDDING_MODEL_NAME)
embed_model = AutoModel.from_pretrained(EMBEDDING_MODEL_NAME)
embed_model.eval()
print("✓ Modèle Embedding chargé !")
print(f"  dims réelles : {EMBEDDING_DIMS_REAL} → annoncées à n8n : {EMBEDDING_DIMS_N8N}")


# ─────────────────────────────────────────────
# Schémas
# ─────────────────────────────────────────────

class ChatRequest(BaseModel):
    model: Optional[str] = "Qwen/Qwen2.5-0.5B"
    messages: Optional[List[dict]] = None
    message: Optional[str] = None
    temperature: Optional[float] = 0.7
    max_tokens: Optional[int] = 512


class EmbeddingRequest(BaseModel):
    model: Optional[str] = EMBEDDING_MODEL_NAME
    input: Any
    encoding_format: Optional[str] = "float"


# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────

def extract_text(value: Any) -> str:
    """Extrait le texte depuis n'importe quel format que n8n peut envoyer."""
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, list):
        if all(isinstance(i, int) for i in value):
            return embed_tokenizer.decode(value, skip_special_tokens=True).strip()
        if len(value) > 0:
            return extract_text(value[0])
    if isinstance(value, dict):
        for key in ("pageContent", "text", "content", "input"):
            if key in value and value[key]:
                return str(value[key]).strip()
        return str(value).strip()
    return str(value).strip()


def average_pool(last_hidden_states: torch.Tensor, attention_mask: torch.Tensor) -> torch.Tensor:
    last_hidden = last_hidden_states.masked_fill(~attention_mask[..., None].bool(), 0.0)
    return last_hidden.sum(dim=1) / attention_mask.sum(dim=1)[..., None]


def compute_embeddings(texts: List[str]) -> List[List[float]]:
    prefixed = [f"passage: {t}" for t in texts]
    batch = embed_tokenizer(
        prefixed,
        max_length=512,
        padding=True,
        truncation=True,
        return_tensors="pt"
    )
    with torch.no_grad():
        outputs = embed_model(**batch)
    embeddings = average_pool(outputs.last_hidden_state, batch["attention_mask"])
    embeddings = F.normalize(embeddings, p=2, dim=1)
    print(f"DEBUG embedding shape: {embeddings.shape}")  # [N, 384]
    return embeddings.tolist()


# ─────────────────────────────────────────────
# Prompt système
# ─────────────────────────────────────────────

SYSTEM_PROMPT = """Vous êtes un expert en vérification d'informations et en détection de fake news. Votre rôle est d'analyser des messages et de déterminer s'ils contiennent de la désinformation.

DÉFINITION DE FAKE NEWS :
Une fake news est une information délibérément fausse, trompeuse ou sortie de son contexte, présentée comme un fait vérifiable.

CRITÈRES D'ÉVALUATION :
1. Vérifiabilité : Les faits peuvent-ils être vérifiés par des sources fiables ?
2. Sources : Le message cite-t-il des sources crédibles et vérifiables ?
3. Manipulation : Y a-t-il des techniques de manipulation (clickbait, émotions extrêmes, urgence artificielle) ?
4. Cohérence : L'information est-elle cohérente avec des faits établis ?
5. Formulation : Présence de termes sensationnalistes, d'erreurs factuelles évidentes ?
6. Contexte : L'information est-elle sortie de son contexte ou déformée ?

FORMAT DE RÉPONSE :
Répondez SEULEMENT avec un objet JSON valide :
{
  "is_real_news": boolean,
  "confidence": float
}"""


# ─────────────────────────────────────────────
# Handlers
# ─────────────────────────────────────────────

async def _handle_embeddings(request: EmbeddingRequest):
    raw = request.input
    print(f"DEBUG raw input type  : {type(raw)}")
    print(f"DEBUG raw input value : {str(raw)[:300]}")

    if not isinstance(raw, list):
        raw = [raw]

    clean_texts = [extract_text(item) for item in raw]
    clean_texts = [t for t in clean_texts if t]

    print(f"DEBUG clean_texts count: {len(clean_texts)}")

    if not clean_texts:
        raise HTTPException(status_code=400, detail="Input vide ou invalide")

    try:
        vectors = compute_embeddings(clean_texts)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur embedding: {str(e)}")

    # ── Moyenne de tous les chunks → 1 vecteur de 384 dims ──
    avg_384 = np.mean(vectors, axis=0)  # shape [384]

    # ── Dupliquer x4 → 1536 dims pour compatibilité n8n ──
    # n8n (Embeddings OpenAI node) divise par 4 en interne
    # donc il lira les 384 premières valeurs = vecteur correct ✅
    vec_1536 = np.tile(avg_384, 4).tolist()  # shape [1536]

    print(f"DEBUG final vec dims: {len(vec_1536)}")  # 1536

    return {
        "object": "list",
        "model": EMBEDDING_MODEL_NAME,
        "data": [
            {"object": "embedding", "index": 0, "embedding": vec_1536}
        ],
        "usage": {
            "prompt_tokens": sum(len(t.split()) for t in clean_texts),
            "total_tokens": sum(len(t.split()) for t in clean_texts)
        }
    }


async def _handle_chat(request: ChatRequest):
    if request.messages:
        user_msg = next((m["content"] for m in request.messages if m["role"] == "user"), "")
    elif request.message:
        user_msg = request.message
    else:
        raise HTTPException(status_code=400, detail="'messages' ou 'message' requis")

    prompt = f"System: {SYSTEM_PROMPT}\nUser: {user_msg}\nAssistant:"
    inputs = chat_tokenizer(prompt, return_tensors="pt")
    outputs = chat_model.generate(
        **inputs,
        max_new_tokens=request.max_tokens,
        temperature=request.temperature,
        do_sample=True,
    )
    response_text = chat_tokenizer.decode(outputs[0], skip_special_tokens=True)
    response_text = response_text.split("Assistant:")[-1].strip()

    return {
        "id": f"chatcmpl-{int(time.time())}",
        "object": "chat.completion",
        "model": request.model,
        "choices": [{
            "index": 0,
            "message": {"role": "assistant", "content": response_text},
            "finish_reason": "stop"
        }],
        "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
    }


def _models_response():
    return {
        "object": "list",
        "data": [
            {"id": "Qwen/Qwen2.5-0.5B",    "object": "model", "type": "chat"},
            {"id": EMBEDDING_MODEL_NAME,     "object": "model", "type": "embedding",
             "dims": EMBEDDING_DIMS_N8N}  # annonce 1536 à n8n
        ]
    }


# ─────────────────────────────────────────────
# Routes avec /v1
# ─────────────────────────────────────────────

@app.post("/v1/embeddings")
async def embeddings_v1(request: EmbeddingRequest):
    return await _handle_embeddings(request)

@app.post("/v1/chat/completions")
async def chat_v1(request: ChatRequest):
    return await _handle_chat(request)

@app.get("/v1/models")
async def models_v1():
    return _models_response()


# ─────────────────────────────────────────────
# Routes sans /v1 (n8n avec Base URL = .../v1)
# ─────────────────────────────────────────────

@app.post("/embeddings")
async def embeddings_no_prefix(request: EmbeddingRequest):
    return await _handle_embeddings(request)

@app.post("/chat/completions")
async def chat_no_prefix(request: ChatRequest):
    return await _handle_chat(request)

@app.get("/models")
async def models_no_prefix():
    return _models_response()


# ─────────────────────────────────────────────
# Root
# ─────────────────────────────────────────────

@app.get("/")
async def root():
    return {
        "message": "Serveur API actif",
        "status": "running",
        "endpoints": {
            "chat":       "POST /v1/chat/completions",
            "embeddings": "POST /v1/embeddings",
            "models":     "GET  /v1/models"
        }
    }


if __name__ == "__main__":
    print("\n🚀 Serveur démarré sur http://0.0.0.0:8000")
    print("  Chat       → POST /v1/chat/completions")
    print("  Embeddings → POST /v1/embeddings")
    print("  Models     → GET  /v1/models")
    print(f"  Dims réelles : {EMBEDDING_DIMS_REAL} → annoncées n8n : {EMBEDDING_DIMS_N8N}")
    print("\n⚠️  Qdrant collection doit avoir size: 1536\n")
    uvicorn.run(app, host="0.0.0.0", port=8000)