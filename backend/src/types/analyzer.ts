/**
 * Système d'analyse extensible
 * 
 * Ce module définit les interfaces pour créer des analyseurs personnalisés.
 * Chaque analyseur peut traiter les posts, profils, ou autres données Bluesky.
 */

import type { BlueskyPost, BlueskyProfile, Notification, Thread } from './bluesky.js';

/**
 * Types de données que les analyseurs peuvent traiter
 */
export type AnalyzableContent = 
  | { type: 'post'; data: BlueskyPost }
  | { type: 'profile'; data: BlueskyProfile }
  | { type: 'notification'; data: Notification }
  | { type: 'thread'; data: Thread }
  | { type: 'feed'; data: BlueskyPost[] };

/**
 * Niveau de sévérité pour les résultats d'analyse
 */
export type AnalysisSeverity = 'info' | 'warning' | 'alert' | 'critical';

/**
 * Catégorie d'analyse
 */
export type AnalysisCategory = 
  | 'sentiment'
  | 'toxicity'
  | 'spam'
  | 'engagement'
  | 'network'
  | 'content'
  | 'behavior'
  | 'custom';

/**
 * Résultat d'une analyse individuelle
 */
export interface AnalysisResult<T = unknown> {
  analyzerId: string;
  analyzerName: string;
  category: AnalysisCategory;
  timestamp: Date;
  contentRef: {
    type: AnalyzableContent['type'];
    uri?: string;
    did?: string;
  };
  score?: number;
  severity?: AnalysisSeverity;
  tags: string[];
  data: T;
  metadata?: Record<string, unknown>;
}

/**
 * Configuration d'un analyseur
 */
export interface AnalyzerConfig {
  enabled: boolean;
  priority: number;
  options?: Record<string, unknown>;
}

/**
 * Métadonnées d'un analyseur
 */
export interface AnalyzerMetadata {
  id: string;
  name: string;
  description: string;
  version: string;
  author?: string;
  category: AnalysisCategory;
  supportedTypes: AnalyzableContent['type'][];
}

/**
 * Interface principale pour créer un analyseur
 * 
 * @example
 * ```typescript
 * class SentimentAnalyzer implements Analyzer<SentimentResult> {
 *   metadata = {
 *     id: 'sentiment',
 *     name: 'Sentiment Analyzer',
 *     description: 'Analyse le sentiment des posts',
 *     version: '1.0.0',
 *     category: 'sentiment' as const,
 *     supportedTypes: ['post' as const]
 *   };
 *   
 *   async analyze(content: AnalyzableContent): Promise<AnalysisResult<SentimentResult>> {
 *     // Implémentation de l'analyse
 *   }
 * }
 * ```
 */
export interface Analyzer<T = unknown> {
  metadata: AnalyzerMetadata;
  
  /**
   * Initialise l'analyseur (appelé une fois au démarrage)
   */
  initialize?(): Promise<void>;
  
  /**
   * Nettoie les ressources (appelé à l'arrêt)
   */
  cleanup?(): Promise<void>;
  
  /**
   * Analyse le contenu fourni
   */
  analyze(content: AnalyzableContent): Promise<AnalysisResult<T> | null>;
  
  /**
   * Vérifie si l'analyseur peut traiter ce type de contenu
   */
  canAnalyze(content: AnalyzableContent): boolean;
  
  /**
   * Configure l'analyseur avec des options personnalisées
   */
  configure?(options: Record<string, unknown>): void;
}

/**
 * Classe de base abstraite pour faciliter la création d'analyseurs
 */
export abstract class BaseAnalyzer<T = unknown> implements Analyzer<T> {
  abstract metadata: AnalyzerMetadata;
  protected config: Record<string, unknown> = {};

  async initialize(): Promise<void> {
    // Override si nécessaire
  }

  async cleanup(): Promise<void> {
    // Override si nécessaire
  }

  abstract analyze(content: AnalyzableContent): Promise<AnalysisResult<T> | null>;

  canAnalyze(content: AnalyzableContent): boolean {
    return this.metadata.supportedTypes.includes(content.type);
  }

  configure(options: Record<string, unknown>): void {
    this.config = { ...this.config, ...options };
  }

  /**
   * Helper pour créer un résultat d'analyse standardisé
   */
  protected createResult(
    content: AnalyzableContent,
    data: T,
    options: Partial<Omit<AnalysisResult<T>, 'analyzerId' | 'analyzerName' | 'category' | 'timestamp' | 'contentRef' | 'data'>> = {}
  ): AnalysisResult<T> {
    return {
      analyzerId: this.metadata.id,
      analyzerName: this.metadata.name,
      category: this.metadata.category,
      timestamp: new Date(),
      contentRef: this.extractContentRef(content),
      data,
      tags: options.tags || [],
      score: options.score,
      severity: options.severity,
      metadata: options.metadata
    };
  }

  private extractContentRef(content: AnalyzableContent): AnalysisResult['contentRef'] {
    switch (content.type) {
      case 'post':
        return { type: 'post', uri: content.data.uri };
      case 'profile':
        return { type: 'profile', did: content.data.did };
      case 'notification':
        return { type: 'notification', uri: content.data.uri };
      case 'thread':
        return { type: 'thread', uri: content.data.post.uri };
      case 'feed':
        return { type: 'feed' };
    }
  }
}

/**
 * Événements émis par le système d'analyse
 */
export interface AnalysisEvents {
  'analysis:started': { content: AnalyzableContent; analyzers: string[] };
  'analysis:completed': { content: AnalyzableContent; results: AnalysisResult[] };
  'analysis:error': { content: AnalyzableContent; analyzerId: string; error: Error };
  'analyzer:registered': { metadata: AnalyzerMetadata };
  'analyzer:unregistered': { analyzerId: string };
}

/**
 * Options pour le gestionnaire d'analyseurs
 */
export interface AnalysisManagerOptions {
  runInParallel: boolean;
  maxConcurrentAnalyses: number;
  timeoutMs: number;
  continueOnError: boolean;
}

/**
 * Statistiques d'analyse
 */
export interface AnalysisStats {
  totalAnalyses: number;
  successfulAnalyses: number;
  failedAnalyses: number;
  averageTimeMs: number;
  analyzerStats: Map<string, {
    runs: number;
    successes: number;
    failures: number;
    avgTimeMs: number;
  }>;
}
