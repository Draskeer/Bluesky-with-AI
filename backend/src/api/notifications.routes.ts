/**
 * Routes pour les notifications
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { getBlueskyService } from '../services/bluesky.service.js';
import { logger } from '../utils/logger.js';

const router = Router();

const paginationSchema = z.object({
  limit: z.coerce.number().min(1).max(100).optional(),
  cursor: z.string().optional()
});

/**
 * GET /api/notifications
 * Obtient les notifications
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { limit, cursor } = paginationSchema.parse(req.query);
    const bluesky = getBlueskyService();
    
    if (!bluesky.isLoggedIn()) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const result = await bluesky.getNotifications({ limit, cursor });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Get notifications error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch notifications' });
  }
});

/**
 * POST /api/notifications/read
 * Marque les notifications comme lues
 */
router.post('/read', async (req: Request, res: Response) => {
  try {
    const { seenAt } = req.body;
    const bluesky = getBlueskyService();
    
    if (!bluesky.isLoggedIn()) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    await bluesky.markNotificationsRead(seenAt);

    res.json({
      success: true,
      data: { message: 'Notifications marked as read' }
    });
  } catch (error) {
    logger.error('Mark notifications read error:', error);
    res.status(500).json({ success: false, error: 'Failed to mark notifications as read' });
  }
});

export default router;
