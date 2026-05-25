<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, RouterLink } from 'vue-router';
import { useAuthStore } from '../stores/authStore';

const route = useRoute();
const auth = useAuthStore();
const password = ref('');
const confirmPassword = ref('');
const error = ref('');
const complete = ref(false);
const submitting = ref(false);
const token = computed(() => {
  const value = route.query.token ?? route.query.reset;
  return typeof value === 'string' ? value : '';
});

async function submit() {
  error.value = '';
  complete.value = false;
  if (!token.value) {
    error.value = 'Invalid reset token';
    return;
  }
  if (password.value !== confirmPassword.value) {
    error.value = 'Passwords do not match';
    return;
  }

  submitting.value = true;
  try {
    await auth.resetPassword(token.value, password.value);
    complete.value = true;
    password.value = '';
    confirmPassword.value = '';
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unable to reset password';
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <main class="auth-page">
    <form class="panel" @submit.prevent="submit">
      <h1>Reset Password</h1>
      <label>New password <input v-model="password" type="password" required autocomplete="new-password" /></label>
      <label>Confirm password <input v-model="confirmPassword" type="password" required autocomplete="new-password" /></label>
      <p v-if="complete" class="notice">Your password has been reset.</p>
      <p v-if="error" class="error">{{ error }}</p>
      <div class="auth-actions">
        <button class="button primary" :disabled="submitting || complete">{{ submitting ? 'Saving...' : 'Save password' }}</button>
        <RouterLink to="/login">Back to login</RouterLink>
      </div>
    </form>
  </main>
</template>
