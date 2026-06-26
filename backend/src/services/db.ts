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

export interface DashboardData {
  trustScore: number;
  messageCount: number;
  sentimentSummary: { positive: number; neutral: number; negative: number };
  fakeRate: number;
  avgConfidence: number;
  timeline: Array<{
    period: string;
    positive: number;
    neutral: number;
    negative: number;
    fake_count: number;
    real_count: number;
    avg_confidence: number;
  }>;
}

export async function getUserDashboard(
  did: string,
  _handle: string,
  range: 'week' | 'month' | 'year'
): Promise<DashboardData> {
  const db = getPool();
  // AT URIs are formatted as at://<did>/app.bsky.feed.post/<rkey>
  const prefix = `at://${did}/`;

  const intervalMap = { week: '7 days', month: '30 days', year: '365 days' } as const;
  const truncMap = { week: 'day', month: 'day', year: 'month' } as const;
  const interval = intervalMap[range];
  const trunc = truncMap[range];

  const [statsRes, timelineRes, allTimeRes] = await Promise.all([
    db.query(
      `SELECT
         COUNT(*)                                                              AS total,
         SUM(CASE WHEN mood = 'positive' THEN 1 ELSE 0 END)                  AS positive,
         SUM(CASE WHEN mood = 'neutral'  THEN 1 ELSE 0 END)                  AS neutral,
         SUM(CASE WHEN mood = 'negative' THEN 1 ELSE 0 END)                  AS negative,
         -- Trust : seulement les messages avec un vrai verdict (confidence > 0)
         COUNT(CASE WHEN confidence > 0 THEN 1 END)                           AS verified_total,
         SUM(CASE WHEN is_fake = true AND confidence > 0 THEN 1 ELSE 0 END)  AS fake_count,
         AVG(CASE WHEN confidence > 0 THEN confidence END)                    AS avg_confidence
       FROM messages
       WHERE message_id LIKE $1
         AND created_at >= NOW() - $2::INTERVAL`,
      [prefix + '%', interval]
    ),
    db.query(
      `SELECT
         DATE_TRUNC($1, created_at)                            AS period,
         SUM(CASE WHEN mood = 'positive' THEN 1 ELSE 0 END)   AS positive,
         SUM(CASE WHEN mood = 'neutral'  THEN 1 ELSE 0 END)   AS neutral,
         SUM(CASE WHEN mood = 'negative' THEN 1 ELSE 0 END)   AS negative,
         SUM(CASE WHEN is_fake = true    THEN 1 ELSE 0 END)   AS fake_count,
         SUM(CASE WHEN is_fake = false   THEN 1 ELSE 0 END)   AS real_count,
         AVG(confidence)                                        AS avg_confidence
       FROM messages
       WHERE message_id LIKE $2
         AND created_at >= NOW() - $3::INTERVAL
       GROUP BY period
       ORDER BY period ASC`,
      [trunc, prefix + '%', interval]
    ),
    // Trust score global sur TOUS les messages vérifiés (confidence > 0, sans filtre période)
    db.query(
      `SELECT
         COUNT(CASE WHEN confidence > 0 THEN 1 END)                           AS verified_total,
         SUM(CASE WHEN is_fake = true AND confidence > 0 THEN 1 ELSE 0 END)  AS fake_count,
         AVG(CASE WHEN confidence > 0 THEN confidence END)                    AS avg_confidence
       FROM messages
       WHERE message_id LIKE $1`,
      [prefix + '%']
    ),
  ]);

  const s = statsRes.rows[0];
  const total = parseInt(s.total) || 0;
  const verifiedTotal = parseInt(s.verified_total) || 0;
  const fakeRate = verifiedTotal > 0 ? (parseInt(s.fake_count) || 0) / verifiedTotal : 0;
  const avgConf = parseFloat(s.avg_confidence) || 0;

  // Fallback global : tous messages vérifiés de l'utilisateur (toutes périodes)
  const at = allTimeRes.rows[0];
  const atVerifiedTotal = parseInt(at.verified_total) || 0;
  const atFakeRate = atVerifiedTotal > 0 ? (parseInt(at.fake_count) || 0) / atVerifiedTotal : 0;
  const atAvgConf = parseFloat(at.avg_confidence) || 0;
  const globalTrustScore = atVerifiedTotal > 0 ? (1 - atFakeRate) * atAvgConf : 0.5;

  return {
    trustScore: verifiedTotal > 0 ? (1 - fakeRate) * avgConf : globalTrustScore,
    messageCount: total,
    sentimentSummary: {
      positive: parseInt(s.positive) || 0,
      neutral:  parseInt(s.neutral)  || 0,
      negative: parseInt(s.negative) || 0,
    },
    fakeRate,
    avgConfidence: avgConf,
    timeline: timelineRes.rows.map(row => ({
      period:         row.period instanceof Date ? row.period.toISOString() : String(row.period),
      positive:       parseInt(row.positive)        || 0,
      neutral:        parseInt(row.neutral)          || 0,
      negative:       parseInt(row.negative)         || 0,
      fake_count:     parseInt(row.fake_count)       || 0,
      real_count:     parseInt(row.real_count)       || 0,
      avg_confidence: parseFloat(row.avg_confidence) || 0,
    })),
  };
}
