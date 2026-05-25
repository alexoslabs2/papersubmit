import { defineStore } from 'pinia';
import { api } from '../api';

export interface ReviewQueueItem {
  id: string;
  speaker_full_name: string;
  speaker_contact_email: string;
  company_organization: string;
  country: string;
  speaker_bio: string;
  online_presence: string;
  title: string;
  presentation_languages: string[];
  technical_level: string;
  abstract: string;
  description: string;
  key_takeaways: string;
  related_tools: string;
  additional_notes: string;
  status: string;
  speaker_name: string;
  review_id: string | null;
  score: number | null;
  comments: string | null;
}

export const useReviewStore = defineStore('reviewStore', {
  state: () => ({
    queue: [] as ReviewQueueItem[],
    loading: false,
    error: ''
  }),
  actions: {
    async loadQueue() {
      this.loading = true;
      this.error = '';
      try {
        const data = await api<{ reviews: ReviewQueueItem[] }>('/reviews');
        this.queue = data.reviews;
      } catch (err) {
        this.queue = [];
        this.error = err instanceof Error ? err.message : 'Review queue could not be loaded';
      } finally {
        this.loading = false;
      }
    },
    async saveReview(proposalId: string, score: number, comments: string) {
      await api('/reviews', {
        method: 'POST',
        body: JSON.stringify({ proposalId, score, comments })
      });
      await this.loadQueue();
    }
  }
});
