import { defineStore } from 'pinia';
import { api } from '../api';

export const useAdminStore = defineStore('adminStore', {
  state: () => ({
    dashboard: null as Record<string, unknown> | null,
    submissions: [] as Array<Record<string, unknown>>,
    reviewers: [] as Array<Record<string, unknown>>,
    templates: [] as Array<Record<string, unknown>>,
    auditLogs: [] as Array<Record<string, unknown>>
  }),
  actions: {
    async loadDashboard() {
      this.dashboard = await api('/admin/dashboard');
    },
    async loadSubmissions() {
      const data = await api<{ submissions: Array<Record<string, unknown>> }>('/admin/submissions');
      this.submissions = data.submissions;
    },
    async decide(id: string, decision: 'accepted' | 'rejected') {
      await api(`/admin/proposals/${id}/decide`, { method: 'POST', body: JSON.stringify({ decision }) });
      await this.loadSubmissions();
    },
    async loadReviewers() {
      const data = await api<{ reviewers: Array<Record<string, unknown>> }>('/admin/reviewers');
      this.reviewers = data.reviewers;
    },
    async inviteReviewer(email: string) {
      await api('/admin/reviewers/invite', { method: 'POST', body: JSON.stringify({ email }) });
      await this.loadReviewers();
    },
    async loadTemplates() {
      const data = await api<{ templates: Array<Record<string, unknown>> }>('/admin/email-templates');
      this.templates = data.templates;
    },
    async loadAuditLogs() {
      const data = await api<{ auditLogs: Array<Record<string, unknown>> }>('/admin/audit-logs');
      this.auditLogs = data.auditLogs;
    }
  }
});
