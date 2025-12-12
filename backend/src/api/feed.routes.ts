/**
 * Routes pour les feeds et posts
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { getBlueskyService } from '../services/bluesky.service.js';
import { getAnalysisManager } from '../services/analysis-manager.js';
import { logger } from '../utils/logger.js';
import type { AnalyzableContent } from '../types/analyzer.js';

const router = Router();

const createPostSchema = z.object({
  text: z.string().min(1).max(300),
  replyTo: z.object({
    uri: z.string(),
    cid: z.string(),
    rootUri: z.string().optional(),
    rootCid: z.string().optional()
  }).optional(),
  langs: z.array(z.string()).optional()
});

const paginationSchema = z.object({
  limit: z.coerce.number().min(1).max(100).optional(),
  cursor: z.string().optional()
});

/**
 * GET /api/feed/timeline
 * Obtient le timeline de l'utilisateur connecté
 */
router.get('/timeline', async (req: Request, res: Response) => {
  try {
    const { limit, cursor } = paginationSchema.parse(req.query);
    const bluesky = getBlueskyService();
    
    if (!bluesky.isLoggedIn()) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const feed = await bluesky.getTimeline({ limit, cursor });
    
    // Option: analyser les posts du feed
    const analyzeParam = req.query.analyze === 'true';
    let analyses: Record<string, any> = {};
    
    if (analyzeParam) {
      const analysisManager = getAnalysisManager();
      const posts = feed.feed.map(f => f.post);
      
      for (const post of posts.slice(0, 10)) { // Limiter pour performance
        const content: AnalyzableContent = { type: 'post', data: post };
        const results = await analysisManager.analyze(content);
        analyses[post.uri] = results;
      }
    }

    res.json({
      success: true,
      data: {
        feed: feed.feed,
        cursor: feed.cursor,
        ...(analyzeParam && { analyses })
      }
    });
  } catch (error) {
    logger.error('Timeline error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch timeline' });
  }
});

/**
 * GET /api/feed/popular
 * Obtient le feed "What's Hot" (populaire)
 */
router.get('/popular', async (req: Request, res: Response) => {
  try {
    const { limit, cursor } = paginationSchema.parse(req.query);
    const bluesky = getBlueskyService();
    
    if (!bluesky.isLoggedIn()) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const feed = await bluesky.getPopularFeed({ limit, cursor });

    res.json({
      success: true,
      data: {
        feed: feed.feed,
        cursor: feed.cursor
      }
    });
  } catch (error) {
    logger.error('Popular feed error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch popular feed' });
  }
});

/**
 * GET /api/feed/discover
 * Obtient le feed "Discover" (suggestions)
 */
router.get('/discover', async (req: Request, res: Response) => {
  try {
    const { limit, cursor } = paginationSchema.parse(req.query);
    const bluesky = getBlueskyService();
    
    if (!bluesky.isLoggedIn()) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const feed = await bluesky.getDiscoverFeed({ limit, cursor });

    res.json({
      success: true,
      data: {
        feed: feed.feed,
        cursor: feed.cursor
      }
    });
  } catch (error) {
    logger.error('Discover feed error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch discover feed' });
  }
});

/**
 * GET /api/feed/author/:actor
 * Obtient le feed d'un auteur
 */
router.get('/author/:actor', async (req: Request, res: Response) => {
  try {
    const { actor } = req.params;
    const { limit, cursor } = paginationSchema.parse(req.query);
    const filter = req.query.filter as string | undefined;
    
    const bluesky = getBlueskyService();
    const feed = await bluesky.getAuthorFeed(actor, { limit, cursor, filter });

    res.json({
      success: true,
      data: feed
    });
  } catch (error) {
    logger.error('Author feed error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch author feed' });
  }
});

/**
 * GET /api/feed/search
 * Recherche de posts
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
    
    const results = await bluesky.searchPosts(query, { limit, cursor });

    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    logger.error('Search error:', error);
    res.status(500).json({ success: false, error: 'Search failed' });
  }
});

/**
 * POST /api/feed/posts
 * Crée un nouveau post
 */
