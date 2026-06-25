/**
 * Gestionnaire d'analyseurs
 * 
 * Ce module gère l'enregistrement, la configuration et l'exécution
 * des analyseurs de contenu Bluesky.
 */

import EventEmitter from 'eventemitter3';
import type {
  Analyzer,
  AnalyzableContent,
  AnalysisResult,
  AnalyzerConfig,
  AnalysisManagerOptions,
  AnalysisEvents,
  AnalysisStats,
  AnalyzerMetadata
} from '../types/analyzer.js';
import { logger } from '../utils/logger.js';

const DEFAULT_OPTIONS: AnalysisManagerOptions = {
  runInParallel: true,
  maxConcurrentAnalyses: 10,
  timeoutMs: 30000,
  continueOnError: true
};

export class AnalysisManager extends EventEmitter<AnalysisEvents> {
  private analyzers: Map<string, Analyzer> = new Map();
  private configs: Map<string, AnalyzerConfig> = new Map();
  private options: AnalysisManagerOptions;
  private stats: AnalysisStats;
  private initialized = false;

  constructor(options: Partial<AnalysisManagerOptions> = {}) {
    super();
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.stats = this.createInitialStats();
  }

  private createInitialStats(): AnalysisStats {
    return {
      totalAnalyses: 0,
      successfulAnalyses: 0,
      failedAnalyses: 0,
      averageTimeMs: 0,
      analyzerStats: new Map()
    };
  }

  /**
   * Initialise tous les analyseurs enregistrés
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    logger.info('Initializing analysis manager...');
    
    const initPromises = Array.from(this.analyzers.values()).map(async (analyzer) => {
      try {
        if (analyzer.initialize) {
          await analyzer.initialize();
        }
        logger.info(`Analyzer initialized: ${analyzer.metadata.id}`);
      } catch (error) {
        logger.error(`Failed to initialize analyzer ${analyzer.metadata.id}:`, error);
        throw error;
      }
    });

    await Promise.all(initPromises);
    this.initialized = true;
    logger.info(`Analysis manager initialized with ${this.analyzers.size} analyzers`);
  }

  /**
   * Arrête tous les analyseurs
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down analysis manager...');
    
    const cleanupPromises = Array.from(this.analyzers.values()).map(async (analyzer) => {
      try {
        if (analyzer.cleanup) {
          await analyzer.cleanup();
        }
      } catch (error) {
        logger.error(`Error cleaning up analyzer ${analyzer.metadata.id}:`, error);
      }
    });

    await Promise.all(cleanupPromises);
    this.initialized = false;
    logger.info('Analysis manager shut down');
  }

  /**
   * Enregistre un nouvel analyseur
   */
  register<T>(analyzer: Analyzer<T>, config: Partial<AnalyzerConfig> = {}): void {
    const { id } = analyzer.metadata;
    
    if (this.analyzers.has(id)) {
      throw new Error(`Analyzer with id '${id}' is already registered`);
    }

    this.analyzers.set(id, analyzer as Analyzer);
    this.configs.set(id, {
      enabled: true,
      priority: 0,
      ...config
    });

    this.stats.analyzerStats.set(id, {
      runs: 0,
      successes: 0,
      failures: 0,
      avgTimeMs: 0
    });

    this.emit('analyzer:registered', { metadata: analyzer.metadata });
    logger.info(`Registered analyzer: ${analyzer.metadata.name} (${id})`);
  }

  /**
   * Configure un analyseur existant
   */
  configure(analyzerId: string, config: Partial<AnalyzerConfig>): void {
    const existing = this.configs.get(analyzerId);
    if (!existing) {
      throw new Error(`Analyzer '${analyzerId}' not found`);
    }
    
    this.configs.set(analyzerId, { ...existing, ...config });
    
    const analyzer = this.analyzers.get(analyzerId);
    if (analyzer?.configure && config.options) {
      analyzer.configure(config.options);
    }
  }

  /**
   * Active/désactive un analyseur
   */
  setEnabled(analyzerId: string, enabled: boolean): void {
    this.configure(analyzerId, { enabled });
  }

  /**
   * Retourne les métadonnées de tous les analyseurs
   */
  getAnalyzers(): AnalyzerMetadata[] {
    return Array.from(this.analyzers.values()).map(a => a.metadata);
  }

  /**
   * Retourne la configuration d'un analyseur
   */
  getConfig(analyzerId: string): AnalyzerConfig | undefined {
    return this.configs.get(analyzerId);
  }

