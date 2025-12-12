/**
 * Routes pour les listes
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
 * GET /api/lists
 * Get user's lists
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { limit, cursor } = paginationSchema.parse(req.query);
    const purpose = req.query.purpose as string | undefined;
    
    const bluesky = getBlueskyService();
    
    if (!bluesky.isLoggedIn()) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const agent = (bluesky as any).getAgent();
    const actor = agent.session?.did;
    
    const result = await agent.app.bsky.graph.getLists({
      actor,
      limit: limit || 50,
      cursor
    });

    // Filter by purpose if specified
    let lists = result.data.lists || [];
    if (purpose) {
      const purposeUri = purpose === 'curate' 
        ? 'app.bsky.graph.defs#curatelist'
        : 'app.bsky.graph.defs#modlist';
      lists = lists.filter((list: any) => list.purpose === purposeUri);
    }

    res.json({
      success: true,
      data: {
        lists,
        cursor: result.data.cursor
      }
    });
  } catch (error) {
    logger.error('Get lists error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch lists' });
  }
});

/**
 * GET /api/lists/:uri
 * Get a specific list with its members
 */
router.get('/:uri(*)', async (req: Request, res: Response) => {
  try {
    const listUri = req.params.uri;
    const { limit, cursor } = paginationSchema.parse(req.query);
    
    const bluesky = getBlueskyService();
    
    if (!bluesky.isLoggedIn()) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const agent = (bluesky as any).getAgent();
    
    const result = await agent.app.bsky.graph.getList({
      list: listUri,
      limit: limit || 50,
      cursor
    });

    res.json({
      success: true,
      data: {
        list: result.data.list,
        items: result.data.items || [],
        cursor: result.data.cursor
      }
    });
  } catch (error) {
    logger.error('Get list error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch list' });
  }
});

export default router;
