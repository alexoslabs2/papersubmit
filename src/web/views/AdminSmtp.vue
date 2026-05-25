<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { api } from '../api';

interface SmtpSettings {
  host: string;
  port: number;
  username: string | null;
  from_email: string;
  from_name: string;
}

const form = ref({ host: '', port: 587, username: '', password: '', fromEmail: '', fromName: 'Paper Submit' });
const notice = ref('');
const error = ref('');

function hydrate(settings: SmtpSettings | null | undefined) {
  if (!settings) return;
  form.value = {
    host: settings.host,
    port: settings.port,
    username: settings.username ?? '',
    password: '',
    fromEmail: settings.from_email,
    fromName: settings.from_name
  };
}

async function load() {
  error.value = '';
  try {
    const data = await api<{ smtp: SmtpSettings | null }>('/admin/smtp');
    hydrate(data.smtp);
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unable to load SMTP settings';
  }
}

async function save() {
  error.value = '';
  try {
    await api('/admin/smtp', { method: 'PUT', body: JSON.stringify(form.value) });
    await load();
    notice.value = 'Saved.';
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'SMTP save failed';
  }
}
async function test() {
  error.value = '';
  try {
    await api('/admin/smtp/test', { method: 'POST' });
    notice.value = 'SMTP verified.';
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'SMTP test failed';
  }
}

onMounted(load);
</script>

<template>
  <section>
    <h1>SMTP</h1>
    <form class="panel" @submit.prevent="save">
      <label>Host <input v-model="form.host" required /></label>
      <label>Port <input v-model.number="form.port" type="number" required /></label>
      <label>Username <input v-model="form.username" /></label>
      <label>Password <input v-model="form.password" type="password" /></label>
      <label>From email <input v-model="form.fromEmail" type="email" required /></label>
      <label>From name <input v-model="form.fromName" required /></label>
      <p v-if="error" class="error">{{ error }}</p>
      <p class="notice">{{ notice }}</p>
      <div class="actions">
        <button class="button primary">Save</button>
        <button class="button" type="button" @click="test">Test</button>
      </div>
    </form>
  </section>
</template>
