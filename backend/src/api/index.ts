/**
 * Index des routes API
 */

import { Router } from 'express';
import authRoutes from './auth.routes.js';
import feedRoutes from './feed.routes.js';
import feedsRoutes from './feeds.routes.js';
import profilesRoutes from './profiles.routes.js';
import notificationsRoutes from './notifications.routes.js';
import analysisRoutes from './analysis.routes.js';
import chatRoutes from './chat.routes.js';
import listsRoutes from './lists.routes.js';
import savedRoutes from './saved.routes.js';
import dashboardRoutes from './dashboard.routes.js';

const router = Router();

// Monter les routes
router.use('/auth', authRoutes);
router.use('/feed', feedRoutes);
router.use('/feeds', feedsRoutes);
router.use('/profiles', profilesRoutes);
router.use('/notifications', notificationsRoutes);
router.use('/analysis', analysisRoutes);
router.use('/chat', chatRoutes);
router.use('/lists', listsRoutes);
router.use('/saved', savedRoutes);
router.use('/dashboard', dashboardRoutes);

// Route de santé
router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

export default router;
