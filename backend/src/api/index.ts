/**
 * Index des routes API
 */

import { Router } from 'express';
import authRoutes from './auth.routes.js';
import feedRoutes from './feed.routes.js';
import profilesRoutes from './profiles.routes.js';
import notificationsRoutes from './notifications.routes.js';
import analysisRoutes from './analysis.routes.js';
import chatRoutes from './chat.routes.js';

const router = Router();

// Monter les routes
router.use('/auth', authRoutes);
router.use('/feed', feedRoutes);
router.use('/profiles', profilesRoutes);
router.use('/notifications', notificationsRoutes);
router.use('/analysis', analysisRoutes);
router.use('/chat', chatRoutes);

// Route de santé
router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

export default router;
