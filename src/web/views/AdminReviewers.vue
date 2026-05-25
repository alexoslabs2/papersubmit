<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useAdminStore } from '../stores/adminStore';
const email = ref('');
const admin = useAdminStore();
onMounted(() => admin.loadReviewers());
async function invite() {
  await admin.inviteReviewer(email.value);
  email.value = '';
}
</script>

<template>
  <section>
    <h1>Reviewers</h1>
    <form class="inline-form" @submit.prevent="invite">
      <input v-model="email" type="email" required placeholder="reviewer@example.com" />
      <button class="button primary">Invite</button>
    </form>
    <div v-if="admin.reviewers.length === 0" class="empty">No reviewers yet.</div>
    <ul class="list">
      <li v-for="reviewer in admin.reviewers" :key="String(reviewer.id)">{{ reviewer.name }} · {{ reviewer.email }}</li>
    </ul>
  </section>
</template>
