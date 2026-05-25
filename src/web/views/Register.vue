<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../api';
import { useAuthStore } from '../stores/authStore';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const name = ref('');
const email = ref('');
const password = ref('');
const error = ref('');

async function submit() {
  error.value = '';
  try {
    if (route.query.invite) {
      await api('/auth/reviewer-invitations/accept', {
        method: 'POST',
        body: JSON.stringify({ token: route.query.invite, name: name.value, password: password.value })
      });
      await router.push('/login');
    } else {
      await auth.register(name.value, email.value, password.value);
      await router.push('/app/proposals');
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Registration failed';
  }
}
</script>

<template>
  <main class="auth-page">
    <form class="panel" @submit.prevent="submit">
      <h1>{{ route.query.invite ? 'Accept Invitation' : 'Register' }}</h1>
      <label>Name <input v-model="name" required /></label>
      <label v-if="!route.query.invite">Email <input v-model="email" type="email" required /></label>
      <label>Password <input v-model="password" type="password" required /></label>
      <p v-if="error" class="error">{{ error }}</p>
      <button class="button primary">{{ route.query.invite ? 'Accept' : 'Register' }}</button>
    </form>
  </main>
</template>
