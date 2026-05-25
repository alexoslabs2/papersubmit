import { defineStore } from 'pinia';
import { api } from '../api';
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
    selected: null as ProposalSummary | null
  }),
  actions: {
    async loadProposals() {
      const data = await api<{ proposals: ProposalSummary[] }>('/proposals');
      this.proposals = data.proposals;
    },
    async loadProposal(id: string) {
      const data = await api<{ proposal: ProposalSummary }>(`/proposals/${id}`);
      this.selected = data.proposal;
    },
    async submit(payload: ProposalFormPayload) {
      await api('/proposals', { method: 'POST', body: JSON.stringify(payload) });
      await this.loadProposals();
    },
    async withdraw(id: string) {
      await api(`/proposals/${id}/withdraw`, { method: 'POST' });
      await this.loadProposals();
    }
  }
});
