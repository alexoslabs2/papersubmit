<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink, RouterView, useRouter } from 'vue-router';
import { CalendarCog, LayoutDashboard, FileText, Users, Mail, Server, ScrollText, ClipboardList, LogOut, Plus } from 'lucide-vue-next';
import { useAuthStore } from '../stores/authStore';

const auth = useAuthStore();
const router = useRouter();
const nav = computed(() => {
  if (auth.role === 'admin') {
    return [
      ['/app/dashboard', LayoutDashboard, 'Dashboard'],
      ['/app/event', CalendarCog, 'Event'],
      ['/app/submissions', FileText, 'Submissions'],
      ['/app/reviewers', Users, 'Reviewers'],
      ['/app/email-templates', Mail, 'Templates'],
      ['/app/smtp', Server, 'SMTP'],
      ['/app/audit-logs', ScrollText, 'Audit']
    ] as const;
  }
  if (auth.role === 'reviewer') return [['/app/reviews', ClipboardList, 'Queue']] as const;
  return [
    ['/app/proposals', FileText, 'Proposals'],
    ['/app/proposals/new', Plus, 'New']
  ] as const;
});

async function logout() {
  await auth.logout();
  await router.push('/login');
}
</script>

<template>
  <div class="app-layout">
    <aside class="sidebar">
      <RouterLink class="brand" to="/">Paper Submit</RouterLink>
      <nav>
        <RouterLink v-for="[href, icon, label] in nav" :key="href" :to="href">
          <component :is="icon" :size="18" />
          <span>{{ label }}</span>
        </RouterLink>
      </nav>
      <button class="icon-text" @click="logout"><LogOut :size="18" /> Logout</button>
    </aside>
    <main class="content">
      <RouterView />
    </main>
  </div>
</template>
