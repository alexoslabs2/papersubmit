<script setup lang="ts">
import { ref } from 'vue';
import { RouterLink } from 'vue-router';
import { useAuthStore } from '../stores/authStore';

const email = ref('');
const error = ref('');
const sent = ref(false);
const submitting = ref(false);
const auth = useAuthStore();

async function submit() {
  error.value = '';
  sent.value = false;
  submitting.value = true;
  try {
    await auth.requestPasswordReset(email.value);
    sent.value = true;
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unable to send password reset email';
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <main class="auth-page">
    <form class="panel" @submit.prevent="submit">
      <h1>Forgot Password?</h1>
      <p class="auth-helper">
        Please enter your email address. An email will be sent to you, and you will be able to choose a new password.
      </p>
      <label>Email <input v-model="email" type="email" required autocomplete="email" /></label>
      <p v-if="sent" class="notice">
        If that email is registered, a password reset email will be sent shortly.
      </p>
      <p v-if="error" class="error">{{ error }}</p>
      <div class="auth-actions">
        <button class="button primary" :disabled="submitting">{{ submitting ? 'Sending...' : 'Send' }}</button>
        <RouterLink to="/login">Back to login</RouterLink>
      </div>
    </form>
  </main>
</template>
