/**
 * Accès à la base de données PostgreSQL (db bluesky_ai)
 *
 * Sert à savoir si un message a déjà été analysé par n8n (table "messages")
 * et à récupérer le résultat de cette analyse.
 */

import pg from 'pg';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

export type Mood = 'positive' | 'neutral' | 'negative';

export interface MessageAnalysis {
  message_id: string;
  is_fake: boolean;
  confidence: number;
  mood: Mood | null;
}

// Instance singleton du pool de connexions
let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (!pool) {
    pool = new pg.Pool({
      host: config.PGHOST,
      port: config.PGPORT,
      user: config.PGUSER,
      password: config.PGPASSWORD,
      database: config.PGDATABASE
    });

    pool.on('error', (err) => {
      logger.error('Postgres pool error:', err?.message || err);
    });
  }
  return pool;
}

/**
 * Récupère l'analyse déjà stockée pour une liste d'IDs de messages.
 * Renvoie une Map indexée par message_id (uniquement ceux présents en base).
 */
export async function getMessageAnalysis(ids: string[]): Promise<Map<string, MessageAnalysis>> {
  const result = new Map<string, MessageAnalysis>();
  if (ids.length === 0) return result;

  const { rows } = await getPool().query<MessageAnalysis>(
    `SELECT message_id, is_fake, confidence, mood
       FROM messages
      WHERE message_id = ANY($1)`,
    [ids]
  );

  for (const row of rows) {
    result.set(row.message_id, row);
  }
  return result;
}
