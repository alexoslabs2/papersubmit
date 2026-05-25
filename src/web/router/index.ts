import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/authStore';
import PublicLanding from '../views/PublicLanding.vue';
import Login from '../views/Login.vue';
import Register from '../views/Register.vue';
import ForgotPassword from '../views/ForgotPassword.vue';
import ResetPassword from '../views/ResetPassword.vue';
import SetupWizard from '../views/SetupWizard.vue';
import AppShell from '../views/AppShell.vue';
import AdminDashboard from '../views/AdminDashboard.vue';
import AdminEventSettings from '../views/AdminEventSettings.vue';
import AdminSubmissions from '../views/AdminSubmissions.vue';
import AdminSubmissionDetail from '../views/AdminSubmissionDetail.vue';
import AdminReviewers from '../views/AdminReviewers.vue';
import AdminEmailTemplates from '../views/AdminEmailTemplates.vue';
import AdminSmtp from '../views/AdminSmtp.vue';
import AdminAuditLogs from '../views/AdminAuditLogs.vue';
import ReviewerQueue from '../views/ReviewerQueue.vue';
import ReviewScreen from '../views/ReviewScreen.vue';
import SpeakerProposals from '../views/SpeakerProposals.vue';
import ProposalForm from '../views/ProposalForm.vue';
import Forbidden from '../views/Forbidden.vue';
import NotFound from '../views/NotFound.vue';

function redirectToLogin(path: string) {
  return { path: '/login', query: { redirect: path } };
}

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: PublicLanding },
    { path: '/login', component: Login },
    { path: '/forgot-password', component: ForgotPassword },
    { path: '/reset-password', component: ResetPassword },
    { path: '/register', component: Register },
    { path: '/setup', component: SetupWizard },
    {
      path: '/app',
      component: AppShell,
      meta: { requiresAuth: true },
      children: [
        { path: '', redirect: '/app/dashboard' },
        { path: 'dashboard', component: AdminDashboard, meta: { roles: ['admin'] } },
        { path: 'event', component: AdminEventSettings, meta: { roles: ['admin'] } },
        { path: 'submissions', component: AdminSubmissions, meta: { roles: ['admin'] } },
        { path: 'submissions/:id', component: AdminSubmissionDetail, meta: { roles: ['admin'] } },
        { path: 'reviewers', component: AdminReviewers, meta: { roles: ['admin'] } },
        { path: 'email-templates', component: AdminEmailTemplates, meta: { roles: ['admin'] } },
        { path: 'smtp', component: AdminSmtp, meta: { roles: ['admin'] } },
        { path: 'audit-logs', component: AdminAuditLogs, meta: { roles: ['admin'] } },
        { path: 'reviews', component: ReviewerQueue, meta: { roles: ['reviewer'] } },
        { path: 'reviews/:id', component: ReviewScreen, meta: { roles: ['reviewer'] } },
        { path: 'proposals', component: SpeakerProposals, meta: { roles: ['speaker'] } },
        { path: 'proposals/new', component: ProposalForm, meta: { roles: ['speaker'] } }
      ]
    },
    { path: '/403', component: Forbidden },
    { path: '/:pathMatch(.*)*', component: NotFound }
  ]
});

router.beforeEach(async (to) => {
  if (to.path === '/login' && typeof to.query.reset === 'string') {
    return { path: '/reset-password', query: { token: to.query.reset } };
  }

  const auth = useAuthStore();
  if (!auth.user && to.meta.requiresAuth) await auth.loadMe();
  if (to.meta.requiresAuth && !auth.user) return redirectToLogin(to.fullPath);
  const roles = to.meta.roles as string[] | undefined;
  if (roles && (!auth.user || !roles.includes(auth.user.role))) return '/403';
  return true;
});
