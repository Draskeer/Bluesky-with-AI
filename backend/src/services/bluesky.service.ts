/**
 * Service Bluesky
 * 
 * Gère toutes les interactions avec l'API AT Protocol de Bluesky.
 */

import { BskyAgent, type AtpSessionData, type AtpSessionEvent } from '@atproto/api';
import { logger } from '../utils/logger.js';
import type { 
  BlueskyCredentials, 
  BlueskySession,
  BlueskyProfile,
  BlueskyPost,
  Feed,
  Notification,
  Thread
} from '../types/bluesky.js';

export class BlueskyService {
  private agent: BskyAgent;
  private session: BlueskySession | null = null;

  constructor(serviceUrl: string = 'https://bsky.social') {
    this.agent = new BskyAgent({
      service: serviceUrl,
      persistSession: (evt: AtpSessionEvent, sess?: AtpSessionData) => {
        if (sess) {
          this.session = {
            did: sess.did,
            handle: sess.handle,
            accessJwt: sess.accessJwt,
            refreshJwt: sess.refreshJwt
          };
          logger.info(`Session persisted for ${sess.handle}`);
        }
      }
    });
  }

  /**
   * Retourne l'agent Bluesky pour les appels API directs
   */
  getAgent(): BskyAgent {
    return this.agent;
  }

  /**
   * Connexion avec identifiants
   */
  async login(credentials: BlueskyCredentials): Promise<BlueskySession> {
    try {
      const response = await this.agent.login(credentials);
      
      this.session = {
        did: response.data.did,
        handle: response.data.handle,
        accessJwt: response.data.accessJwt,
        refreshJwt: response.data.refreshJwt
      };

      logger.info(`Logged in as ${response.data.handle}`);
      return this.session;
    } catch (error) {
      logger.error('Login failed:', error);
      throw error;
    }
  }

  /**
   * Restauration de session
   */
  async resumeSession(session: BlueskySession): Promise<void> {
    try {
      await this.agent.resumeSession({
        did: session.did,
        handle: session.handle,
        accessJwt: session.accessJwt,
        refreshJwt: session.refreshJwt,
        active: true
      });
      this.session = session;
      logger.info(`Session resumed for ${session.handle}`);
    } catch (error) {
      logger.error('Failed to resume session:', error);
      throw error;
    }
  }

  /**
   * Déconnexion
   */
  logout(): void {
    this.session = null;
    logger.info('Logged out');
  }

  /**
   * Vérifie si connecté
   */
  isLoggedIn(): boolean {
    return this.session !== null && this.agent.hasSession;
  }

  /**
   * Obtient la session courante
   */
  getSession(): BlueskySession | null {
    return this.session;
  }

  // ========== Profile ==========

  /**
   * Obtient un profil
   */
  async getProfile(actor?: string): Promise<BlueskyProfile> {
    const handle = actor || this.session?.handle;
    if (!handle) throw new Error('No actor specified and not logged in');

    const response = await this.agent.getProfile({ actor: handle });
    return this.mapProfile(response.data);
  }

  /**
   * Met à jour le profil
   */
  async updateProfile(profile: Partial<{
    displayName: string;
    description: string;
    avatar: Blob;
    banner: Blob;
  }>): Promise<void> {
    await this.agent.upsertProfile(async (existing) => {
      const updated = { ...existing };
      
      if (profile.displayName !== undefined) {
        updated.displayName = profile.displayName;
      }
      if (profile.description !== undefined) {
        updated.description = profile.description;
      }
      
      // Note: Pour avatar/banner, il faut d'abord upload le blob
      // puis mettre à jour avec la référence
      
      return updated;
    });
  }

  // ========== Feed ==========

  /**
   * Obtient le timeline
   */
  async getTimeline(options: { limit?: number; cursor?: string } = {}): Promise<Feed> {
    const response = await this.agent.getTimeline({
      limit: options.limit || 50,
      cursor: options.cursor
    });

    return {
      feed: response.data.feed.map(item => ({
        post: this.mapPost(item.post),
        reply: item.reply ? {
          root: this.mapPost(item.reply.root as any),
          parent: this.mapPost(item.reply.parent as any)
        } : undefined,
        reason: item.reason as any
      })),
      cursor: response.data.cursor
    };
  }

