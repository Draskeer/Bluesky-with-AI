/**
 * Routes d'authentification Bluesky
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { getBlueskyService } from '../services/bluesky.service.js';
import { logger } from '../utils/logger.js';

const router = Router();

const loginSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1)
});

const sessionSchema = z.object({
  did: z.string(),
  handle: z.string(),
  accessJwt: z.string(),
  refreshJwt: z.string()
});

/**
 * POST /api/auth/login
 * Connexion avec identifiants
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const credentials = loginSchema.parse(req.body);
    const bluesky = getBlueskyService();
    
    const session = await bluesky.login(credentials);
    
    res.json({
      success: true,
      data: session
    });
  } catch (error) {
    logger.error('Login error:', error);
    
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Invalid credentials format',
        details: error.errors
      });
      return;
    }
    
    res.status(401).json({
      success: false,
      error: 'Authentication failed'
    });
  }
});

/**
 * POST /api/auth/resume
 * Restauration de session
 */
router.post('/resume', async (req: Request, res: Response) => {
  try {
    const session = sessionSchema.parse(req.body);
    const bluesky = getBlueskyService();
    
    await bluesky.resumeSession(session);
    
    res.json({
      success: true,
      data: { message: 'Session resumed' }
    });
  } catch (error) {
    logger.error('Resume session error:', error);
    
    res.status(401).json({
      success: false,
      error: 'Failed to resume session'
    });
  }
});

/**
 * POST /api/auth/logout
 * Déconnexion
 */
router.post('/logout', (_req: Request, res: Response) => {
  const bluesky = getBlueskyService();
  bluesky.logout();
  
  res.json({
    success: true,
    data: { message: 'Logged out' }
  });
});

/**
 * GET /api/auth/session
 * État de la session
 */
router.get('/session', (_req: Request, res: Response) => {
  const bluesky = getBlueskyService();
  const session = bluesky.getSession();
  
  res.json({
    success: true,
    data: {
      isLoggedIn: bluesky.isLoggedIn(),
      session: session ? {
        did: session.did,
        handle: session.handle
      } : null
    }
  });
});

export default router;
