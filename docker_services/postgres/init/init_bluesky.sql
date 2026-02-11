-- 1. Activation de l'extension TimescaleDB
-- Indispensable pour la gestion temporelle performante
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- 2. Création de la table 'analyzed_posts'
CREATE TABLE IF NOT EXISTS analyzed_posts (
    -- Timestamp (Requis par TimescaleDB & utile pour le tri chronologique)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Tes colonnes métier
    message_id VARCHAR(255) NOT NULL,  -- ID unique du post (ex: uri)
    message TEXT,                      -- Le contenu du post
    message_score FLOAT,               -- Score de crédibilité (0.0 - 1.0)
    user_id VARCHAR(255),              -- ID de l'utilisateur (did ou handle)
    user_trust_score FLOAT,            -- Score de fiabilité utilisateur
    mood VARCHAR(50),                  -- Émotion (ex: 'Colère', 'Joie')

    -- Clé primaire composée (Obligatoire : ID + Temps)
    PRIMARY KEY (message_id, created_at)
);

-- 3. Transformation en Hypertable
-- C'est ici que la magie Timescale opère pour la performance
SELECT create_hypertable('analyzed_posts', 'created_at', if_not_exists => TRUE);

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO bluesky;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO bluesky;