  /**
   * Obtient le feed "What's Hot" (populaire)
   */
  async getPopularFeed(options: { limit?: number; cursor?: string } = {}): Promise<Feed> {
    // Using the official Bluesky "What's Hot" feed
    const response = await this.agent.app.bsky.feed.getFeed({
      feed: 'at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/whats-hot',
      limit: options.limit || 50,
      cursor: options.cursor
    });

    return {
      feed: response.data.feed.map(item => ({
        post: this.mapPost(item.post),
        reply: item.reply ? {
          root: this.mapPost(item.reply.root as any),
          parent: this.mapPost(item.reply.parent as any)
        } : undefined,
        reason: item.reason as any
      })),
      cursor: response.data.cursor
    };
  }

  /**
   * Obtient le feed "Discover" (suggestions)
   */
  async getDiscoverFeed(options: { limit?: number; cursor?: string } = {}): Promise<Feed> {
    // Using Bluesky's discover/suggestions feed
    const response = await this.agent.app.bsky.feed.getFeed({
      feed: 'at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/with-friends',
      limit: options.limit || 50,
      cursor: options.cursor
    });

    return {
      feed: response.data.feed.map(item => ({
        post: this.mapPost(item.post),
        reply: item.reply ? {
          root: this.mapPost(item.reply.root as any),
          parent: this.mapPost(item.reply.parent as any)
        } : undefined,
        reason: item.reason as any
      })),
      cursor: response.data.cursor
    };
  }

  /**
   * Liste les feeds disponibles
   */
  async getSuggestedFeeds(options: { limit?: number; cursor?: string } = {}): Promise<{ feeds: any[]; cursor?: string }> {
    const response = await this.agent.app.bsky.feed.getSuggestedFeeds({
      limit: options.limit || 25,
      cursor: options.cursor
    });

    return {
      feeds: response.data.feeds,
      cursor: response.data.cursor
    };
  }

  /**
   * Obtient le feed d'un auteur
   */
  async getAuthorFeed(
    actor: string, 
    options: { limit?: number; cursor?: string; filter?: string } = {}
  ): Promise<Feed> {
    const response = await this.agent.getAuthorFeed({
      actor,
      limit: options.limit || 50,
      cursor: options.cursor,
      filter: options.filter as any
    });

    return {
      feed: response.data.feed.map(item => ({
        post: this.mapPost(item.post),
        reply: item.reply ? {
          root: this.mapPost(item.reply.root as any),
          parent: this.mapPost(item.reply.parent as any)
        } : undefined
      })),
      cursor: response.data.cursor
    };
  }

  /**
   * Recherche de posts
   */
  async searchPosts(
    query: string, 
    options: { limit?: number; cursor?: string } = {}
  ): Promise<{ posts: BlueskyPost[]; cursor?: string }> {
    const response = await this.agent.app.bsky.feed.searchPosts({
      q: query,
      limit: options.limit || 25,
      cursor: options.cursor
    });

    return {
      posts: response.data.posts.map(p => this.mapPost(p)),
      cursor: response.data.cursor
    };
  }

  // ========== Posts ==========

  /**
   * Crée un post
   */
  async createPost(text: string, options: {
    reply?: { root: { uri: string; cid: string }; parent: { uri: string; cid: string } };
    embed?: any;
    langs?: string[];
  } = {}): Promise<{ uri: string; cid: string }> {
    const response = await this.agent.post({
      text,
      reply: options.reply,
      embed: options.embed,
      langs: options.langs,
      createdAt: new Date().toISOString()
    });

    logger.info(`Created post: ${response.uri}`);
    return response;
  }

  /**
   * Supprime un post
   */
  async deletePost(uri: string): Promise<void> {
    await this.agent.deletePost(uri);
    logger.info(`Deleted post: ${uri}`);
  }

  /**
   * Obtient un thread
   */
  async getThread(uri: string, depth: number = 6): Promise<Thread> {
    const response = await this.agent.getPostThread({
      uri,
      depth
    });

    return this.mapThread(response.data.thread);
  }

  // ========== Interactions ==========

  /**
   * Like un post
   */
  async like(uri: string, cid: string): Promise<{ uri: string }> {
    const response = await this.agent.like(uri, cid);
    return response;
  }

  /**
   * Unlike un post
   */
  async unlike(likeUri: string): Promise<void> {
    await this.agent.deleteLike(likeUri);
  }

  /**
   * Repost un post
   */
  async repost(uri: string, cid: string): Promise<{ uri: string }> {
    const response = await this.agent.repost(uri, cid);
    return response;
  }

