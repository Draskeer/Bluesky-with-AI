/**
 * Point d'entrée principal du serveur
 * 
 * Bluesky Client Backend avec système d'analyse extensible
 */

import express from 'express';
import cors from 'cors';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import { getAnalysisManager } from './services/analysis-manager.js';
import { registerDefaultAnalyzers } from './analyzers/index.js';
import { initializeDatabase } from './services/db.js';
import apiRoutes from './api/index.js';

async function bootstrap() {
  const app = express();

  // Middleware
  app.use(cors({
    origin: config.CORS_ORIGIN,
    credentials: true
  }));
  app.use(express.json());

  // Logging des requêtes
  app.use((req, _res, next) => {
    logger.debug(`${req.method} ${req.path}`);
    next();
  });

  // Routes API
  app.use('/api', apiRoutes);

  // 404 handler
  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      error: 'Not found'
    });
  });

  // Error handler
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error('Unhandled error:', err);
    res.status(500).json({
      success: false,
      error: config.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
  });

  // Initialiser la base de données (crée post_reports si absent)
  try {
    await initializeDatabase();
    logger.info('Database initialized');
  } catch (err) {
    logger.warn('Database initialization failed (will retry on next request):', err);
  }

  // Initialiser le gestionnaire d'analyse
  const analysisManager = getAnalysisManager({
    runInParallel: config.ANALYSIS_PARALLEL,
    maxConcurrentAnalyses: config.ANALYSIS_MAX_CONCURRENT,
    timeoutMs: config.ANALYSIS_TIMEOUT_MS,
    continueOnError: true
  });

  // Enregistrer les analyseurs par défaut
  registerDefaultAnalyzers(analysisManager);

  // Initialiser les analyseurs
  await analysisManager.initialize();

  // Démarrer le serveur
  app.listen(config.PORT, () => {
    logger.info(`🚀 Server running on http://localhost:${config.PORT}`);
    logger.info(`📊 ${analysisManager.getAnalyzers().length} analyzers loaded`);
    logger.info(`🔧 Environment: ${config.NODE_ENV}`);
  });

  // Gestion de l'arrêt propre
  const shutdown = async () => {
    logger.info('Shutting down...');
    await analysisManager.shutdown();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrap().catch((error) => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});
