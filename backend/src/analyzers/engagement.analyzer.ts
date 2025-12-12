/**
 * Analyseur d'Engagement
 * 
 * Évalue les métriques d'engagement et identifie les contenus
 * viraux ou à fort potentiel.
 */

import { 
  BaseAnalyzer, 
  type AnalyzableContent, 
  type AnalysisResult,
  type AnalyzerMetadata,
  type AnalysisSeverity
} from '../types/analyzer.js';
import type { BlueskyPost } from '../types/bluesky.js';

export interface EngagementResult {
  engagementScore: number;
  engagementRate: number;
  metrics: {
    likes: number;
    reposts: number;
    replies: number;
    total: number;
  };
  category: 'viral' | 'high' | 'medium' | 'low' | 'minimal';
  insights: string[];
  replyToLikeRatio: number;
  viralPotential: number;
}

export class EngagementAnalyzer extends BaseAnalyzer<EngagementResult> {
  metadata: AnalyzerMetadata = {
    id: 'engagement',
    name: 'Engagement Analyzer',
    description: 'Analyse les métriques d\'engagement des posts',
    version: '1.0.0',
    author: 'Bluesky Client',
    category: 'engagement',
    supportedTypes: ['post', 'feed']
  };

  async analyze(content: AnalyzableContent): Promise<AnalysisResult<EngagementResult> | null> {
    if (content.type === 'feed') {
      // Pour un feed, analyser le post avec le plus d'engagement
      const topPost = this.findTopEngagedPost(content.data);
      if (!topPost) return null;
      return this.analyzePost(topPost);
    }

    if (content.type !== 'post') {
      return null;
    }

    return this.analyzePost(content.data);
  }

  private async analyzePost(post: BlueskyPost): Promise<AnalysisResult<EngagementResult>> {
    const result = this.calculateEngagement(post);
    
    return this.createResult(
      { type: 'post', data: post },
      result,
      {
        score: result.engagementScore,
        severity: this.determineSeverity(result),
        tags: this.generateTags(result)
      }
    );
  }

  private calculateEngagement(post: BlueskyPost): EngagementResult {
    const { likeCount, repostCount, replyCount } = post;
    const total = likeCount + repostCount + replyCount;
    
    // Score basé sur les interactions pondérées
    // Reposts valent plus car ils amplifient la portée
    const weightedScore = likeCount * 1 + repostCount * 3 + replyCount * 2;
    
    // Normaliser le score (0-100)
    const engagementScore = Math.min(100, Math.log10(weightedScore + 1) * 25);
    
    // Ratio réponses/likes (indicateur de discussion)
    const replyToLikeRatio = likeCount > 0 ? replyCount / likeCount : 0;
    
    // Potentiel viral (basé sur les reposts)
    const viralPotential = Math.min(1, repostCount / Math.max(likeCount, 1));
    
    // Taux d'engagement (estimation basée sur une portée moyenne)
    const estimatedReach = Math.max(100, likeCount * 10);
    const engagementRate = (total / estimatedReach) * 100;

    const category = this.categorizeEngagement(engagementScore);
    const insights = this.generateInsights(post, replyToLikeRatio, viralPotential);

    return {
      engagementScore,
      engagementRate,
      metrics: {
        likes: likeCount,
        reposts: repostCount,
        replies: replyCount,
        total
      },
      category,
      insights,
      replyToLikeRatio,
      viralPotential
    };
  }

  private categorizeEngagement(score: number): EngagementResult['category'] {
    if (score >= 80) return 'viral';
    if (score >= 60) return 'high';
    if (score >= 40) return 'medium';
    if (score >= 20) return 'low';
    return 'minimal';
  }

  private generateInsights(
    post: BlueskyPost, 
    replyRatio: number, 
    viralPotential: number
  ): string[] {
    const insights: string[] = [];
    
    if (viralPotential > 0.5) {
      insights.push('Fort potentiel viral - taux de partage élevé');
    }
    
    if (replyRatio > 0.3) {
      insights.push('Génère beaucoup de discussions');
    }
    
    if (post.likeCount > 100 && post.replyCount < 5) {
      insights.push('Contenu apprécié mais peu discuté');
    }
    
    if (post.embed) {
      insights.push('Contient du média enrichi');
    }
    
    const textLength = post.record.text.length;
    if (textLength < 50 && post.likeCount > 50) {
      insights.push('Format court performant');
    }
    
    return insights;
  }

  private findTopEngagedPost(posts: BlueskyPost[]): BlueskyPost | null {
    if (posts.length === 0) return null;
    
    return posts.reduce((top, current) => {
      const topTotal = top.likeCount + top.repostCount + top.replyCount;
      const currentTotal = current.likeCount + current.repostCount + current.replyCount;
      return currentTotal > topTotal ? current : top;
    });
  }

  private determineSeverity(result: EngagementResult): AnalysisSeverity {
    if (result.category === 'viral') return 'alert';
    if (result.category === 'high') return 'warning';
    return 'info';
  }

  private generateTags(result: EngagementResult): string[] {
    const tags = [`engagement:${result.category}`];
    
    if (result.viralPotential > 0.5) {
      tags.push('viral-potential');
    }
    
    if (result.replyToLikeRatio > 0.3) {
      tags.push('discussion-driver');
    }
    
    return tags;
  }
}
