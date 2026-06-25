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

// ─── Dashboard ────────────────────────────────────────────────────

export interface DashboardTimelinePoint {
  period: string;
  positive: number;
  neutral: number;
  negative: number;
  fake_count: number;
  real_count: number;
  avg_confidence: number;
}

export interface DashboardData {
  trustScore: number;
  messageCount: number;
  sentimentSummary: { positive: number; neutral: number; negative: number };
  fakeRate: number;
  avgConfidence: number;
  timeline: DashboardTimelinePoint[];
}

const RANGE_CONFIG = {
  week:  { interval: "7 days",   trunc: 'day',   format: 'YYYY-MM-DD' },
  month: { interval: "30 days",  trunc: 'day',   format: 'YYYY-MM-DD' },
  year:  { interval: "12 months", trunc: 'month', format: 'YYYY-MM' },
} as const;

export async function getUserDashboard(
  did: string,
  handle: string,
  range: 'week' | 'month' | 'year'
): Promise<DashboardData> {
  const db = getPool();
  const cfg = RANGE_CONFIG[range];
  const likePattern = `at://${did}/%`;

  // 1. Trust score from users table (try handle then DID)
  const userRes = await db.query<{ trust_rate: number; message_count: number }>(
    `SELECT trust_rate, message_count FROM users WHERE user_id = $1 OR user_id = $2 LIMIT 1`,
    [handle, did]
  );
  const trustScore = userRes.rows[0]?.trust_rate ?? 0.5;
  const dbMessageCount = userRes.rows[0]?.message_count ?? 0;

  // 2. Global sentiment summary for this user (all time)
  const summaryRes = await db.query<{ mood: string; cnt: string; fake_cnt: string; avg_conf: string }>(
    `SELECT
       COALESCE(mood, 'neutral') AS mood,
       COUNT(*)::text AS cnt,
       COUNT(*) FILTER (WHERE is_fake = true)::text AS fake_cnt,
       AVG(confidence)::text AS avg_conf
     FROM messages
     WHERE message_id LIKE $1
     GROUP BY COALESCE(mood, 'neutral')`,
    [likePattern]
  );

  const sentimentSummary = { positive: 0, neutral: 0, negative: 0 };
  let totalMessages = 0;
  let totalFake = 0;
  let confidenceSum = 0;

  for (const row of summaryRes.rows) {
    const count = parseInt(row.cnt, 10);
    totalMessages += count;
    totalFake += parseInt(row.fake_cnt, 10);
    confidenceSum += parseFloat(row.avg_conf || '0') * count;
    if (row.mood in sentimentSummary) {
      sentimentSummary[row.mood as keyof typeof sentimentSummary] = count;
    }
  }

  // 3. Timeline grouped by period
  const timelineRes = await db.query<{
    period: Date;
    positive: string;
    neutral: string;
    negative: string;
    fake_count: string;
    real_count: string;
    avg_confidence: string;
  }>(
    `SELECT
       DATE_TRUNC($2, created_at) AS period,
       COUNT(*) FILTER (WHERE mood = 'positive')::text AS positive,
       COUNT(*) FILTER (WHERE mood = 'neutral' OR mood IS NULL)::text AS neutral,
       COUNT(*) FILTER (WHERE mood = 'negative')::text AS negative,
       COUNT(*) FILTER (WHERE is_fake = true)::text AS fake_count,
       COUNT(*) FILTER (WHERE is_fake = false)::text AS real_count,
       COALESCE(AVG(confidence), 0)::text AS avg_confidence
     FROM messages
     WHERE message_id LIKE $1
       AND created_at >= NOW() - $3::interval
     GROUP BY DATE_TRUNC($2, created_at)
     ORDER BY period`,
    [likePattern, cfg.trunc, cfg.interval]
  );

  const timeline: DashboardTimelinePoint[] = timelineRes.rows.map(r => ({
    period: r.period.toISOString(),
    positive: parseInt(r.positive, 10),
    neutral: parseInt(r.neutral, 10),
    negative: parseInt(r.negative, 10),
    fake_count: parseInt(r.fake_count, 10),
    real_count: parseInt(r.real_count, 10),
    avg_confidence: parseFloat(parseFloat(r.avg_confidence).toFixed(4)),
  }));

  return {
    trustScore,
    messageCount: totalMessages || dbMessageCount,
    sentimentSummary,
    fakeRate: totalMessages > 0 ? totalFake / totalMessages : 0,
    avgConfidence: totalMessages > 0 ? confidenceSum / totalMessages : 0,
    timeline,
  };
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
