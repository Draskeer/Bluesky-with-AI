/**
 * Client API pour communiquer avec le backend
 */

import type { BlueskySession, BlueskyProfile, FeedViewPost } from '../types';

const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001/api';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface PaginatedResponse<T> {
  success: boolean;
  data?: {
    items: T[];
    cursor?: string;
  };
  error?: string;
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    const data = await response.json();
    return data;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Request failed',
    };
  }
}

export const api = {
  auth: {
    login: async (identifier: string, password: string): Promise<ApiResponse<BlueskySession>> => {
      return request<BlueskySession>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier, password }),
      });
    },

    logout: (): void => {
      // Clear local storage or perform any cleanup
      localStorage.removeItem('bluesky-auth');
    },

    resume: async (session: BlueskySession): Promise<ApiResponse<{ message: string }>> => {
      return request<{ message: string }>('/auth/resume', {
        method: 'POST',
        body: JSON.stringify(session),
      });
    },
  },

  profiles: {
    get: async (actor: string): Promise<ApiResponse<BlueskyProfile>> => {
      return request<BlueskyProfile>(`/profiles/${encodeURIComponent(actor)}`);
    },

    getFollowers: async (
      actor: string,
      options?: { limit?: number; cursor?: string }
    ): Promise<PaginatedResponse<BlueskyProfile>> => {
      const params = new URLSearchParams();
      if (options?.limit) params.set('limit', String(options.limit));
      if (options?.cursor) params.set('cursor', options.cursor);
      const query = params.toString() ? `?${params}` : '';
      return request(`/profiles/${encodeURIComponent(actor)}/followers${query}`);
    },

    getFollowing: async (
      actor: string,
      options?: { limit?: number; cursor?: string }
    ): Promise<PaginatedResponse<BlueskyProfile>> => {
      const params = new URLSearchParams();
      if (options?.limit) params.set('limit', String(options.limit));
      if (options?.cursor) params.set('cursor', options.cursor);
      const query = params.toString() ? `?${params}` : '';
      return request(`/profiles/${encodeURIComponent(actor)}/following${query}`);
    },

    follow: async (did: string): Promise<ApiResponse<{ uri: string }>> => {
      return request<{ uri: string }>(`/profiles/${encodeURIComponent(did)}/follow`, {
        method: 'POST',
      });
    },

    unfollow: async (did: string): Promise<ApiResponse<void>> => {
      return request<void>(`/profiles/${encodeURIComponent(did)}/follow`, {
        method: 'DELETE',
      });
    },

    getSuggestions: async (options?: { limit?: number; cursor?: string }): Promise<ApiResponse<{ actors: BlueskyProfile[]; cursor?: string }>> => {
      const params = new URLSearchParams();
      if (options?.limit) params.set('limit', String(options.limit));
      if (options?.cursor) params.set('cursor', options.cursor);
      const query = params.toString() ? `?${params}` : '';
      return request<{ actors: BlueskyProfile[]; cursor?: string }>(`/profiles/suggestions/list${query}`);
    },

    search: async (query: string, options?: { limit?: number; cursor?: string }): Promise<ApiResponse<{ actors: BlueskyProfile[]; cursor?: string }>> => {
      const params = new URLSearchParams();
      params.set('q', query);
      if (options?.limit) params.set('limit', String(options.limit));
      if (options?.cursor) params.set('cursor', options.cursor);
      return request<{ actors: BlueskyProfile[]; cursor?: string }>(`/profiles/search/actors?${params}`);
    },
  },

  feed: {
    getTimeline: async (
      options?: { limit?: number; cursor?: string }
    ): Promise<PaginatedResponse<FeedViewPost>> => {
      const params = new URLSearchParams();
      if (options?.limit) params.set('limit', String(options.limit));
      if (options?.cursor) params.set('cursor', options.cursor);
      const query = params.toString() ? `?${params}` : '';
      const response = await request<{ feed: FeedViewPost[]; cursor?: string }>(`/feed/timeline${query}`);
      
      // Transform backend response to match our interface
      if (response.success && response.data) {
        return {
          success: true,
          data: {
            items: response.data.feed || [],
            cursor: response.data.cursor,
          },
        };
      }
      return { success: false, error: response.error };
    },

    getPopular: async (
      options?: { limit?: number; cursor?: string }
    ): Promise<PaginatedResponse<FeedViewPost>> => {
      const params = new URLSearchParams();
      if (options?.limit) params.set('limit', String(options.limit));
      if (options?.cursor) params.set('cursor', options.cursor);
      const query = params.toString() ? `?${params}` : '';
      const response = await request<{ feed: FeedViewPost[]; cursor?: string }>(`/feed/popular${query}`);
      
      if (response.success && response.data) {
        return {
          success: true,
          data: {
            items: response.data.feed || [],
            cursor: response.data.cursor,
          },
        };
      }
      return { success: false, error: response.error };
    },

    getDiscover: async (
      options?: { limit?: number; cursor?: string }
    ): Promise<PaginatedResponse<FeedViewPost>> => {
      const params = new URLSearchParams();
      if (options?.limit) params.set('limit', String(options.limit));
      if (options?.cursor) params.set('cursor', options.cursor);
      const query = params.toString() ? `?${params}` : '';
      const response = await request<{ feed: FeedViewPost[]; cursor?: string }>(`/feed/discover${query}`);
      
      if (response.success && response.data) {
        return {
          success: true,
          data: {
            items: response.data.feed || [],
            cursor: response.data.cursor,
          },
        };
      }
      return { success: false, error: response.error };
    },

    getAuthorFeed: async (
      actor: string,
      options?: { limit?: number; cursor?: string }
    ): Promise<PaginatedResponse<FeedViewPost>> => {
      const params = new URLSearchParams();
      if (options?.limit) params.set('limit', String(options.limit));
      if (options?.cursor) params.set('cursor', options.cursor);
      const query = params.toString() ? `?${params}` : '';
      const response = await request<{ feed: FeedViewPost[]; cursor?: string }>(`/feed/author/${encodeURIComponent(actor)}${query}`);
      
      // Transform backend response to match our interface
      if (response.success && response.data) {
        return {
          success: true,
          data: {
            items: response.data.feed || [],
            cursor: response.data.cursor,
          },
        };
      }
      return { success: false, error: response.error };
    },

    createPost: async (text: string, replyTo?: { uri: string; cid: string; rootUri?: string; rootCid?: string }): Promise<ApiResponse<{ uri: string; cid: string }>> => {
      return request<{ uri: string; cid: string }>('/feed/posts', {
        method: 'POST',
        body: JSON.stringify({ text, replyTo }),
      });
    },

    deletePost: async (uri: string): Promise<ApiResponse<void>> => {
      return request<void>(`/feed/posts/${encodeURIComponent(uri)}`, {
        method: 'DELETE',
      });
    },

    like: async (uri: string, cid: string): Promise<ApiResponse<{ uri: string }>> => {
      return request<{ uri: string }>(`/feed/posts/${encodeURIComponent(uri)}/like`, {
        method: 'POST',
        body: JSON.stringify({ cid }),
      });
    },

    unlike: async (likeUri: string): Promise<ApiResponse<void>> => {
      return request<void>(`/feed/likes/${encodeURIComponent(likeUri)}`, {
        method: 'DELETE',
      });
    },

    repost: async (uri: string, cid: string): Promise<ApiResponse<{ uri: string }>> => {
      return request<{ uri: string }>(`/feed/posts/${encodeURIComponent(uri)}/repost`, {
        method: 'POST',
        body: JSON.stringify({ cid }),
      });
    },

    unrepost: async (repostUri: string): Promise<ApiResponse<void>> => {
      return request<void>(`/feed/reposts/${encodeURIComponent(repostUri)}`, {
        method: 'DELETE',
      });
    },

    getThread: async (uri: string, depth: number = 6): Promise<ApiResponse<{ thread: any }>> => {
      return request<{ thread: any }>(`/feed/thread/${encodeURIComponent(uri)}?depth=${depth}`);
    },
  },

  notifications: {
    list: async (options?: { limit?: number; cursor?: string }): Promise<ApiResponse<{ notifications: any[]; cursor?: string }>> => {
      const params = new URLSearchParams();
      if (options?.limit) params.set('limit', String(options.limit));
      if (options?.cursor) params.set('cursor', options.cursor);
      const query = params.toString() ? `?${params}` : '';
      return request<{ notifications: any[]; cursor?: string }>(`/notifications${query}`);
    },

    markRead: async (seenAt?: string): Promise<ApiResponse<{ message: string }>> => {
      return request<{ message: string }>('/notifications/read', {
        method: 'POST',
        body: JSON.stringify({ seenAt: seenAt || new Date().toISOString() }),
      });
    },
  },

  chat: {
    listConvos: async (options?: { limit?: number; cursor?: string }): Promise<ApiResponse<{ convos: any[]; cursor?: string }>> => {
      const params = new URLSearchParams();
      if (options?.limit) params.set('limit', String(options.limit));
      if (options?.cursor) params.set('cursor', options.cursor);
      const query = params.toString() ? `?${params}` : '';
      return request<{ convos: any[]; cursor?: string }>(`/chat/convos${query}`);
    },

    getMessages: async (convoId: string, options?: { limit?: number; cursor?: string }): Promise<ApiResponse<{ messages: any[]; cursor?: string }>> => {
      const params = new URLSearchParams();
      if (options?.limit) params.set('limit', String(options.limit));
      if (options?.cursor) params.set('cursor', options.cursor);
      const query = params.toString() ? `?${params}` : '';
      return request<{ messages: any[]; cursor?: string }>(`/chat/convos/${encodeURIComponent(convoId)}${query}`);
    },

    sendMessage: async (convoId: string, text: string): Promise<ApiResponse<any>> => {
      return request<any>(`/chat/convos/${encodeURIComponent(convoId)}/messages`, {
        method: 'POST',
        body: JSON.stringify({ text }),
      });
    },

    createConvo: async (members: string[]): Promise<ApiResponse<any>> => {
      return request<any>('/chat/convos', {
        method: 'POST',
        body: JSON.stringify({ members }),
      });
    },

    markRead: async (convoId: string): Promise<ApiResponse<{ message: string }>> => {
      return request<{ message: string }>(`/chat/convos/${encodeURIComponent(convoId)}/read`, {
        method: 'POST',
      });
    },
  },
};
