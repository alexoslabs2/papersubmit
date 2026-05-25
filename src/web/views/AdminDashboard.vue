<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useAdminStore } from '../stores/adminStore';
const admin = useAdminStore();
onMounted(() => admin.loadDashboard());
const proposalCounts = computed(() => (admin.dashboard?.proposalCounts ?? []) as Array<{ status: string; count: number }>);
</script>

<template>
  <section>
    <h1>Dashboard</h1>
    <div class="metric-grid">
      <article class="metric" v-for="item in proposalCounts" :key="String(item.status)">
        <span>{{ item.status }}</span>
        <strong>{{ item.count }}</strong>
      </article>
      <article class="metric">
        <span>reviewers</span>
        <strong>{{ admin.dashboard?.reviewerCount ?? 0 }}</strong>
      </article>
    </div>
  </section>
</template>
