<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useAdminStore } from '../stores/adminStore';
import { errorMessage } from '../errors';

const email = ref('');
const actionError = ref('');
const inviting = ref(false);
const admin = useAdminStore();
onMounted(() => admin.loadReviewers());
async function invite() {
  actionError.value = '';
  inviting.value = true;
  try {
    await admin.inviteReviewer(email.value);
    email.value = '';
  } catch (error) {
    actionError.value = errorMessage(error, 'Reviewer invitation could not be sent');
  } finally {
    inviting.value = false;
  }
}
</script>

<template>
  <section>
    <h1>Reviewers</h1>
    <form class="inline-form" @submit.prevent="invite">
      <input v-model="email" type="email" required placeholder="reviewer@example.com" />
      <button class="button primary" :disabled="inviting">{{ inviting ? 'Inviting...' : 'Invite' }}</button>
    </form>
    <p v-if="actionError" class="error">{{ actionError }}</p>
    <div v-if="admin.loading" class="empty">Loading reviewers...</div>
    <div v-else-if="admin.error" class="empty error">{{ admin.error }}</div>
    <div v-else-if="admin.reviewers.length === 0" class="empty">No reviewers yet.</div>
    <ul class="list">
      <li v-for="reviewer in admin.reviewers" :key="String(reviewer.id)">{{ reviewer.name }} · {{ reviewer.email }}</li>
    </ul>
  </section>
</template>
