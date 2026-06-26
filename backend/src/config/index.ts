/**
 * Configuration de l'application
 */

import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const configSchema = z.object({
  // Serveur
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  
  // CORS
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  
  // Bluesky
  BLUESKY_SERVICE_URL: z.string().default('https://bsky.social'),
  
  // N8N Webhooks
  N8N_WEBHOOK_URL: z.string().default('http://localhost:5678/webhook/0dde0006-a389-47f5-ae16-caeae58037bc'),
  // Webhook n8n dédié à l'indexation des fake reports dans Qdrant (1536-dim, compatible workflow d'analyse)
  N8N_REPORT_WEBHOOK_URL: z.string().default(''),

  // Base de données PostgreSQL (db bluesky_ai — table "messages")
  PGHOST: z.string().default('localhost'),
  PGPORT: z.coerce.number().default(5432),
  PGUSER: z.string().default('bluesky'),
  PGPASSWORD: z.string().default('bluesky_secret'),
  PGDATABASE: z.string().default('bluesky_ai'),

  // Analyse
  ANALYSIS_PARALLEL: z.coerce.boolean().default(true),
  ANALYSIS_MAX_CONCURRENT: z.coerce.number().default(10),
  ANALYSIS_TIMEOUT_MS: z.coerce.number().default(30000),
  
  // Qdrant (fake reports collection)
  QDRANT_URL: z.string().default('http://localhost:6333'),
  QDRANT_API_KEY: z.string().default(''),

  // Embedding API (news_getter — paraphrase-multilingual-MiniLM-L12-v2, 384 dims)
  EMBED_API_URL: z.string().default('http://localhost:8001'),

  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info')
});

const parsed = configSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.format());
  process.exit(1);
}

export const config = parsed.data;

export type Config = z.infer<typeof configSchema>;
