import { defineStore } from 'pinia';
import { api } from '../api';
import type { AuthUser } from '@shared/types';

export const useAuthStore = defineStore('authStore', {
  state: () => ({
    user: null as AuthUser | null,
    loading: false
  }),
  getters: {
    isAuthenticated: (state) => Boolean(state.user),
    role: (state) => state.user?.role
  },
  actions: {
    async loadMe() {
      this.loading = true;
      try {
        const data = await api<{ user: AuthUser }>('/me');
        this.user = data.user;
      } catch {
        this.user = null;
      } finally {
        this.loading = false;
      }
    },
    async login(email: string, password: string) {
      const data = await api<{ user: AuthUser }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      this.user = data.user;
    },
    async register(name: string, email: string, password: string) {
      const data = await api<{ user: AuthUser }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password })
      });
      this.user = data.user;
    },
    async logout() {
      await api('/auth/logout', { method: 'POST' });
      this.user = null;
    },
    async requestPasswordReset(email: string) {
      await api('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email })
      });
    },
    async resetPassword(token: string, password: string) {
      await api('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, password })
      });
    }
  }
});
