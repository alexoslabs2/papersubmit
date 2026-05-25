<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter, RouterLink } from 'vue-router';
import { useAuthStore } from '../stores/authStore';

const email = ref('');
const password = ref('');
const error = ref('');
const auth = useAuthStore();
const route = useRoute();
const router = useRouter();
const forgotPasswordTarget = computed(() => {
  const reset = route.query.reset;
  return typeof reset === 'string' ? { path: '/reset-password', query: { token: reset } } : '/forgot-password';
});

function loginTarget() {
  const redirect = route.query.redirect;
  if (typeof redirect === 'string' && redirect.startsWith('/') && !redirect.startsWith('//')) {
    return redirect;
  }
  return auth.role === 'admin' ? '/app/dashboard' : auth.role === 'reviewer' ? '/app/reviews' : '/app/proposals';
}

async function submit() {
  error.value = '';
  try {
    await auth.login(email.value, password.value);
    await router.push(loginTarget());
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Login failed';
  }
}
</script>

<template>
  <main class="auth-page">
    <form class="panel" @submit.prevent="submit">
      <h1>Login</h1>
      <label>Email <input v-model="email" type="email" required /></label>
      <label>Password <input v-model="password" type="password" required /></label>
      <div class="auth-centered-link">
        <RouterLink :to="forgotPasswordTarget">Forgot Password?</RouterLink>
      </div>
      <p v-if="error" class="error">{{ error }}</p>
      <div class="auth-actions">
        <button class="button primary">Login</button>
        <RouterLink to="/register">Register</RouterLink>
      </div>
    </form>
  </main>
</template>
