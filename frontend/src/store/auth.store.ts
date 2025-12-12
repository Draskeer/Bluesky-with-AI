/**
 * Store d'authentification
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { BlueskySession, BlueskyProfile } from '../types';
import { api } from '../services/api';

interface AuthState {
  session: BlueskySession | null;
  profile: BlueskyProfile | null;
  isLoading: boolean;
  error: string | null;
  
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => void;
  resumeSession: () => Promise<void>;
  fetchProfile: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      session: null,
      profile: null,
      isLoading: false,
      error: null,

      login: async (identifier: string, password: string) => {
        set({ isLoading: true, error: null });
        
        try {
          const response = await api.auth.login(identifier, password);
          
          if (response.success && response.data) {
            set({ session: response.data, isLoading: false });
            await get().fetchProfile();
          } else {
            set({ error: response.error || 'Login failed', isLoading: false });
          }
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Login failed', 
            isLoading: false 
          });
        }
      },

      logout: () => {
        api.auth.logout();
        set({ session: null, profile: null, error: null });
      },

      resumeSession: async () => {
        const { session } = get();
        if (!session) return;

        set({ isLoading: true });
        
        try {
          const response = await api.auth.resume(session);
          
          if (response.success) {
            await get().fetchProfile();
          } else {
            // Session invalide, déconnecter
            set({ session: null, profile: null });
          }
        } catch {
          set({ session: null, profile: null });
        } finally {
          set({ isLoading: false });
        }
      },

      fetchProfile: async () => {
        const { session } = get();
        if (!session) return;

        try {
          const response = await api.profiles.get(session.handle);
          
          if (response.success && response.data) {
            set({ profile: response.data });
          }
        } catch (error) {
          console.error('Failed to fetch profile:', error);
        }
      },

      clearError: () => set({ error: null })
    }),
    {
      name: 'bluesky-auth',
      partialize: (state) => ({ session: state.session })
    }
  )
);
