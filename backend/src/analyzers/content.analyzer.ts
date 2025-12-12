/**
 * Analyseur de Contenu
 * 
 * Extrait et analyse les métadonnées du contenu:
 * - Longueur et lisibilité
 * - Langues détectées
 * - Hashtags et mentions
 * - Médias et liens
 * - Patterns de publication
 */

import { 
  BaseAnalyzer, 
  type AnalyzableContent, 
  type AnalysisResult,
  type AnalyzerMetadata
} from '../types/analyzer.js';

export interface ContentAnalysisResult {
  textMetrics: {
    charCount: number;
    wordCount: number;
    sentenceCount: number;
    avgWordLength: number;
    readabilityScore: number;
  };
  entities: {
    hashtags: string[];
    mentions: string[];
    links: string[];
    emojis: string[];
  };
  mediaInfo: {
    hasImages: boolean;
    hasVideo: boolean;
    hasExternalLink: boolean;
    hasQuote: boolean;
    imageCount: number;
  };
  language: {
    detected: string[];
    primary: string;
    confidence: number;
  };
  contentType: ContentType;
  topics: string[];
}

export type ContentType = 
  | 'text-only'
  | 'media-post'
  | 'link-share'
  | 'quote-post'
  | 'thread-reply'
  | 'question'
  | 'announcement';

// Patterns pour la détection de langue (simplifié)
const LANGUAGE_PATTERNS: Record<string, RegExp[]> = {
  fr: [/\b(le|la|les|un|une|des|et|ou|mais|donc|car|je|tu|il|elle|nous|vous|ils|elles|de|du|à|au|avec|pour|dans|sur|est|sont|être|avoir)\b/gi],
  en: [/\b(the|a|an|and|or|but|so|because|i|you|he|she|we|they|is|are|was|were|be|have|has|had|do|does|did|will|would|could|should)\b/gi],
  es: [/\b(el|la|los|las|un|una|y|o|pero|porque|yo|tú|él|ella|nosotros|ellos|es|son|ser|estar|tener|hacer)\b/gi],
  de: [/\b(der|die|das|ein|eine|und|oder|aber|weil|ich|du|er|sie|wir|ihr|sie|ist|sind|sein|haben|werden)\b/gi]
};

// Patterns pour la détection de type de contenu
const QUESTION_PATTERNS = [/\?$/, /^(who|what|when|where|why|how|is|are|do|does|can|could|would|should)/i, /^(qui|que|quoi|quand|où|pourquoi|comment|est-ce)/i];
const ANNOUNCEMENT_PATTERNS = [/🎉|📢|🚀|announcing|excited to|thrilled to|nouveau|nouvelle|annonce/i];

export class ContentAnalyzer extends BaseAnalyzer<ContentAnalysisResult> {
  metadata: AnalyzerMetadata = {
    id: 'content',
    name: 'Content Analyzer',
    description: 'Analyse les métadonnées et caractéristiques du contenu',
    version: '1.0.0',
    author: 'Bluesky Client',
    category: 'content',
    supportedTypes: ['post', 'thread']
  };

  async analyze(content: AnalyzableContent): Promise<AnalysisResult<ContentAnalysisResult> | null> {
    if (content.type !== 'post' && content.type !== 'thread') {
      return null;
    }

    const post = content.type === 'post' ? content.data : content.data.post;
    const result = this.analyzeContent(post);
    
    return this.createResult(content, result, {
      tags: this.generateTags(result)
    });
  }

  private analyzeContent(post: any): ContentAnalysisResult {
    const text = post.record.text;
    const facets = post.record.facets || [];
    const embed = post.embed;

    const textMetrics = this.calculateTextMetrics(text);
    const entities = this.extractEntities(text, facets);
    const mediaInfo = this.analyzeMedia(embed);
    const language = this.detectLanguage(text);
    const contentType = this.determineContentType(text, mediaInfo, post.record.reply);
    const topics = this.extractTopics(text, entities.hashtags);

    return {
      textMetrics,
      entities,
      mediaInfo,
      language,
      contentType,
      topics
    };
  }

  private calculateTextMetrics(text: string): ContentAnalysisResult['textMetrics'] {
    const charCount = text.length;
    const words = text.split(/\s+/).filter(w => w.length > 0);
    const wordCount = words.length;
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const sentenceCount = Math.max(sentences.length, 1);
    
    const avgWordLength = wordCount > 0 
      ? words.reduce((sum, w) => sum + w.length, 0) / wordCount 
      : 0;
    
    // Score de lisibilité simplifié (basé sur Flesch-Kincaid adapté)
    const avgSentenceLength = wordCount / sentenceCount;
    const readabilityScore = Math.max(0, Math.min(100, 
      206.835 - (1.015 * avgSentenceLength) - (84.6 * (avgWordLength / 5))
    ));

    return {
      charCount,
      wordCount,
      sentenceCount,
      avgWordLength: Math.round(avgWordLength * 10) / 10,
      readabilityScore: Math.round(readabilityScore)
    };
  }

