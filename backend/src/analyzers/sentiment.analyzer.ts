/**
 * Analyseur de Sentiment
 * 
 * Exemple d'analyseur qui évalue le sentiment des posts.
 * Utilise une approche simple basée sur des mots-clés.
 * 
 * Pour une analyse plus avancée, vous pouvez intégrer une API
 * de NLP ou un modèle de ML.
 */

import { 
  BaseAnalyzer, 
  type AnalyzableContent, 
  type AnalysisResult,
  type AnalyzerMetadata,
  type AnalysisSeverity
} from '../types/analyzer.js';

export interface SentimentResult {
  sentiment: 'positive' | 'negative' | 'neutral' | 'mixed';
  confidence: number;
  positiveScore: number;
  negativeScore: number;
  emotions: string[];
  keywords: {
    positive: string[];
    negative: string[];
  };
}

// Dictionnaires de mots (à enrichir ou remplacer par NLP)
const POSITIVE_WORDS = new Set([
  'love', 'great', 'awesome', 'amazing', 'excellent', 'fantastic',
  'wonderful', 'beautiful', 'happy', 'joy', 'excited', 'brilliant',
  'perfect', 'best', 'thank', 'thanks', 'good', 'nice', 'cool',
  'super', 'merci', 'génial', 'magnifique', 'content', 'heureux',
  'bravo', 'félicitations', 'incroyable', 'parfait', '❤️', '😊', '🎉', '👍'
]);

const NEGATIVE_WORDS = new Set([
  'hate', 'terrible', 'awful', 'horrible', 'bad', 'worst', 'sad',
  'angry', 'disappointed', 'frustrated', 'annoying', 'stupid',
  'boring', 'ugly', 'fail', 'failed', 'wrong', 'problem', 'issue',
  'nul', 'mauvais', 'triste', 'colère', 'déçu', 'merde', 'chiant',
  'déteste', 'horrible', '😢', '😡', '👎', '💔'
]);

const EMOTION_PATTERNS: Record<string, RegExp[]> = {
  joy: [/😊|😄|🎉|happy|heureux/i],
  sadness: [/😢|😭|sad|triste/i],
  anger: [/😡|🤬|angry|colère|énervé/i],
  fear: [/😨|😱|afraid|peur/i],
  surprise: [/😮|😲|wow|incroyable/i],
  love: [/❤️|😍|love|amour|adore/i]
};

export class SentimentAnalyzer extends BaseAnalyzer<SentimentResult> {
  metadata: AnalyzerMetadata = {
    id: 'sentiment',
    name: 'Sentiment Analyzer',
    description: 'Analyse le sentiment émotionnel des posts (positif, négatif, neutre)',
    version: '1.0.0',
    author: 'Bluesky Client',
    category: 'sentiment',
    supportedTypes: ['post', 'thread']
  };

  async analyze(content: AnalyzableContent): Promise<AnalysisResult<SentimentResult> | null> {
    if (content.type !== 'post' && content.type !== 'thread') {
      return null;
    }

    const text = content.type === 'post' 
      ? content.data.record.text 
      : content.data.post.record.text;

    const result = this.analyzeSentiment(text);
    
    return this.createResult(content, result, {
      score: this.calculateOverallScore(result),
      severity: this.determineSeverity(result),
      tags: this.generateTags(result)
    });
  }

  private analyzeSentiment(text: string): SentimentResult {
    const words = text.toLowerCase().split(/\s+/);
    const foundPositive: string[] = [];
    const foundNegative: string[] = [];

    for (const word of words) {
      if (POSITIVE_WORDS.has(word)) {
        foundPositive.push(word);
      }
      if (NEGATIVE_WORDS.has(word)) {
        foundNegative.push(word);
      }
    }

    // Vérifier aussi les emojis
    for (const emoji of POSITIVE_WORDS) {
      if (text.includes(emoji) && !foundPositive.includes(emoji)) {
        foundPositive.push(emoji);
      }
    }
    for (const emoji of NEGATIVE_WORDS) {
      if (text.includes(emoji) && !foundNegative.includes(emoji)) {
        foundNegative.push(emoji);
      }
    }

    const positiveScore = foundPositive.length / Math.max(words.length, 1);
    const negativeScore = foundNegative.length / Math.max(words.length, 1);
    
    const emotions = this.detectEmotions(text);
    const sentiment = this.determineSentiment(positiveScore, negativeScore);
    const confidence = this.calculateConfidence(positiveScore, negativeScore, words.length);

    return {
      sentiment,
      confidence,
      positiveScore,
      negativeScore,
      emotions,
      keywords: {
        positive: foundPositive,
        negative: foundNegative
      }
    };
  }

  private detectEmotions(text: string): string[] {
    const emotions: string[] = [];
    
    for (const [emotion, patterns] of Object.entries(EMOTION_PATTERNS)) {
      if (patterns.some(pattern => pattern.test(text))) {
        emotions.push(emotion);
      }
    }
    
    return emotions;
  }

  private determineSentiment(
    positiveScore: number, 
    negativeScore: number
  ): SentimentResult['sentiment'] {
    const threshold = 0.02;
    
    if (positiveScore > threshold && negativeScore > threshold) {
      return 'mixed';
    }
    if (positiveScore > threshold) {
      return 'positive';
    }
    if (negativeScore > threshold) {
      return 'negative';
    }
    return 'neutral';
  }

  private calculateConfidence(
    positiveScore: number, 
    negativeScore: number, 
    wordCount: number
  ): number {
    const signalStrength = Math.abs(positiveScore - negativeScore);
    const lengthFactor = Math.min(wordCount / 20, 1);
    return Math.min(signalStrength * 5 * lengthFactor + 0.3, 1);
  }

  private calculateOverallScore(result: SentimentResult): number {
    // Score de -1 (très négatif) à +1 (très positif)
    const rawScore = result.positiveScore - result.negativeScore;
    return Math.max(-1, Math.min(1, rawScore * 10));
  }

  private determineSeverity(result: SentimentResult): AnalysisSeverity {
    if (result.sentiment === 'negative' && result.negativeScore > 0.15) {
      return 'warning';
    }
    return 'info';
  }

  private generateTags(result: SentimentResult): string[] {
    const tags = [`sentiment:${result.sentiment}`];
    
    if (result.confidence > 0.8) {
      tags.push('high-confidence');
    }
    
    result.emotions.forEach(e => tags.push(`emotion:${e}`));
    
    return tags;
  }
}
