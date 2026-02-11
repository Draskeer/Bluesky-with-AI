/**
 * Utilitaire pour envoyer des données au webhook n8n
 */

import { config } from '../config/index.js';
import { logger } from './logger.js';

/**
 * Envoie des données au webhook n8n configuré
 * @param data - Données à envoyer au webhook
 */
export async function sendToN8nWebhook(data: any): Promise<void> {
  // Vérifier si le webhook est configuré
  if (!config.N8N_WEBHOOK_URL) {
    logger.debug('N8N webhook not configured, skipping send');
    return;
  }

  try {
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
      logger.warn(`N8N webhook returned status ${response.status}`);
    } else {
      logger.debug('Data sent to N8N webhook successfully');
    }
  } catch (error: any) {
    // Ne pas faire échouer la requête si le webhook n8n échoue
    logger.error('Failed to send to N8N webhook:', error?.message || error);
  }
}
