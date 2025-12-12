/**
 * Routes pour les profils et interactions sociales
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
 * GET /api/profiles/:actor
 * Obtient un profil
 */
router.get('/:actor', async (req: Request, res: Response) => {
  try {
    const { actor } = req.params;
    const bluesky = getBlueskyService();
    
    const profile = await bluesky.getProfile(actor);

    res.json({
      success: true,
      data: profile
    });
  } catch (error) {
    logger.error('Get profile error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch profile' });
  }
});

/**
 * GET /api/profiles/:actor/followers
 * Obtient les followers d'un profil
 */
router.get('/:actor/followers', async (req: Request, res: Response) => {
  try {
    const { actor } = req.params;
    const { limit, cursor } = paginationSchema.parse(req.query);
    
    const bluesky = getBlueskyService();
    const result = await bluesky.getFollowers(actor, { limit, cursor });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Get followers error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch followers' });
  }
});

/**
 * GET /api/profiles/:actor/following
 * Obtient les following d'un profil
 */
router.get('/:actor/following', async (req: Request, res: Response) => {
  try {
    const { actor } = req.params;
    const { limit, cursor } = paginationSchema.parse(req.query);
    
    const bluesky = getBlueskyService();
    const result = await bluesky.getFollows(actor, { limit, cursor });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Get following error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch following' });
  }
});

/**
 * POST /api/profiles/:did/follow
 * Suivre un utilisateur
 */
router.post('/:did/follow', async (req: Request, res: Response) => {
  try {
    const { did } = req.params;
    const bluesky = getBlueskyService();
    
    if (!bluesky.isLoggedIn()) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const result = await bluesky.follow(did);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Follow error:', error);
    res.status(500).json({ success: false, error: 'Failed to follow' });
  }
});

/**
 * DELETE /api/profiles/follows/:uri
 * Ne plus suivre
 */
router.delete('/follows/:uri(*)', async (req: Request, res: Response) => {
  try {
    const { uri } = req.params;
    const bluesky = getBlueskyService();
    
    if (!bluesky.isLoggedIn()) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    await bluesky.unfollow(decodeURIComponent(uri));

    res.json({
      success: true,
      data: { message: 'Unfollowed' }
    });
  } catch (error) {
    logger.error('Unfollow error:', error);
    res.status(500).json({ success: false, error: 'Failed to unfollow' });
  }
});

/**
 * GET /api/profiles/suggestions
 * Suggestions de profils à suivre
 */
router.get('/suggestions/list', async (req: Request, res: Response) => {
  try {
    const { limit, cursor } = paginationSchema.parse(req.query);
    const bluesky = getBlueskyService();
    
    if (!bluesky.isLoggedIn()) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const agent = (bluesky as any).getAgent();
    const result = await agent.app.bsky.actor.getSuggestions({
      limit: limit || 10,
      cursor
    });

    res.json({
      success: true,
      data: {
        actors: result.data.actors,
        cursor: result.data.cursor
      }
    });
  } catch (error) {
    logger.error('Get suggestions error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch suggestions' });
  }
});

/**
 * GET /api/profiles/search
 * Recherche d'utilisateurs
 */
router.get('/search/actors', async (req: Request, res: Response) => {
  try {
    const query = req.query.q as string;
    if (!query) {
      res.status(400).json({ success: false, error: 'Query parameter required' });
      return;
    }

    const { limit, cursor } = paginationSchema.parse(req.query);
    const bluesky = getBlueskyService();
    
    const results = await bluesky.searchActors(query, { limit, cursor });

    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    logger.error('Search actors error:', error);
    res.status(500).json({ success: false, error: 'Search failed' });
  }
});

export default router;
