/**
 * Types partagés pour le frontend
 */

export interface BlueskySession {
  did: string;
  handle: string;
  accessJwt: string;
  refreshJwt: string;
}

export interface BlueskyProfile {
  did: string;
  handle: string;
  displayName?: string;
  description?: string;
  avatar?: string;
  banner?: string;
  followersCount: number;
  followsCount: number;
  postsCount: number;
  viewer?: {
    muted?: boolean;
    blockedBy?: boolean;
    blocking?: string;
    following?: string;
    followedBy?: string;
  };
}

export interface BlueskyPost {
  uri: string;
  cid: string;
  author: BlueskyProfile;
  record: {
    text: string;
    createdAt: string;
    langs?: string[];
    facets?: any[];
    reply?: any;
    embed?: any;
  };
  replyCount: number;
  repostCount: number;
  likeCount: number;
  indexedAt: string;
  embed?: any;
  labels?: any[];
  viewer?: {
    like?: string;
    repost?: string;
    muted?: boolean;
    blockedBy?: boolean;
  };
}

export interface FeedViewPost {
  post: BlueskyPost;
  reply?: {
    root: BlueskyPost;
    parent: BlueskyPost;
  };
  reason?: any;
}

export interface ThreadViewPost {
  post: BlueskyPost;
  parent?: ThreadViewPost;
  replies?: ThreadViewPost[];
}

export interface Notification {
  uri: string;
  cid: string;
  author: BlueskyProfile;
  reason: 'like' | 'repost' | 'follow' | 'mention' | 'reply' | 'quote';
  reasonSubject?: string;
  record: unknown;
  isRead: boolean;
  indexedAt: string;
}

// Types d'analyse

export interface AnalyzerMeta {
  id: string;
  name: string;
  description: string;
  version: string;
  author?: string;
  category: string;
  supportedTypes: string[];
  config?: {
    enabled: boolean;
    priority: number;
  };
}

export interface AnalysisResult {
  analyzerId: string;
  analyzerName: string;
  category: string;
  timestamp: string;
  contentRef: {
    type: string;
    uri?: string;
    did?: string;
  };
  score?: number;
  severity?: 'info' | 'warning' | 'alert' | 'critical';
  tags: string[];
  data: any;
}

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
}

export interface ToxicityResult {
  toxicityScore: number;
  spamScore: number;
  flags: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high';
    description: string;
  }>;
  recommendation: 'safe' | 'review' | 'flag' | 'block';
}

// Types API

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  details?: any;
}

export interface PaginatedData<T> {
  items: T[];
  cursor?: string;
}
