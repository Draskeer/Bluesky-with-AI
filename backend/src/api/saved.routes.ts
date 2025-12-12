/**
 * Routes pour les posts sauvegardés (bookmarks)
 * Note: Bluesky n'a pas de fonctionnalité native de bookmarks,
 * donc on utilise le stockage local côté client ou une implémentation personnalisée
 */

import { Router, type Request, type Response } from 'express';
import { getBlueskyService } from '../services/bluesky.service.js';
import { logger } from '../utils/logger.js';

const router = Router();

// Stockage temporaire en mémoire (dans une vraie app, utiliser une BDD)
const savedPosts: Map<string, string[]> = new Map();

/**
 * GET /api/saved
 * Get user's saved posts
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const bluesky = getBlueskyService();
    
    if (!bluesky.isLoggedIn()) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const agent = (bluesky as any).getAgent();
    const userDid = agent.session?.did;
    
    const savedUris = savedPosts.get(userDid) || [];
    
    if (savedUris.length === 0) {
      res.json({
        success: true,
        data: {
          posts: []
        }
      });
      return;
    }

    // Fetch the actual posts
    const posts = [];
    for (const uri of savedUris) {
      try {
        const result = await agent.app.bsky.feed.getPosts({ uris: [uri] });
        if (result.data.posts && result.data.posts.length > 0) {
          posts.push({
            post: result.data.posts[0]
          });
        }
      } catch (e) {
        // Post may have been deleted
        logger.warn(`Failed to fetch saved post ${uri}:`, e);
      }
    }

    res.json({
      success: true,
      data: {
        posts
      }
    });
  } catch (error) {
    logger.error('Get saved posts error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch saved posts' });
  }
});

/**
 * POST /api/saved/:uri
 * Save a post
 */
router.post('/:uri(*)', async (req: Request, res: Response) => {
  try {
    const postUri = req.params.uri;
    const bluesky = getBlueskyService();
    
    if (!bluesky.isLoggedIn()) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const agent = (bluesky as any).getAgent();
    const userDid = agent.session?.did;
    
    const userSaved = savedPosts.get(userDid) || [];
    if (!userSaved.includes(postUri)) {
      userSaved.push(postUri);
      savedPosts.set(userDid, userSaved);
    }

    res.json({
      success: true,
      message: 'Post saved'
    });
  } catch (error) {
    logger.error('Save post error:', error);
    res.status(500).json({ success: false, error: 'Failed to save post' });
  }
});

/**
 * DELETE /api/saved/:uri
 * Unsave a post
 */
router.delete('/:uri(*)', async (req: Request, res: Response) => {
  try {
    const postUri = req.params.uri;
    const bluesky = getBlueskyService();
    
    if (!bluesky.isLoggedIn()) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const agent = (bluesky as any).getAgent();
    const userDid = agent.session?.did;
    
    const userSaved = savedPosts.get(userDid) || [];
    const filtered = userSaved.filter(uri => uri !== postUri);
    savedPosts.set(userDid, filtered);

    res.json({
      success: true,
      message: 'Post unsaved'
    });
  } catch (error) {
    logger.error('Unsave post error:', error);
    res.status(500).json({ success: false, error: 'Failed to unsave post' });
  }
});

/**
 * GET /api/saved/check/:uri
 * Check if a post is saved
 */
router.get('/check/:uri(*)', async (req: Request, res: Response) => {
  try {
    const postUri = req.params.uri;
    const bluesky = getBlueskyService();
    
    if (!bluesky.isLoggedIn()) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const agent = (bluesky as any).getAgent();
    const userDid = agent.session?.did;
    
    const userSaved = savedPosts.get(userDid) || [];
    const isSaved = userSaved.includes(postUri);

    res.json({
      success: true,
      data: {
        saved: isSaved
      }
    });
  } catch (error) {
    logger.error('Check saved post error:', error);
    res.status(500).json({ success: false, error: 'Failed to check saved status' });
  }
});

export default router;
