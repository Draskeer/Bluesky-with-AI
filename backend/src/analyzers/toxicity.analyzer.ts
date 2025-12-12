/**
 * Analyseur de Toxicité et Spam
 * 
 * Détecte le contenu potentiellement toxique, le spam,
 * et les comportements suspects.
 */

import { 
  BaseAnalyzer, 
  type AnalyzableContent, 
  type AnalysisResult,
  type AnalyzerMetadata,
  type AnalysisSeverity
} from '../types/analyzer.js';

export interface ToxicityResult {
  toxicityScore: number;
  spamScore: number;
  flags: ToxicityFlag[];
  details: {
    hasExcessiveCaps: boolean;
    hasRepeatedChars: boolean;
    hasSpamPatterns: boolean;
    hasProfanity: boolean;
    hasAggressiveLanguage: boolean;
    linkCount: number;
    hashtagCount: number;
    mentionCount: number;
  };
  recommendation: 'safe' | 'review' | 'flag' | 'block';
}

export interface ToxicityFlag {
  type: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
}

// Patterns de spam courants
const SPAM_PATTERNS = [
  /follow\s*(?:me|back|4follow)/i,
  /free\s*(?:crypto|bitcoin|money|giveaway)/i,
  /click\s*(?:here|link|now)/i,
  /limited\s*time\s*offer/i,
  /dm\s*(?:me|now|for)/i,
  /make\s*money\s*(?:fast|online|now)/i,
  /\$\d+(?:k|K)?\s*(?:per|a)\s*(?:day|week|month)/i
];

// Mots agressifs/toxiques (liste simplifiée, à enrichir)
const TOXIC_WORDS = new Set([
  // Ajoutez vos mots selon vos besoins
  'idiot', 'stupid', 'dumb', 'loser', 'moron',
  'shut up', 'stfu', 'kys', 'kill yourself'
]);

export class ToxicityAnalyzer extends BaseAnalyzer<ToxicityResult> {
  metadata: AnalyzerMetadata = {
    id: 'toxicity',
    name: 'Toxicity & Spam Analyzer',
    description: 'Détecte le contenu toxique, le spam et les comportements suspects',
    version: '1.0.0',
    author: 'Bluesky Client',
    category: 'toxicity',
    supportedTypes: ['post', 'thread']
  };

  async analyze(content: AnalyzableContent): Promise<AnalysisResult<ToxicityResult> | null> {
    if (content.type !== 'post' && content.type !== 'thread') {
      return null;
    }

    const text = content.type === 'post' 
      ? content.data.record.text 
      : content.data.post.record.text;

    const facets = content.type === 'post'
      ? content.data.record.facets
      : content.data.post.record.facets;

    const result = this.analyzeContent(text, facets);
    
    return this.createResult(content, result, {
      score: (result.toxicityScore + result.spamScore) / 2,
      severity: this.determineSeverity(result),
      tags: this.generateTags(result)
    });
  }

  private analyzeContent(text: string, facets?: unknown[]): ToxicityResult {
    const flags: ToxicityFlag[] = [];
    
    // Analyse des patterns
    const hasExcessiveCaps = this.checkExcessiveCaps(text);
    const hasRepeatedChars = this.checkRepeatedChars(text);
    const hasSpamPatterns = this.checkSpamPatterns(text);
    const hasProfanity = this.checkProfanity(text);
    const hasAggressiveLanguage = this.checkAggressiveLanguage(text);
    
    // Compter les éléments
    const linkCount = this.countLinks(facets);
    const hashtagCount = this.countHashtags(text);
    const mentionCount = this.countMentions(facets);

    // Générer les flags
    if (hasExcessiveCaps) {
      flags.push({
        type: 'excessive_caps',
        severity: 'low',
        description: 'Usage excessif de majuscules'
      });
    }

    if (hasRepeatedChars) {
      flags.push({
        type: 'repeated_chars',
        severity: 'low',
        description: 'Caractères répétés excessivement'
      });
    }

    if (hasSpamPatterns) {
      flags.push({
        type: 'spam_pattern',
        severity: 'medium',
        description: 'Patterns de spam détectés'
      });
    }

    if (hasProfanity) {
      flags.push({
        type: 'profanity',
        severity: 'medium',
        description: 'Langage vulgaire détecté'
      });
    }

    if (hasAggressiveLanguage) {
      flags.push({
        type: 'aggressive',
        severity: 'high',
        description: 'Langage agressif ou menaçant'
      });
    }

    if (linkCount > 3) {
      flags.push({
        type: 'excessive_links',
        severity: 'medium',
        description: `Nombre élevé de liens (${linkCount})`
      });
    }

    if (mentionCount > 5) {
      flags.push({
        type: 'excessive_mentions',
        severity: 'medium',
        description: `Mentions excessives (${mentionCount})`
      });
    }

    // Calculer les scores
    const toxicityScore = this.calculateToxicityScore(flags, hasAggressiveLanguage, hasProfanity);
    const spamScore = this.calculateSpamScore(flags, linkCount, hashtagCount, hasSpamPatterns);

    return {
      toxicityScore,
      spamScore,
      flags,
      details: {
        hasExcessiveCaps,
        hasRepeatedChars,
        hasSpamPatterns,
        hasProfanity,
        hasAggressiveLanguage,
        linkCount,
        hashtagCount,
        mentionCount
      },
      recommendation: this.getRecommendation(toxicityScore, spamScore)
    };
  }

