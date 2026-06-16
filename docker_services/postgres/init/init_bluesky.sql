-- 1. Activation de l'extension TimescaleDB
-- Indispensable pour la gestion temporelle performante
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- 2. Création de la table 'raw_post_pointers' (Anciennement analyzed_posts)
-- Ne stocke que le strict minimum pour la collecte initiale
CREATE TABLE IF NOT EXISTS raw_post_pointers (
    -- Timestamp réel de création du post (à récupérer de l'API Bluesky)
    created_at TIMESTAMPTZ NOT NULL,
    
    -- ID unique du post (ex: uri ou cid)
    message_id VARCHAR(255) NOT NULL,

    -- Clé primaire composée (Obligatoire pour TimescaleDB : ID + Temps)
    PRIMARY KEY (message_id, created_at)
);

-- 3. Transformation en Hypertable
-- Permettra au modèle d'interroger très rapidement "tous les IDs de telle heure à telle heure"
SELECT create_hypertable('raw_post_pointers', 'created_at', if_not_exists => TRUE);

-- 4. Gestion des permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO bluesky;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO bluesky;