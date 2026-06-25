import { Router, type Request, type Response } from 'express';
import { getUserDashboard } from '../services/db.js';
import { logger } from '../utils/logger.js';

const router = Router();

/**
 * GET /api/dashboard/:did?range=week|month|year&handle=xxx
 *
 * Renvoie les données du dashboard IA pour un utilisateur :
 *  - trust score (table users)
 *  - répartition sentiment
 *  - timeline sentiment + fake/real dans le temps
 */
router.get('/:did', async (req: Request, res: Response) => {
  try {
    const { did } = req.params;
    const range = (req.query.range as string) || 'month';
    const handle = (req.query.handle as string) || '';

    if (!['week', 'month', 'year'].includes(range)) {
      res.status(400).json({ success: false, error: 'range must be week, month or year' });
      return;
    }

    const data = await getUserDashboard(did, handle, range as 'week' | 'month' | 'year');

    res.json({ success: true, data });
  } catch (error) {
    logger.error('Dashboard error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch dashboard' });
  }
});

export default router;
