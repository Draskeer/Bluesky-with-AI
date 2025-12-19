#!/usr/bin/env python3
"""
Serveur API simple compatible OpenAI pour Qwen2.5-0.5B
Usage: python vllm.py
"""

from fastapi import FastAPI
from pydantic import BaseModel
from typing import List, Optional
import uvicorn
from transformers import AutoModelForCausalLM, AutoTokenizer

app = FastAPI()

print("📦 Chargement du modèle Qwen2.5-0.5B...")
model = AutoModelForCausalLM.from_pretrained("Qwen/Qwen2.5-0.5B")
tokenizer = AutoTokenizer.from_pretrained("Qwen/Qwen2.5-0.5B")
print("✓ Modèle chargé!")


class ChatRequest(BaseModel):
    message: str
    temperature: Optional[float] = 0.7
    max_tokens: Optional[int] = 512


class ChatResponse(BaseModel):
    id: str = "chatcmpl-123"
    object: str = "chat.completion"
    model: str = "Qwen/Qwen2.5-0.5B"
    choices: List[dict]


# Prompt système prédéfini
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

INDICATEURS DE FAKE NEWS :
- Affirmations extraordinaires sans preuves
- Absence de sources ou sources non fiables
- Langage émotionnel et sensationnaliste excessif
- Contradictions avec des faits vérifiés
- Manipulation d'images ou de citations

CAS PARTICULIERS :
- Opinion personnelle → is_real_news: true (ce n'est pas une fake news, c'est subjectif)
- Satire/humour évident → is_real_news: false mais confidence faible
- Information invérifiable → confidence faible

FORMAT DE RÉPONSE :
Répondez SEULEMENT avec un objet JSON valide :
{
  \"is_real_news\": boolean,  // true = information vraie/vérifiable, false = fake news
  \"confidence\": float,      // entre 0.0 et 1.0
}"""


@app.post("/v1/chat/completions")
async def chat_completion(request: ChatRequest):
    prompt = f"System: {SYSTEM_PROMPT}\nUser: {request.message}\nAssistant:"

    inputs = tokenizer(prompt, return_tensors="pt")
    outputs = model.generate(
        **inputs,
        max_new_tokens=request.max_tokens,
        temperature=request.temperature,
        do_sample=True,
    )

    response_text = tokenizer.decode(outputs[0], skip_special_tokens=True)
    response_text = response_text.split("Assistant:")[-1].strip()

    return ChatResponse(
        choices=[
            {
                "index": 0,
                "message": {"role": "assistant", "content": response_text},
                "finish_reason": "stop",
            }
        ],
    )


@app.get("/")
async def root():
    return {"message": "Serveur API Qwen2.5-0.5B actif!", "status": "running"}


if __name__ == "__main__":
    print("\nServeur démarré sur http://0.0.0.0:8000")
    print("Endpoint: POST http://0.0.0.0:8000/v1/chat/completions")
    print("\nPrêt à recevoir des requêtes!\n")
    uvicorn.run(app, host="0.0.0.0", port=8000)
