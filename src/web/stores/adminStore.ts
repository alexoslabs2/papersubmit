import { defineStore } from 'pinia';
import { api } from '../api';
import { errorMessage } from '../errors';

export const useAdminStore = defineStore('adminStore', {
  state: () => ({
    dashboard: null as Record<string, unknown> | null,
    submissions: [] as Array<Record<string, unknown>>,
    reviewers: [] as Array<Record<string, unknown>>,
    templates: [] as Array<Record<string, unknown>>,
    auditLogs: [] as Array<Record<string, unknown>>,
    loading: false,
    error: ''
  }),
  actions: {
    startRequest() {
      this.loading = true;
      this.error = '';
    },
    failRequest(error: unknown, fallback: string) {
      this.error = errorMessage(error, fallback);
    },
    finishRequest() {
      this.loading = false;
    },
    async loadDashboard() {
      this.startRequest();
      try {
        this.dashboard = await api('/admin/dashboard');
      } catch (error) {
        this.dashboard = null;
        this.failRequest(error, 'Dashboard could not be loaded');
      } finally {
        this.finishRequest();
      }
    },
    async loadSubmissions() {
      this.startRequest();
      try {
        const data = await api<{ submissions: Array<Record<string, unknown>> }>('/admin/submissions');
        this.submissions = data.submissions;
      } catch (error) {
        this.submissions = [];
        this.failRequest(error, 'Submissions could not be loaded');
      } finally {
        this.finishRequest();
      }
    },
    async decide(id: string, decision: 'accepted' | 'rejected') {
      this.error = '';
      try {
        await api(`/admin/proposals/${id}/decide`, { method: 'POST', body: JSON.stringify({ decision }) });
        await this.loadSubmissions();
      } catch (error) {
        this.failRequest(error, 'Decision could not be saved');
        throw error;
      }
    },
    async loadReviewers() {
      this.startRequest();
      try {
        const data = await api<{ reviewers: Array<Record<string, unknown>> }>('/admin/reviewers');
        this.reviewers = data.reviewers;
      } catch (error) {
        this.reviewers = [];
        this.failRequest(error, 'Reviewers could not be loaded');
      } finally {
        this.finishRequest();
      }
    },
    async inviteReviewer(email: string) {
      this.error = '';
      try {
        await api('/admin/reviewers/invite', { method: 'POST', body: JSON.stringify({ email }) });
        await this.loadReviewers();
      } catch (error) {
        this.failRequest(error, 'Reviewer invitation could not be sent');
        throw error;
      }
    },
    async loadTemplates() {
      this.startRequest();
      try {
        const data = await api<{ templates: Array<Record<string, unknown>> }>('/admin/email-templates');
        this.templates = data.templates;
      } catch (error) {
        this.templates = [];
        this.failRequest(error, 'Email templates could not be loaded');
      } finally {
        this.finishRequest();
      }
    },
    async loadAuditLogs() {
      this.startRequest();
      try {
        const data = await api<{ auditLogs: Array<Record<string, unknown>> }>('/admin/audit-logs');
        this.auditLogs = data.auditLogs;
      } catch (error) {
        this.auditLogs = [];
        this.failRequest(error, 'Audit logs could not be loaded');
      } finally {
        this.finishRequest();
      }
    }
  }
});