  private extractEntities(text: string, facets: any[]): ContentAnalysisResult['entities'] {
    // Extraire les hashtags du texte
    const hashtags = (text.match(/#[\w\u00C0-\u024F]+/g) || [])
      .map(h => h.toLowerCase());
    
    // Extraire les mentions des facets
    const mentions: string[] = [];
    const links: string[] = [];
    
    for (const facet of facets) {
      for (const feature of (facet.features || [])) {
        if (feature.$type?.includes('mention')) {
          mentions.push(feature.did);
        } else if (feature.$type?.includes('link')) {
          links.push(feature.uri);
        }
      }
    }

    // Extraire les emojis
    const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]/gu;
    const emojis = text.match(emojiRegex) || [];

    return {
      hashtags: [...new Set(hashtags)],
      mentions: [...new Set(mentions)],
      links: [...new Set(links)],
      emojis: [...new Set(emojis)]
    };
  }

  private analyzeMedia(embed: any): ContentAnalysisResult['mediaInfo'] {
    const info = {
      hasImages: false,
      hasVideo: false,
      hasExternalLink: false,
      hasQuote: false,
      imageCount: 0
    };

    if (!embed) return info;

    const embedType = embed.$type || '';
    
    if (embedType.includes('images') || embed.images) {
      info.hasImages = true;
      info.imageCount = embed.images?.length || 0;
    }
    
    if (embedType.includes('video') || embed.video) {
      info.hasVideo = true;
    }
    
    if (embedType.includes('external') || embed.external) {
      info.hasExternalLink = true;
    }
    
    if (embedType.includes('record') || embed.record) {
      info.hasQuote = true;
    }

    return info;
  }

  private detectLanguage(text: string): ContentAnalysisResult['language'] {
    const scores: Record<string, number> = {};
    
    for (const [lang, patterns] of Object.entries(LANGUAGE_PATTERNS)) {
      let matches = 0;
      for (const pattern of patterns) {
        const found = text.match(pattern);
        matches += found?.length || 0;
      }
      scores[lang] = matches;
    }

    const detected = Object.entries(scores)
      .filter(([_, score]) => score > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([lang]) => lang);

    const total = Object.values(scores).reduce((a, b) => a + b, 0);
    const primary = detected[0] || 'unknown';
    const confidence = total > 0 && detected.length > 0
      ? scores[primary] / total
      : 0;

    return {
      detected,
      primary,
      confidence: Math.round(confidence * 100) / 100
    };
  }

  private determineContentType(
    text: string, 
    mediaInfo: ContentAnalysisResult['mediaInfo'],
    reply?: any
  ): ContentType {
    if (reply) return 'thread-reply';
    if (mediaInfo.hasQuote) return 'quote-post';
    if (mediaInfo.hasImages || mediaInfo.hasVideo) return 'media-post';
    if (mediaInfo.hasExternalLink) return 'link-share';
    if (QUESTION_PATTERNS.some(p => p.test(text))) return 'question';
    if (ANNOUNCEMENT_PATTERNS.test(text)) return 'announcement';
    return 'text-only';
  }

  private extractTopics(text: string, hashtags: string[]): string[] {
    const topics = new Set<string>();
    
    // Ajouter les hashtags comme topics
    hashtags.forEach(h => topics.add(h.replace('#', '')));
    
    // Détection basique de sujets (à enrichir avec NLP)
    const topicPatterns: Record<string, RegExp> = {
      tech: /\b(ai|ml|coding|programming|developer|software|tech|startup|crypto|blockchain|web3)\b/i,
      politics: /\b(politics|election|government|vote|democracy|president|congress|parliament)\b/i,
      sports: /\b(football|soccer|basketball|tennis|game|match|team|player|score)\b/i,
      entertainment: /\b(movie|film|music|song|artist|concert|show|series|netflix)\b/i,
      science: /\b(research|study|science|experiment|discovery|data|analysis)\b/i
    };

    for (const [topic, pattern] of Object.entries(topicPatterns)) {
      if (pattern.test(text)) {
        topics.add(topic);
      }
    }

    return Array.from(topics).slice(0, 10);
  }

  private generateTags(result: ContentAnalysisResult): string[] {
    const tags = [
      `type:${result.contentType}`,
      `lang:${result.language.primary}`
    ];

    if (result.mediaInfo.hasImages) tags.push('has-images');
    if (result.mediaInfo.hasVideo) tags.push('has-video');
    if (result.textMetrics.wordCount < 20) tags.push('short-form');
    if (result.textMetrics.wordCount > 100) tags.push('long-form');
    if (result.entities.emojis.length > 3) tags.push('emoji-heavy');
    
    return tags;
  }
}
