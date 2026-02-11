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
  
  // N8N Webhook
  N8N_WEBHOOK_URL: z.string().optional(),
  
  // Analyse
  ANALYSIS_PARALLEL: z.coerce.boolean().default(true),
  ANALYSIS_MAX_CONCURRENT: z.coerce.number().default(10),
  ANALYSIS_TIMEOUT_MS: z.coerce.number().default(30000),
  
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