  /**
   * Annule un repost
   */
  async unrepost(repostUri: string): Promise<void> {
    await this.agent.deleteRepost(repostUri);
  }

  // ========== Social ==========

  /**
   * Suivre un utilisateur
   */
  async follow(did: string): Promise<{ uri: string }> {
    const response = await this.agent.follow(did);
    logger.info(`Followed: ${did}`);
    return response;
  }

  /**
   * Ne plus suivre
   */
  async unfollow(followUri: string): Promise<void> {
    await this.agent.deleteFollow(followUri);
  }

  /**
   * Obtient les followers
   */
  async getFollowers(
    actor: string, 
    options: { limit?: number; cursor?: string } = {}
  ): Promise<{ followers: BlueskyProfile[]; cursor?: string }> {
    const response = await this.agent.getFollowers({
      actor,
      limit: options.limit || 50,
      cursor: options.cursor
    });

    return {
      followers: response.data.followers.map(f => this.mapProfile(f)),
      cursor: response.data.cursor
    };
  }

  /**
   * Obtient les following
   */
  async getFollows(
    actor: string, 
    options: { limit?: number; cursor?: string } = {}
  ): Promise<{ follows: BlueskyProfile[]; cursor?: string }> {
    const response = await this.agent.getFollows({
      actor,
      limit: options.limit || 50,
      cursor: options.cursor
    });

    return {
      follows: response.data.follows.map(f => this.mapProfile(f)),
      cursor: response.data.cursor
    };
  }

  // ========== Notifications ==========

  /**
   * Obtient les notifications
   */
  async getNotifications(
    options: { limit?: number; cursor?: string } = {}
  ): Promise<{ notifications: Notification[]; cursor?: string }> {
    const response = await this.agent.listNotifications({
      limit: options.limit || 50,
      cursor: options.cursor
    });

    return {
      notifications: response.data.notifications.map(n => ({
        uri: n.uri,
        cid: n.cid,
        author: this.mapProfile(n.author),
        reason: n.reason as any,
        reasonSubject: n.reasonSubject,
        record: n.record,
        isRead: n.isRead,
        indexedAt: n.indexedAt
      })),
      cursor: response.data.cursor
    };
  }

  /**
   * Marque les notifications comme lues
   */
  async markNotificationsRead(seenAt?: string): Promise<void> {
    await this.agent.updateSeenNotifications(seenAt || new Date().toISOString());
  }

  // ========== Search ==========

  /**
   * Recherche d'utilisateurs
   */
  async searchActors(
    query: string, 
    options: { limit?: number; cursor?: string } = {}
  ): Promise<{ actors: BlueskyProfile[]; cursor?: string }> {
    const response = await this.agent.searchActors({
      q: query,
      limit: options.limit || 25,
      cursor: options.cursor
    });

    return {
      actors: response.data.actors.map(a => this.mapProfile(a)),
      cursor: response.data.cursor
    };
  }

  // ========== Mappers ==========

  private mapProfile(data: any): BlueskyProfile {
    return {
      did: data.did,
      handle: data.handle,
      displayName: data.displayName,
      description: data.description,
      avatar: data.avatar,
      banner: data.banner,
      followersCount: data.followersCount || 0,
      followsCount: data.followsCount || 0,
      postsCount: data.postsCount || 0,
      indexedAt: data.indexedAt
    };
  }

  private mapPost(data: any): BlueskyPost {
    return {
      uri: data.uri,
      cid: data.cid,
      author: this.mapProfile(data.author),
      record: data.record,
      replyCount: data.replyCount || 0,
      repostCount: data.repostCount || 0,
      likeCount: data.likeCount || 0,
      indexedAt: data.indexedAt,
      embed: data.embed,
      labels: data.labels
    };
  }

  private mapThread(data: any): Thread {
    if (data.$type === 'app.bsky.feed.defs#notFoundPost') {
      return { post: null as any }; // Géré côté client
    }
    
    if (data.$type === 'app.bsky.feed.defs#blockedPost') {
      return { post: null as any }; // Géré côté client
    }

    return {
      post: this.mapPost(data.post),
      parent: data.parent ? this.mapThread(data.parent) : undefined,
      replies: data.replies?.map((r: any) => this.mapThread(r))
    };
  }
}

// Instance singleton
let instance: BlueskyService | null = null;

export function getBlueskyService(serviceUrl?: string): BlueskyService {
  if (!instance) {
    instance = new BlueskyService(serviceUrl);
  }
  return instance;
}