  /**
   * Analyse le contenu avec tous les analyseurs actifs et compatibles
   */
  async analyze(content: AnalyzableContent): Promise<AnalysisResult[]> {
    const startTime = Date.now();
    
    // Filtrer les analyseurs actifs et compatibles
    const activeAnalyzers = this.getActiveAnalyzersFor(content);
    
    if (activeAnalyzers.length === 0) {
      logger.debug(`No active analyzers for content type: ${content.type}`);
      return [];
    }

    const analyzerIds = activeAnalyzers.map(a => a.metadata.id);
    this.emit('analysis:started', { content, analyzers: analyzerIds });

    let results: AnalysisResult[];

    if (this.options.runInParallel) {
      results = await this.runParallel(content, activeAnalyzers);
    } else {
      results = await this.runSequential(content, activeAnalyzers);
    }

    const duration = Date.now() - startTime;
    this.updateStats(duration, results.length, activeAnalyzers.length - results.length);

    this.emit('analysis:completed', { content, results });
    
    return results;
  }

  /**
   * Retourne les statistiques d'analyse
   */
  getStats(): AnalysisStats {
    return { ...this.stats };
  }

  /**
   * Réinitialise les statistiques
   */
  resetStats(): void {
    this.stats = this.createInitialStats();
  }

  private getActiveAnalyzersFor(content: AnalyzableContent): Analyzer[] {
    return Array.from(this.analyzers.entries())
      .filter(([id, analyzer]) => {
        const config = this.configs.get(id);
        return config?.enabled && analyzer.canAnalyze(content);
      })
      .sort((a, b) => {
        const priorityA = this.configs.get(a[0])?.priority ?? 0;
        const priorityB = this.configs.get(b[0])?.priority ?? 0;
        return priorityB - priorityA;
      })
      .map(([_, analyzer]) => analyzer);
  }

  private async runParallel(
    content: AnalyzableContent,
    analyzers: Analyzer[]
  ): Promise<AnalysisResult[]> {
    const results: AnalysisResult[] = [];
    
    // Limiter la concurrence
    const chunks = this.chunkArray(analyzers, this.options.maxConcurrentAnalyses);
    
    for (const chunk of chunks) {
      const chunkResults = await Promise.allSettled(
        chunk.map(analyzer => this.runAnalyzer(content, analyzer))
      );

      for (let i = 0; i < chunkResults.length; i++) {
        const result = chunkResults[i];
        const analyzer = chunk[i];
        
        if (result.status === 'fulfilled' && result.value) {
          results.push(result.value);
        } else if (result.status === 'rejected') {
          const error = result.reason instanceof Error 
            ? result.reason 
            : new Error(String(result.reason));
          
          this.emit('analysis:error', {
            content,
            analyzerId: analyzer.metadata.id,
            error
          });
          
          if (!this.options.continueOnError) {
            throw error;
          }
        }
      }
    }

    return results;
  }

  private async runSequential(
    content: AnalyzableContent,
    analyzers: Analyzer[]
  ): Promise<AnalysisResult[]> {
    const results: AnalysisResult[] = [];

    for (const analyzer of analyzers) {
      try {
        const result = await this.runAnalyzer(content, analyzer);
        if (result) {
          results.push(result);
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        
        this.emit('analysis:error', {
          content,
          analyzerId: analyzer.metadata.id,
          error: err
        });
        
        if (!this.options.continueOnError) {
          throw err;
        }
      }
    }

    return results;
  }

  private async runAnalyzer(
    content: AnalyzableContent,
    analyzer: Analyzer
  ): Promise<AnalysisResult | null> {
    const startTime = Date.now();
    const stats = this.stats.analyzerStats.get(analyzer.metadata.id);

    try {
      const result = await Promise.race([
        analyzer.analyze(content),
        this.createTimeout(analyzer.metadata.id)
      ]);

      const duration = Date.now() - startTime;
      
      if (stats) {
        stats.runs++;
        stats.successes++;
        stats.avgTimeMs = (stats.avgTimeMs * (stats.runs - 1) + duration) / stats.runs;
      }

      return result;
    } catch (error) {
      if (stats) {
        stats.runs++;
        stats.failures++;
      }
      throw error;
    }
  }

  private createTimeout(analyzerId: string): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Analyzer '${analyzerId}' timed out after ${this.options.timeoutMs}ms`));
      }, this.options.timeoutMs);
    });
  }

  private updateStats(duration: number, successes: number, failures: number): void {
    const prevTotal = this.stats.totalAnalyses;
    const prevAvg = this.stats.averageTimeMs;
    
    this.stats.totalAnalyses++;
    this.stats.successfulAnalyses += successes;
    this.stats.failedAnalyses += failures;
    this.stats.averageTimeMs = (prevAvg * prevTotal + duration) / (prevTotal + 1);
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}

// Instance singleton
let instance: AnalysisManager | null = null;

export function getAnalysisManager(options?: Partial<AnalysisManagerOptions>): AnalysisManager {
  if (!instance) {
    instance = new AnalysisManager(options);
  }
  return instance;
}

