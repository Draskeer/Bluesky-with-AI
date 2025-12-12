# Bluesky Client with AI

Un client Bluesky moderne avec analyse de contenu par IA, construit avec React et Express.

![Bluesky Client](https://img.shields.io/badge/Bluesky-Client-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)
![React](https://img.shields.io/badge/React-18-blue)
![Node.js](https://img.shields.io/badge/Node.js-18+-green)

## 📋 Fonctionnalités

- 🏠 **Feed Timeline** - Consultez votre fil d'actualité
- 🔍 **Explore** - Découvrez du contenu trending et des suggestions personnalisées
- 💬 **Chat** - Messagerie directe avec d'autres utilisateurs
- 🔔 **Notifications** - Suivez vos interactions
- 👤 **Profils** - Consultez et gérez les profils
- 🌙 **Mode sombre** - Interface moderne avec thème Bluesky
- 📱 **Responsive** - Optimisé pour mobile et desktop

## 🏗️ Architecture

```
ProjetEtude/
├── backend/          # API Express + TypeScript
│   ├── src/
│   │   ├── api/      # Routes API
│   │   ├── services/ # Services (Bluesky, Analysis)
│   │   └── utils/    # Utilitaires
│   └── package.json
├── frontend/         # React + Vite + TypeScript
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   └── store/
│   └── package.json
└── README.md
```

## 🚀 Installation

### Prérequis

- **Node.js** >= 18.x
- **npm** >= 9.x (ou yarn/pnpm)
- Un compte **Bluesky** avec un App Password

### 1. Cloner le projet

```bash
git clone https://github.com/Draskeer/Bluesky-with-AI.git
cd Bluesky-with-AI
```

### 2. Installation du Backend

```bash
# Aller dans le dossier backend
cd backend

# Installer les dépendances
npm install

# Créer le fichier d'environnement
cp .env.example .env
# ou créer manuellement :
echo "PORT=3001" > .env
```

#### Configuration du Backend

Créez un fichier `.env` dans le dossier `backend/` :

```env
PORT=3001
NODE_ENV=development
```

#### Lancer le Backend

```bash
# Mode développement (avec hot-reload)
npm run dev

# Ou en mode production
npm run build
npm start
```

Le serveur démarre sur `http://localhost:3001`

### 3. Installation du Frontend

```bash
# Retourner à la racine et aller dans frontend
cd ../frontend

# Installer les dépendances
npm install

# (Optionnel) Créer le fichier d'environnement
echo "VITE_API_URL=http://localhost:3001/api" > .env.local
```

#### Lancer le Frontend

```bash
# Mode développement
npm run dev

# Build pour production
npm run build

# Prévisualiser le build
npm run preview
```

Le frontend démarre sur `http://localhost:5173`

## 🔧 Scripts disponibles

### Backend (`/backend`)

| Commande | Description |
|----------|-------------|
| `npm run dev` | Lance le serveur en mode développement |
| `npm run build` | Compile TypeScript vers JavaScript |
| `npm start` | Lance le serveur compilé |
| `npm run lint` | Vérifie le code avec ESLint |

### Frontend (`/frontend`)

| Commande | Description |
|----------|-------------|
| `npm run dev` | Lance Vite en mode développement |
| `npm run build` | Build pour production |
| `npm run preview` | Prévisualise le build |
| `npm run lint` | Vérifie le code avec ESLint |

## 🔐 Authentification

L'application utilise l'API AT Protocol de Bluesky. Pour vous connecter :

1. Allez sur [bsky.app/settings/app-passwords](https://bsky.app/settings/app-passwords)
2. Créez un nouveau "App Password"
3. Utilisez votre handle (ex: `user.bsky.social`) et l'App Password pour vous connecter

> ⚠️ **Important** : N'utilisez jamais votre mot de passe principal. Utilisez toujours un App Password.

## 📁 Structure des dossiers

### Backend

```
backend/src/
├── api/
│   ├── auth.routes.ts      # Routes d'authentification
│   ├── feed.routes.ts      # Routes du feed
│   ├── profiles.routes.ts  # Routes des profils
│   ├── chat.routes.ts      # Routes du chat
│   └── notifications.routes.ts
├── services/
│   ├── bluesky.service.ts  # Service API Bluesky
│   └── analysis-manager.ts # Gestionnaire d'analyse
├── config/
│   └── index.ts
└── utils/
    └── logger.ts
```

### Frontend

```
frontend/src/
├── components/
│   ├── Layout.tsx      # Layout principal avec sidebar
│   ├── PostCard.tsx    # Carte de post
│   └── ComposePost.tsx # Formulaire de création
├── pages/
│   ├── Feed.tsx        # Page d'accueil
│   ├── Discover.tsx    # Page Explore
│   ├── Profile.tsx     # Page profil
│   ├── Chat.tsx        # Page messagerie
│   ├── Notifications.tsx
│   └── Thread.tsx      # Page d'un post
├── services/
│   └── api.ts          # Client API
├── store/
│   ├── auth.store.ts   # État d'authentification
│   └── theme.store.ts  # État du thème
└── styles/
    └── globals.css
```

## 🛠️ Technologies utilisées

### Backend
- **Express.js** - Framework web
- **TypeScript** - Typage statique
- **@atproto/api** - SDK Bluesky
- **Zod** - Validation des données
- **Winston** - Logging

### Frontend
- **React 18** - UI Library
- **Vite** - Build tool
- **TypeScript** - Typage statique
- **TailwindCSS** - Styling
- **Zustand** - State management
- **React Router** - Navigation

## 🤝 Contribution

Les contributions sont les bienvenues ! N'hésitez pas à ouvrir une issue ou une pull request.

## 📄 Licence

MIT License - voir le fichier [LICENSE](LICENSE) pour plus de détails.

---
