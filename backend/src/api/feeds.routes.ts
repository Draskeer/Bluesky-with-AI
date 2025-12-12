/**
 * Routes pour les feeds personnalisés
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
 * GET /api/feeds/saved
 * Get user's saved feeds
 */
router.get('/saved', async (req: Request, res: Response) => {
  try {
    const bluesky = getBlueskyService();
    
    if (!bluesky.isLoggedIn()) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const agent = (bluesky as any).getAgent();
    const result = await agent.app.bsky.feed.getSavedFeeds({});

    res.json({
      success: true,
      data: {
        feeds: result.data.feeds || []
      }
    });
  } catch (error) {
    logger.error('Get saved feeds error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch saved feeds' });
  }
});

/**
 * GET /api/feeds/popular
 * Get popular/suggested feeds
 */
router.get('/popular', async (req: Request, res: Response) => {
  try {
    const { limit, cursor } = paginationSchema.parse(req.query);
    const bluesky = getBlueskyService();
    
    if (!bluesky.isLoggedIn()) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const agent = (bluesky as any).getAgent();
    const result = await agent.app.bsky.feed.getSuggestedFeeds({
      limit: limit || 30,
      cursor
    });

    res.json({
      success: true,
      data: {
        feeds: result.data.feeds || [],
        cursor: result.data.cursor
      }
    });
  } catch (error) {
    logger.error('Get popular feeds error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch popular feeds' });
  }
});

/**
 * GET /api/feeds/search
 * Search for feeds
 */
router.get('/search', async (req: Request, res: Response) => {
  try {
    const query = req.query.q as string;
    if (!query) {
      res.status(400).json({ success: false, error: 'Query parameter required' });
      return;
    }

    const { limit, cursor } = paginationSchema.parse(req.query);
    const bluesky = getBlueskyService();
    
    if (!bluesky.isLoggedIn()) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const agent = (bluesky as any).getAgent();
    
    // Search using the feed generator search
    const result = await agent.app.bsky.unspecced.getPopularFeedGenerators({
      limit: limit || 20,
      cursor,
      query
    });

    res.json({
      success: true,
      data: {
        feeds: result.data.feeds || [],
        cursor: result.data.cursor
      }
    });
  } catch (error) {
    logger.error('Search feeds error:', error);
    res.status(500).json({ success: false, error: 'Search failed' });
  }
});

/**
 * GET /api/feeds/:uri
 * Get posts from a specific feed
 */
router.get('/:uri(*)', async (req: Request, res: Response) => {
  try {
    const { uri } = req.params;
    const { limit, cursor } = paginationSchema.parse(req.query);
    const bluesky = getBlueskyService();
    
    if (!bluesky.isLoggedIn()) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const agent = (bluesky as any).getAgent();
    const result = await agent.app.bsky.feed.getFeed({
      feed: decodeURIComponent(uri),
      limit: limit || 30,
      cursor
    });

    res.json({
      success: true,
      data: {
        feed: result.data.feed || [],
        cursor: result.data.cursor
      }
    });
  } catch (error) {
    logger.error('Get feed posts error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch feed' });
  }
});

/**
 * POST /api/feeds/save
 * Save a feed to user's list
 */
router.post('/save', async (req: Request, res: Response) => {
  try {
    const { feed } = req.body;
    
    if (!feed) {
      res.status(400).json({ success: false, error: 'Feed URI required' });
      return;
    }

    const bluesky = getBlueskyService();
    
    if (!bluesky.isLoggedIn()) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const agent = (bluesky as any).getAgent();
    
    // Add to saved feeds
    await agent.app.bsky.feed.saveFeed({ feed });

    res.json({
      success: true,
      data: { message: 'Feed saved' }
    });
  } catch (error) {
    logger.error('Save feed error:', error);
    res.status(500).json({ success: false, error: 'Failed to save feed' });
  }
});

/**
 * DELETE /api/feeds/saved/:uri
 * Remove a feed from user's saved list
 */
router.delete('/saved/:uri(*)', async (req: Request, res: Response) => {
  try {
    const { uri } = req.params;
    const bluesky = getBlueskyService();
    
    if (!bluesky.isLoggedIn()) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const agent = (bluesky as any).getAgent();
    
    // Remove from saved feeds
    await agent.app.bsky.feed.unsaveFeed({ feed: decodeURIComponent(uri) });

    res.json({
      success: true,
      data: { message: 'Feed removed' }
    });
  } catch (error) {
    logger.error('Unsave feed error:', error);
    res.status(500).json({ success: false, error: 'Failed to remove feed' });
  }
});

export default router;
