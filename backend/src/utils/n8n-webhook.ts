/**
 * Utilitaire pour envoyer des données au webhook n8n
 */

import { config } from '../config/index.js';
import { logger } from './logger.js';

/**
 * Envoie des données au webhook n8n configuré.
 *
 * IMPORTANT : lève une erreur en cas d'échec (réseau ou statut HTTP non-OK).
 * C'est volontaire : l'appelant doit pouvoir savoir si l'envoi a réussi
 * (ex. /analysis/request retire l'ID de `inFlight` pour pouvoir réessayer).
 * Les appelants "fire-and-forget" doivent attraper l'erreur eux-mêmes
 * (`.catch(...)`) pour ne pas faire échouer leur requête.
 *
 * @param data - Données à envoyer au webhook
 */
export async function sendToN8nWebhook(data: any): Promise<void> {
  // Vérifier si le webhook est configuré
  if (!config.N8N_WEBHOOK_URL) {
    logger.debug('N8N webhook not configured, skipping send');
    return;
  }

  const response = await fetch(config.N8N_WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      timestamp: new Date().toISOString(),
      source: 'bluesky-chat',
      ...data
    })
  });

  if (!response.ok) {
    throw new Error(`N8N webhook returned status ${response.status}`);
  }

  logger.debug('Data sent to N8N webhook successfully');
}

/**
 * Déclenche l'analyse IA d'un post via n8n.
 * Envoie exactement le format attendu par le nœud "Data Verification" du workflow :
 * { message, user, msg_id }.
 */
export async function sendPostToN8n(post: {
  msg_id: string;
  message: string;
  user: string;
}): Promise<void> {
  await sendToN8nWebhook({
    msg_id: post.msg_id,
    message: post.message,
    user: post.user
  });
}