  private checkExcessiveCaps(text: string): boolean {
    const letters = text.replace(/[^a-zA-Z]/g, '');
    if (letters.length < 10) return false;
    
    const upperCount = (text.match(/[A-Z]/g) || []).length;
    return upperCount / letters.length > 0.7;
  }

  private checkRepeatedChars(text: string): boolean {
    return /(.)\1{4,}/i.test(text);
  }

  private checkSpamPatterns(text: string): boolean {
    return SPAM_PATTERNS.some(pattern => pattern.test(text));
  }

  private checkProfanity(text: string): boolean {
    const words = text.toLowerCase().split(/\s+/);
    return words.some(word => TOXIC_WORDS.has(word));
  }

  private checkAggressiveLanguage(text: string): boolean {
    const aggressivePatterns = [
      /kill\s*(?:you|yourself)/i,
      /i'?ll\s*(?:hurt|destroy|ruin)/i,
      /you\s*(?:deserve\s*to\s*die|should\s*die)/i,
      /threat|threaten/i
    ];
    return aggressivePatterns.some(p => p.test(text));
  }

  private countLinks(facets?: unknown[]): number {
    if (!Array.isArray(facets)) return 0;
    return facets.filter((f: any) => 
      f?.features?.some((feat: any) => feat?.$type?.includes('link'))
    ).length;
  }

  private countHashtags(text: string): number {
    return (text.match(/#\w+/g) || []).length;
  }

  private countMentions(facets?: unknown[]): number {
    if (!Array.isArray(facets)) return 0;
    return facets.filter((f: any) => 
      f?.features?.some((feat: any) => feat?.$type?.includes('mention'))
    ).length;
  }

  private calculateToxicityScore(
    flags: ToxicityFlag[], 
    aggressive: boolean, 
    profanity: boolean
  ): number {
    let score = 0;
    
    flags.forEach(flag => {
      switch (flag.severity) {
        case 'high': score += 30; break;
        case 'medium': score += 15; break;
        case 'low': score += 5; break;
      }
    });

    if (aggressive) score += 40;
    if (profanity) score += 20;

    return Math.min(100, score);
  }

  private calculateSpamScore(
    flags: ToxicityFlag[],
    linkCount: number,
    hashtagCount: number,
    hasSpamPatterns: boolean
  ): number {
    let score = 0;

    if (hasSpamPatterns) score += 40;
    if (linkCount > 3) score += linkCount * 5;
    if (hashtagCount > 5) score += hashtagCount * 3;
    
    flags
      .filter(f => ['spam_pattern', 'excessive_links', 'excessive_mentions'].includes(f.type))
      .forEach(() => score += 10);

    return Math.min(100, score);
  }

  private getRecommendation(toxicity: number, spam: number): ToxicityResult['recommendation'] {
    const maxScore = Math.max(toxicity, spam);
    
    if (maxScore >= 70) return 'block';
    if (maxScore >= 50) return 'flag';
    if (maxScore >= 25) return 'review';
    return 'safe';
  }

  private determineSeverity(result: ToxicityResult): AnalysisSeverity {
    switch (result.recommendation) {
      case 'block': return 'critical';
      case 'flag': return 'alert';
      case 'review': return 'warning';
      default: return 'info';
    }
  }

  private generateTags(result: ToxicityResult): string[] {
    const tags = [`recommendation:${result.recommendation}`];
    
    if (result.toxicityScore > 50) tags.push('toxic');
    if (result.spamScore > 50) tags.push('spam');
    
    result.flags.forEach(f => tags.push(`flag:${f.type}`));
    
    return tags;
  }
}
