import { defineStore } from 'pinia';
import { api } from '../api';
import { errorMessage } from '../errors';
import type { ProposalSummary } from '@shared/types';

export interface ProposalFormPayload {
  speakerFullName: string;
  speakerContactEmail: string;
  companyOrganization: string;
  country: string;
  speakerBio: string;
  onlinePresence: string;
  title: string;
  presentationLanguages: string[];
  technicalLevel: string;
  abstract: string;
  description: string;
  keyTakeaways: string;
  relatedTools: string;
  additionalNotes: string;
}

export const useProposalStore = defineStore('proposalStore', {
  state: () => ({
    proposals: [] as ProposalSummary[],
    selected: null as ProposalSummary | null,
    loading: false,
    error: ''
  }),
  actions: {
    async loadProposals() {
      this.loading = true;
      this.error = '';
      try {
        const data = await api<{ proposals: ProposalSummary[] }>('/proposals');
        this.proposals = data.proposals;
      } catch (error) {
        this.proposals = [];
        this.error = errorMessage(error, 'Proposals could not be loaded');
      } finally {
        this.loading = false;
      }
    },
    async loadProposal(id: string) {
      this.loading = true;
      this.error = '';
      try {
        const data = await api<{ proposal: ProposalSummary }>(`/proposals/${id}`);
        this.selected = data.proposal;
      } catch (error) {
        this.selected = null;
        this.error = errorMessage(error, 'Proposal could not be loaded');
      } finally {
        this.loading = false;
      }
    },
    async submit(payload: ProposalFormPayload) {
      this.error = '';
      await api('/proposals', { method: 'POST', body: JSON.stringify(payload) });
      await this.loadProposals();
    },
    async withdraw(id: string) {
      this.error = '';
      try {
        await api(`/proposals/${id}/withdraw`, { method: 'POST' });
        await this.loadProposals();
      } catch (error) {
        this.error = errorMessage(error, 'Proposal could not be withdrawn');
        throw error;
      }
    }
  }
});