router.post('/posts', async (req: Request, res: Response) => {
  try {
    const { text, replyTo, langs } = createPostSchema.parse(req.body);
    const bluesky = getBlueskyService();
    
    if (!bluesky.isLoggedIn()) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    let reply;
    if (replyTo) {
      reply = {
        root: { uri: replyTo.rootUri || replyTo.uri, cid: replyTo.rootCid || replyTo.cid },
        parent: { uri: replyTo.uri, cid: replyTo.cid }
      };
    }

    const result = await bluesky.createPost(text, { reply, langs });

    res.status(201).json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Create post error:', error);
    
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Invalid post data',
        details: error.errors
      });
      return;
    }
    
    res.status(500).json({ success: false, error: 'Failed to create post' });
  }
});

/**
 * DELETE /api/feed/posts/:uri
 * Supprime un post
 */
router.delete('/posts/:uri(*)', async (req: Request, res: Response) => {
  try {
    const { uri } = req.params;
    const bluesky = getBlueskyService();
    
    if (!bluesky.isLoggedIn()) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    await bluesky.deletePost(decodeURIComponent(uri));

    res.json({
      success: true,
      data: { message: 'Post deleted' }
    });
  } catch (error) {
    logger.error('Delete post error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete post' });
  }
});

/**
 * GET /api/feed/thread/:uri
 * Obtient un thread complet
 */
router.get('/thread/:uri(*)', async (req: Request, res: Response) => {
  try {
    const { uri } = req.params;
    const depth = parseInt(req.query.depth as string) || 6;
    
    const bluesky = getBlueskyService();
    const thread = await bluesky.getThread(decodeURIComponent(uri), depth);

    // Option: analyser le thread
    const analyzeParam = req.query.analyze === 'true';
    let analysis;
    
    if (analyzeParam && thread.post) {
      const analysisManager = getAnalysisManager();
      const content: AnalyzableContent = { type: 'thread', data: thread };
      analysis = await analysisManager.analyze(content);
    }

    res.json({
      success: true,
      data: {
        thread,
        ...(analyzeParam && { analysis })
      }
    });
  } catch (error) {
    logger.error('Thread error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch thread' });
  }
});

/**
 * POST /api/feed/posts/:uri/like
 * Like un post
 */
router.post('/posts/:uri(*)/like', async (req: Request, res: Response) => {
  try {
    const { uri } = req.params;
    const { cid } = req.body;
    
    if (!cid) {
      res.status(400).json({ success: false, error: 'CID required' });
      return;
    }

    const bluesky = getBlueskyService();
    
    if (!bluesky.isLoggedIn()) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const result = await bluesky.like(decodeURIComponent(uri), cid);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Like error:', error);
    res.status(500).json({ success: false, error: 'Failed to like post' });
  }
});

/**
 * DELETE /api/feed/likes/:uri
 * Unlike un post
 */
router.delete('/likes/:uri(*)', async (req: Request, res: Response) => {
  try {
    const { uri } = req.params;
    const bluesky = getBlueskyService();
    
    if (!bluesky.isLoggedIn()) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    await bluesky.unlike(decodeURIComponent(uri));

    res.json({
      success: true,
      data: { message: 'Unliked' }
    });
  } catch (error) {
    logger.error('Unlike error:', error);
    res.status(500).json({ success: false, error: 'Failed to unlike' });
  }
});

/**
 * POST /api/feed/posts/:uri/repost
 * Repost un post
 */
router.post('/posts/:uri(*)/repost', async (req: Request, res: Response) => {
  try {
    const { uri } = req.params;
    const { cid } = req.body;
    
    if (!cid) {
      res.status(400).json({ success: false, error: 'CID required' });
      return;
    }

    const bluesky = getBlueskyService();
    
    if (!bluesky.isLoggedIn()) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const result = await bluesky.repost(decodeURIComponent(uri), cid);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Repost error:', error);
    res.status(500).json({ success: false, error: 'Failed to repost' });
  }
});

/**
 * DELETE /api/feed/reposts/:uri
 * Annule un repost
 */
router.delete('/reposts/:uri(*)', async (req: Request, res: Response) => {
  try {
    const { uri } = req.params;
    const bluesky = getBlueskyService();
    
    if (!bluesky.isLoggedIn()) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    await bluesky.unrepost(decodeURIComponent(uri));

    res.json({
      success: true,
      data: { message: 'Unreposted' }
    });
  } catch (error) {
    logger.error('Unrepost error:', error);
    res.status(500).json({ success: false, error: 'Failed to unrepost' });
  }
});

export default router;
