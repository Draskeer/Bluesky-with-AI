/**
 * Routes pour le système d'analyse
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { getAnalysisManager } from '../services/analysis-manager.js';
import { getBlueskyService } from '../services/bluesky.service.js';
import { logger } from '../utils/logger.js';
import type { AnalyzableContent } from '../types/analyzer.js';

const router = Router();

const analyzePostSchema = z.object({
  uri: z.string(),
  includeThread: z.boolean().optional()
});

const analyzeTextSchema = z.object({
  text: z.string().min(1)
});

const configureAnalyzerSchema = z.object({
  enabled: z.boolean().optional(),
  priority: z.number().optional(),
  options: z.record(z.unknown()).optional()
});

/**
 * GET /api/analysis/analyzers
 * Liste tous les analyseurs disponibles
 */
router.get('/analyzers', (_req: Request, res: Response) => {
  const manager = getAnalysisManager();
  const analyzers = manager.getAnalyzers();
  
  const result = analyzers.map(meta => ({
    ...meta,
    config: manager.getConfig(meta.id)
  }));

  res.json({
    success: true,
    data: result
  });
});

/**
 * GET /api/analysis/analyzers/:id
 * Détails d'un analyseur
 */
router.get('/analyzers/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const manager = getAnalysisManager();
  
  const analyzers = manager.getAnalyzers();
  const analyzer = analyzers.find(a => a.id === id);
  
  if (!analyzer) {
    res.status(404).json({ success: false, error: 'Analyzer not found' });
    return;
  }

  res.json({
    success: true,
    data: {
      ...analyzer,
      config: manager.getConfig(id)
    }
  });
});

/**
 * PATCH /api/analysis/analyzers/:id
 * Configure un analyseur
 */
router.patch('/analyzers/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const config = configureAnalyzerSchema.parse(req.body);
    
    const manager = getAnalysisManager();
    manager.configure(id, config);

    res.json({
      success: true,
      data: {
        id,
        config: manager.getConfig(id)
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Invalid configuration',
        details: error.errors
      });
      return;
    }
    
    if (error instanceof Error && error.message.includes('not found')) {
      res.status(404).json({ success: false, error: error.message });
      return;
    }
    
    logger.error('Configure analyzer error:', error);
    res.status(500).json({ success: false, error: 'Failed to configure analyzer' });
  }
});

/**
 * POST /api/analysis/analyzers/:id/toggle
 * Active/désactive un analyseur
 */
router.post('/analyzers/:id/toggle', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { enabled } = req.body;
    
    if (typeof enabled !== 'boolean') {
      res.status(400).json({ success: false, error: 'enabled must be a boolean' });
      return;
    }

    const manager = getAnalysisManager();
    manager.setEnabled(id, enabled);

    res.json({
      success: true,
      data: {
        id,
        enabled,
        config: manager.getConfig(id)
      }
    });
  } catch (error) {
    logger.error('Toggle analyzer error:', error);
    res.status(500).json({ success: false, error: 'Failed to toggle analyzer' });
  }
});

/**
 * POST /api/analysis/post
 * Analyse un post par son URI
 */
router.post('/post', async (req: Request, res: Response) => {
  try {
    const { uri, includeThread } = analyzePostSchema.parse(req.body);
    
    const bluesky = getBlueskyService();
    const manager = getAnalysisManager();
    
    let content: AnalyzableContent;
    
    if (includeThread) {
      const thread = await bluesky.getThread(uri);
      content = { type: 'thread', data: thread };
    } else {
      const thread = await bluesky.getThread(uri, 0);
      content = { type: 'post', data: thread.post };
    }

    const results = await manager.analyze(content);

    res.json({
      success: true,
      data: {
        uri,
        contentType: content.type,
        results
      }
    });
  } catch (error) {
    logger.error('Analyze post error:', error);
    
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Invalid request',
        details: error.errors
      });
      return;
    }
    
    res.status(500).json({ success: false, error: 'Analysis failed' });
  }
});

/**
 * POST /api/analysis/text
 * Analyse un texte brut (sans post Bluesky)
 */
