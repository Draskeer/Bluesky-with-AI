# Bluesky with AI

<div align="center">

![Bluesky](https://img.shields.io/badge/Bluesky-AT_Protocol-0085ff?style=for-the-badge&logo=bluesky&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=node.js&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![Python](https://img.shields.io/badge/Python-3.11-3776AB?style=for-the-badge&logo=python&logoColor=white)

**Client Bluesky moderne avec détection de fake news par IA**

</div>

---

## Sommaire

- [Présentation](#-présentation)
- [Fonctionnalités](#-fonctionnalités)
- [Architecture](#-architecture)
- [Prérequis](#-prérequis)
- [Démarrage du projet](#-démarrage-du-projet)
- [Variables d'environnement](#-variables-denvironnement)
- [Services & ports](#-services--ports)
- [Structure des dossiers](#-structure-des-dossiers)
- [Technologies](#-technologies)

---

## Présentation

**Bluesky with AI** est un client web pour le réseau social [Bluesky](https://bsky.app) enrichi d'un pipeline d'analyse IA. Chaque post peut être soumis à une analyse de fact-checking : le système récupère les articles de presse récents, les indexe dans une base vectorielle, puis compare le contenu du post aux sources via NLI (Natural Language Inference) pour rendre un verdict *real* / *fake* / *uncertain*.

Le tout est orchestré par **n8n**, ce qui rend chaque étape du pipeline visible, modifiable et réutilisable sans toucher au code.

---

## Fonctionnalités

| Catégorie | Détail |
|-----------|--------|
| **Feed** | Timeline personnalisée, posts, reposts, likes |
| **Discover** | Contenu trending et suggestions |
| **Thread** | Vue fil de discussion complète |
| **Chat** | Messagerie directe |
| **Notifications** | Mentions, likes, abonnements |
| **Profils** | Consultation et gestion des profils |
| **Saved** | Sauvegarde de posts |
| **Fact-checking IA** | Analyse NLI multi-sources via n8n + Qdrant |
| **Signalement communautaire** | Signalement de fake news avec verdict collaboratif |
| **Dashboard** | Trust score et sentiments moyennés sur période |
| **Mode sombre** | Thème clair / sombre |
| **Responsive** | Mobile & desktop |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        NAVIGATEUR                               │
│              React 18 + TypeScript + TailwindCSS                │
│                      localhost:5173                             │
└───────────────────────────┬─────────────────────────────────────┘
                            │ HTTP / REST
┌───────────────────────────▼─────────────────────────────────────┐
│                      BACKEND API                                 │
│               Express + TypeScript (tsx)                         │
│                      localhost:3001                             │
└───┬───────────────┬───────────────────┬──────────────┬──────────┘
    │               │                   │              │
    │ Bluesky       │ Webhooks          │ PostgreSQL   │ Qdrant
    │ AT Protocol   │                   │ port 5432    │ port 6333
    ▼               ▼                   ▼              ▼
 bsky.social     n8n                  bluesky_ai    fake_reports
               port 5678             (messages,     collection
                  │                  post_reports)
       ┌──────────┼──────────┐
       │          │          │
       ▼          ▼          ▼
  classifier  news_getter  llm-server
  port 8002   port 8001    port 8000
  (NLI/topic) (embed/news) (Qwen LLM)

┌─────────────────────────────────────────────────────────────────┐
│                     INFRASTRUCTURE DOCKER                        │
│  PostgreSQL :5432 · TimescaleDB :5433 · Qdrant :6333            │
│  n8n :5678 · pgAdmin :5050                                      │
└─────────────────────────────────────────────────────────────────┘
```

### Flux d'analyse d'un post

```
Backend → n8n webhook → classifier /topic
                      → news_getter /embed → Qdrant search
                      → classifier /verify (NLI)
                      → PostgreSQL (verdict stocké)
                      → Backend (réponse au frontend)
```

---

## Prérequis

Avant de commencer, assurez-vous d'avoir installé :

| Outil | Version minimale | Vérification |
|-------|-----------------|--------------|
| [Node.js](https://nodejs.org/) | 18.x | `node -v` |
| [npm](https://www.npmjs.com/) | 9.x | `npm -v` |
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | 24.x | `docker -v` |
| [Docker Compose](https://docs.docker.com/compose/) | 2.x | `docker compose version` |
| Compte Bluesky | — | [bsky.app](https://bsky.app) |

> **App Password Bluesky** : L'application n'utilise jamais votre mot de passe principal.
> Créez un App Password sur [bsky.app/settings/app-passwords](https://bsky.app/settings/app-passwords).

---

## Démarrage du projet

### Étape 1 — Cloner le dépôt

```bash
git clone https://github.com/Draskeer/Bluesky-with-AI.git
cd Bluesky-with-AI
```

---

### Étape 2 — Configurer les services Docker

Les services d'infrastructure (bases de données, n8n, IA) tournent tous dans Docker.

```bash
cd docker_services

# Copier et éditer le fichier d'environnement
cp .env.exemple .env
```

Ouvrez `.env` et renseignez les valeurs suivantes :

```env
# Clé API Qdrant — chaîne aléatoire, doit être identique partout
QDRANT_API_KEY=ma_cle_qdrant_secrete

# NewsAPI (optionnel) — https://newsapi.org/ · plan gratuit : 100 req/jour
NEWSAPI_KEY=

# Clé de chiffrement n8n — chaîne aléatoire stable (32 caractères recommandés)
N8N_ENCRYPTION_KEY=une-chaine-aleatoire-de-32-caracteres

# Compte administrateur n8n (créé automatiquement au premier démarrage)
N8N_OWNER_EMAIL=admin@example.com
N8N_OWNER_PASSWORD=Admin123!
N8N_OWNER_FIRSTNAME=Admin
N8N_OWNER_LASTNAME=User
```

---

### Étape 3 — Lancer les services Docker

Depuis le dossier `docker_services/` :

```bash
docker compose up -d
```

Le premier démarrage peut prendre **5 à 10 minutes** : Docker télécharge les images, installe PyTorch, et les modèles Hugging Face se chargent en mémoire.

Vérifiez que tous les services sont sains :

```bash
docker compose ps
```

Vous devriez voir tous les conteneurs avec le statut `running` ou `healthy` :

```
NAME              STATUS          PORTS
classifier        healthy         0.0.0.0:8002->8002/tcp
llm-server        running         0.0.0.0:8000->8000/tcp
n8n               healthy         0.0.0.0:5678->5678/tcp
news_getter       running         0.0.0.0:8001->8001/tcp
postgres          healthy         0.0.0.0:5432->5432/tcp
db_bluesky_data   healthy         0.0.0.0:5433->5432/tcp
qdrant            running         0.0.0.0:6333->6333/tcp
pgadmin           running         0.0.0.0:5050->80/tcp
```

> **Note** : Les conteneurs `n8n-init` et `qdrant-init` s'arrêtent automatiquement après avoir effectué leur initialisation. C'est normal.

---

### Étape 4 — Configurer et lancer le backend

Dans un nouveau terminal, depuis la racine du projet :

```bash
cd backend

# Installer les dépendances
npm install

# Copier et éditer le fichier d'environnement
cp .env.exemple .env
```

Ouvrez `backend/.env` et renseignez les valeurs (la plupart sont déjà correctes pour un usage local) :

```env
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173

# N8N — l'URL du webhook est visible dans n8n après import des workflows
N8N_WEBHOOK_URL=http://localhost:5678/webhook/0dde0006-a389-47f5-ae16-caeae58037bc
N8N_REPORT_WEBHOOK_URL=http://localhost:5678/webhook/report-fake

# PostgreSQL (valeurs identiques à docker_services/.env)
PGHOST=localhost
PGPORT=5432
PGUSER=bluesky
PGPASSWORD=bluesky_secret
PGDATABASE=bluesky_ai

# Qdrant (même clé que docker_services/.env → QDRANT_API_KEY)
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=ma_cle_qdrant_secrete

# Embedding API (news_getter)
EMBED_API_URL=http://localhost:8001
```

Lancez le backend :

```bash
npm run dev
```

Le serveur démarre sur **http://localhost:3001** avec hot-reload.

---

### Étape 5 — Configurer et lancer le frontend

Dans un autre terminal, depuis la racine du projet :

```bash
cd frontend

# Installer les dépendances
npm install

# (Optionnel) Vérifier l'URL de l'API
echo "VITE_API_URL=http://localhost:3001/api" > .env.local
```

Lancez le frontend :

```bash
npm run dev
```

Le frontend démarre sur **http://localhost:5173**.

---

### Étape 6 — Se connecter à l'application

1. Ouvrez [http://localhost:5173](http://localhost:5173)
2. Saisissez votre handle Bluesky (ex: `user.bsky.social`)
3. Saisissez votre **App Password** (pas votre mot de passe principal)
4. Profitez de votre client Bluesky avec IA

---

### Récapitulatif des commandes

```bash
# Terminal 1 — Infrastructure Docker
cd docker_services && docker compose up -d

# Terminal 2 — Backend
cd backend && npm install && npm run dev

# Terminal 3 — Frontend
cd frontend && npm install && npm run dev
```

---

## Variables d'environnement

### `docker_services/.env`

| Variable | Description | Exemple |
|----------|-------------|---------|
| `QDRANT_API_KEY` | Clé API Qdrant (identique dans backend/.env) | `mon_secret_qdrant` |
| `NEWSAPI_KEY` | Clé [NewsAPI](https://newsapi.org/) (optionnel) | `abc123...` |
| `N8N_ENCRYPTION_KEY` | Clé de chiffrement n8n | `random-32-char-string` |
| `N8N_OWNER_EMAIL` | Email du compte admin n8n | `admin@example.com` |
| `N8N_OWNER_PASSWORD` | Mot de passe admin n8n (1 maj + 1 chiffre + 1 spécial) | `Admin123!` |

### `backend/.env`

| Variable | Défaut | Description |
|----------|--------|-------------|
| `PORT` | `3001` | Port du serveur Express |
| `CORS_ORIGIN` | `http://localhost:5173` | URL autorisée CORS |
| `N8N_WEBHOOK_URL` | — | Webhook principal n8n (analyse posts) |
| `N8N_REPORT_WEBHOOK_URL` | — | Webhook n8n (indexation fake reports) |
| `PGHOST` | `localhost` | Hôte PostgreSQL |
| `PGPORT` | `5432` | Port PostgreSQL |
| `PGUSER` | `bluesky` | Utilisateur PostgreSQL |
| `PGPASSWORD` | `bluesky_secret` | Mot de passe PostgreSQL |
| `PGDATABASE` | `bluesky_ai` | Base de données PostgreSQL |
| `QDRANT_URL` | `http://localhost:6333` | URL Qdrant |
| `QDRANT_API_KEY` | — | Clé API Qdrant |
| `EMBED_API_URL` | `http://localhost:8001` | URL du service d'embedding |

---

## Services & ports

| Service | URL locale | Description |
|---------|-----------|-------------|
| **Frontend** | http://localhost:5173 | Interface React |
| **Backend API** | http://localhost:3001 | API Express |
| **n8n** | http://localhost:5678 | Orchestrateur de workflows |
| **Qdrant Dashboard** | http://localhost:6333/dashboard | Base vectorielle |
| **pgAdmin** | http://localhost:5050 | Interface PostgreSQL |
| **Classifier** | http://localhost:8002 | Service NLI/sentiment/topic |
| **News Getter** | http://localhost:8001 | Service embedding + ingestion news |
| **LLM Server** | http://localhost:8000 | Serveur LLM (Qwen) |
| **PostgreSQL** | localhost:5432 | DB `bluesky_ai` (messages, reports) |
| **TimescaleDB** | localhost:5433 | DB `bluesky_data` (raw_post_pointers) |

---

## Structure des dossiers

```
Bluesky-with-AI/
│
├── backend/                      # API Express + TypeScript
│   ├── src/
│   │   ├── api/                  # Routes (auth, feed, chat, dashboard…)
│   │   ├── analyzers/            # Analyseurs (sentiment, toxicité, engagement)
│   │   ├── config/               # Configuration via Zod
│   │   ├── services/             # Bluesky, DB, Qdrant, analysis-manager
│   │   ├── types/                # Types TypeScript
│   │   └── utils/                # Logger, n8n-webhook
│   ├── .env.exemple
│   └── package.json
│
├── frontend/                     # React + Vite + TypeScript
│   ├── src/
│   │   ├── components/           # ComposePost…
│   │   ├── hooks/                # usePostAiAnalysis
│   │   ├── pages/                # Feed, Discover, Chat, Thread…
│   │   ├── store/                # Zustand (auth, theme)
│   │   ├── styles/               # Tailwind globals
│   │   └── types/
│   └── package.json
│
└── docker_services/              # Infrastructure Docker
    ├── docker-compose.yml
    ├── .env.exemple
    ├── classifier/               # Service NLI FastAPI (Python)
    ├── news_getter/              # Service embedding + news FastAPI (Python)
    ├── n8n/                      # Workflows, provisioning, entités
    ├── postgres/                 # Scripts d'initialisation SQL
    └── qwen/                     # Serveur LLM vLLM
```

---

## Technologies

### Backend
| Lib | Rôle |
|-----|------|
| Express.js | Framework HTTP |
| TypeScript + tsx | Typage statique + hot-reload |
| @atproto/api | SDK AT Protocol (Bluesky) |
| pg | Client PostgreSQL |
| Zod | Validation des variables d'env |
| Winston | Logging |

### Frontend
| Lib | Rôle |
|-----|------|
| React 18 | UI Library |
| Vite | Build tool |
| TailwindCSS | Styling utilitaire |
| Zustand | State management |
| React Router v6 | Navigation |
| Lucide React | Icônes |

### Infrastructure
| Service | Image | Rôle |
|---------|-------|------|
| PostgreSQL 16 | `postgres:16-alpine` | DB principale (messages, reports) |
| TimescaleDB | `timescale/timescaledb:latest-pg16` | Hypertable (raw_post_pointers) |
| Qdrant | `qdrant/qdrant:latest` | Base vectorielle (news + fake reports) |
| n8n | `n8nio/n8n` | Orchestrateur de workflows |
| Classifier | `python:3.11-slim` | NLI + sentiment + topic (Hugging Face) |
| News Getter | custom (Python) | Embedding (MiniLM-L12-v2) + ingestion RSS/NewsAPI |
| LLM Server | `ubuntu:24.04` | Inférence Qwen (CPU) |
| pgAdmin | `dpage/pgadmin4` | Interface d'admin PostgreSQL |

### Modèles IA
| Modèle | Usage |
|--------|-------|
| `paraphrase-multilingual-MiniLM-L12-v2` | Embeddings 384 dims (multilingue) |
| `cross-encoder/nli-MiniLM2-L6-H768` | Natural Language Inference (fact-check) |
| `cardiffnlp/twitter-roberta-base-sentiment-latest` | Analyse de sentiment |
| Qwen (vLLM) | Escalade LLM pour cas ambigus |

---

## Authentification Bluesky

L'application utilise l'**AT Protocol** et ne stocke aucun mot de passe.

1. Rendez-vous sur [bsky.app/settings/app-passwords](https://bsky.app/settings/app-passwords)
2. Créez un **App Password** dédié à cette application
3. Utilisez votre handle (ex : `user.bsky.social`) et cet App Password pour vous connecter

> N'utilisez **jamais** votre mot de passe principal Bluesky.

---

## Commandes utiles

```bash
# Voir les logs d'un service Docker
docker compose logs -f classifier
docker compose logs -f n8n

# Redémarrer un service
docker compose restart classifier

# Arrêter tous les services
docker compose down

# Arrêter et supprimer les volumes (reset complet)
docker compose down -v
```

---

## Licence

MIT — voir [LICENSE](LICENSE) pour plus de détails.
