import { Router, type Request, type Response } from 'express';
import { getUserDashboard, getPool } from '../services/db.js';
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

router.get('/:did/score', async (req: Request, res: Response) => {
  try {
    const { did } = req.params;
    const db = getPool();
    const prefix = `at://${did}/`;
    const result = await db.query(
      `SELECT
         COUNT(CASE WHEN confidence > 0 THEN 1 END)                           AS verified_total,
         SUM(CASE WHEN is_fake = true AND confidence > 0 THEN 1 ELSE 0 END)  AS fake_count,
         AVG(CASE WHEN confidence > 0 THEN confidence END)                    AS avg_confidence
       FROM messages
       WHERE message_id LIKE $1`,
      [prefix + '%']
    );
    const row = result.rows[0];
    const verifiedTotal = parseInt(row.verified_total) || 0;
    const fakeRate = verifiedTotal > 0 ? (parseInt(row.fake_count) || 0) / verifiedTotal : 0;
    const avgConf = parseFloat(row.avg_confidence) || 0;
    const trustScore = verifiedTotal > 0 ? (1 - fakeRate) * avgConf : 0.5;
    res.json({ success: true, data: { trustScore: Math.round(trustScore * 100) / 100 } });
  } catch (error) {
    logger.error('Trust score error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch trust score' });
  }
});

export default router;