router.post('/text', async (req: Request, res: Response) => {
  try {
    const { text } = analyzeTextSchema.parse(req.body);
    
    const manager = getAnalysisManager();
    
    // Créer un pseudo-post pour l'analyse
    const mockPost = {
      uri: 'mock://text-analysis',
      cid: 'mock',
      author: {
        did: 'mock',
        handle: 'mock',
        followersCount: 0,
        followsCount: 0,
        postsCount: 0
      },
      record: {
        $type: 'app.bsky.feed.post',
        text,
        createdAt: new Date().toISOString()
      },
      replyCount: 0,
      repostCount: 0,
      likeCount: 0,
      indexedAt: new Date().toISOString()
    };

    const content: AnalyzableContent = { type: 'post', data: mockPost as any };
    const results = await manager.analyze(content);

    res.json({
      success: true,
      data: {
        text,
        results
      }
    });
  } catch (error) {
    logger.error('Analyze text error:', error);
    
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Invalid request',
        details: error.errors
      });
      return;
    }
    
    res.status(500).json({ success: false, error: 'Analysis failed' });
  }
});

/**
 * POST /api/analysis/profile
 * Analyse un profil
 */
router.post('/profile', async (req: Request, res: Response) => {
  try {
    const { actor } = req.body;
    
    if (!actor) {
      res.status(400).json({ success: false, error: 'actor is required' });
      return;
    }

    const bluesky = getBlueskyService();
    const manager = getAnalysisManager();
    
    const profile = await bluesky.getProfile(actor);
    const content: AnalyzableContent = { type: 'profile', data: profile };
    
    const results = await manager.analyze(content);

    res.json({
      success: true,
      data: {
        profile,
        results
      }
    });
  } catch (error) {
    logger.error('Analyze profile error:', error);
    res.status(500).json({ success: false, error: 'Analysis failed' });
  }
});

/**
 * POST /api/analysis/batch
 * Analyse un lot de posts
 */
router.post('/batch', async (req: Request, res: Response) => {
  try {
    const { uris } = req.body;
    
    if (!Array.isArray(uris) || uris.length === 0) {
      res.status(400).json({ success: false, error: 'uris array is required' });
      return;
    }

    if (uris.length > 50) {
      res.status(400).json({ success: false, error: 'Maximum 50 posts per batch' });
      return;
    }

    const bluesky = getBlueskyService();
    const manager = getAnalysisManager();
    
    const results: Record<string, any> = {};
    
    // Traiter en parallèle avec limite
    const batchSize = 10;
    for (let i = 0; i < uris.length; i += batchSize) {
      const batch = uris.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (uri: string) => {
        try {
          const thread = await bluesky.getThread(uri, 0);
          const content: AnalyzableContent = { type: 'post', data: thread.post };
          results[uri] = await manager.analyze(content);
        } catch (error) {
          results[uri] = { error: 'Failed to analyze' };
        }
      }));
    }

    res.json({
      success: true,
      data: {
        count: uris.length,
        results
      }
    });
  } catch (error) {
    logger.error('Batch analysis error:', error);
    res.status(500).json({ success: false, error: 'Batch analysis failed' });
  }
});

/**
 * GET /api/analysis/stats
 * Statistiques du système d'analyse
 */
router.get('/stats', (_req: Request, res: Response) => {
  const manager = getAnalysisManager();
  const stats = manager.getStats();

  // Convertir Map en objet pour JSON
  const analyzerStats: Record<string, any> = {};
  stats.analyzerStats.forEach((value, key) => {
    analyzerStats[key] = value;
  });

  res.json({
    success: true,
    data: {
      ...stats,
      analyzerStats
    }
  });
});

/**
 * POST /api/analysis/stats/reset
 * Réinitialise les statistiques
 */
router.post('/stats/reset', (_req: Request, res: Response) => {
  const manager = getAnalysisManager();
  manager.resetStats();

  res.json({
    success: true,
    data: { message: 'Stats reset' }
  });
});

export default router;
