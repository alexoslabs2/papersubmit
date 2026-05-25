import { defineStore } from 'pinia';
import { api } from '../api';
import type { PublicEvent } from '@shared/types';

export const useEventStore = defineStore('eventStore', {
  state: () => ({
    event: null as PublicEvent | null,
    loading: false
  }),
  actions: {
    async loadEvent() {
      this.loading = true;
      try {
        const data = await api<{ event: PublicEvent }>('/event');
        this.event = data.event;
      } finally {
        this.loading = false;
      }
    },
    async updateEvent(payload: Partial<PublicEvent>) {
      const data = await api<{ event: PublicEvent }>('/event', {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });
      this.event = data.event;
    },
    async uploadLogo(file: File) {
      const body = new FormData();
      body.append('file', file);
      const data = await api<{ logoUrl: string }>('/event/logo', {
        method: 'POST',
        body
      });
      if (this.event) this.event = { ...this.event, logoUrl: data.logoUrl };
      return data.logoUrl;
    }
  }
});
