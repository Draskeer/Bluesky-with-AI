/**
 * Export de tous les analyseurs disponibles
 * 
 * Pour ajouter un nouvel analyseur:
 * 1. Créer un fichier dans ce dossier (ex: mon-analyseur.analyzer.ts)
 * 2. Implémenter l'interface Analyzer ou étendre BaseAnalyzer
 * 3. Exporter ici
 * 4. Enregistrer dans registerDefaultAnalyzers()
 */

export { SentimentAnalyzer, type SentimentResult } from './sentiment.analyzer.js';
export { EngagementAnalyzer, type EngagementResult } from './engagement.analyzer.js';
export { ToxicityAnalyzer, type ToxicityResult, type ToxicityFlag } from './toxicity.analyzer.js';
export { ContentAnalyzer, type ContentAnalysisResult, type ContentType } from './content.analyzer.js';

import { AnalysisManager } from '../services/analysis-manager.js';
import { SentimentAnalyzer } from './sentiment.analyzer.js';
import { EngagementAnalyzer } from './engagement.analyzer.js';
import { ToxicityAnalyzer } from './toxicity.analyzer.js';
import { ContentAnalyzer } from './content.analyzer.js';

/**
 * Enregistre tous les analyseurs par défaut
 */
export function registerDefaultAnalyzers(manager: AnalysisManager): void {
  manager.register(new SentimentAnalyzer(), { priority: 10 });
  manager.register(new EngagementAnalyzer(), { priority: 8 });
  manager.register(new ToxicityAnalyzer(), { priority: 15 }); // Priorité haute
  manager.register(new ContentAnalyzer(), { priority: 5 });
}
