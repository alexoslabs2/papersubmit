<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../api';

const route = useRoute();
const router = useRouter();
const eventLongTextMaxLength = 1000;
const error = ref('');
const completed = ref(false);
const form = ref({
  token: String(route.query.token ?? ''),
  adminEmail: '',
  adminPassword: '',
  adminName: '',
  eventName: '',
  eventSlug: '',
  location: '',
  startDate: '',
  endDate: '',
  description: '',
  codeOfConduct: '',
  timezone: 'UTC',
  cfpOpensAt: '',
  cfpClosesAt: '',
  cfpDescription: '',
  talkFormats: ['talk', 'lightning', 'workshop'],
  scoringScale: 'SCALE_1_5',
  minReviewsRequired: 1,
  travelAssistance: ''
});

async function complete() {
  error.value = '';
  try {
    await api<{ ok: true; postSetup: string[] }>('/setup/complete', {
      method: 'POST',
      body: JSON.stringify(form.value)
    });
    completed.value = true;
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Setup failed';
  }
}
</script>

<template>
  <main class="setup-page">
    <section v-if="completed" class="panel wide stack">
      <h1>Setup Complete</h1>
      <div class="post-setup">
        <h2>Post-setup</h2>
        <ol>
          <li>Login and open Event & CFP to upload the CFP landing page image.</li>
          <li>Configure SMTP in the Admin Dashboard.</li>
          <li>Set CFP status from Draft to Open.</li>
          <li>Invite reviewers.</li>
        </ol>
      </div>
      <button class="button primary" type="button" @click="router.push('/login?redirect=/app/event')">Go to Event & CFP</button>
    </section>

    <form v-else class="panel wide" @submit.prevent="complete">
      <h1>Setup</h1>
      <div class="grid two">
        <label>Token <input v-model="form.token" required /></label>
        <label>Admin email <input v-model="form.adminEmail" type="email" required /></label>
        <label>Admin name <input v-model="form.adminName" required /></label>
        <label>Admin password <input v-model="form.adminPassword" type="password" required /></label>
        <label>Event name <input v-model="form.eventName" required /></label>
        <label>Event slug <input v-model="form.eventSlug" required /></label>
        <label>Location <input v-model="form.location" maxlength="255" /></label>
        <label>Timezone <input v-model="form.timezone" required /></label>
        <label>Start date <input v-model="form.startDate" type="datetime-local" required /></label>
        <label>End date <input v-model="form.endDate" type="datetime-local" required /></label>
        <label>CFP opens <input v-model="form.cfpOpensAt" type="datetime-local" required /></label>
        <label>CFP closes <input v-model="form.cfpClosesAt" type="datetime-local" required /></label>
        <label>Scoring scale
          <select v-model="form.scoringScale">
            <option value="SCALE_1_5">1-5</option>
            <option value="SCALE_1_10">1-10</option>
          </select>
        </label>
        <label>Minimum reviews <input v-model.number="form.minReviewsRequired" type="number" min="1" required /></label>
        <label>Travel assistance <input v-model="form.travelAssistance" maxlength="100" /></label>
      </div>
      <fieldset class="field-group">
        <legend>Talk formats</legend>
        <label><input v-model="form.talkFormats" type="checkbox" value="talk" /> Talk</label>
        <label><input v-model="form.talkFormats" type="checkbox" value="lightning" /> Lightning Talk</label>
        <label><input v-model="form.talkFormats" type="checkbox" value="workshop" /> Workshop</label>
      </fieldset>
      <div class="text-field">
        <label for="setup-description">Description</label>
        <textarea id="setup-description" v-model="form.description" :maxlength="eventLongTextMaxLength" rows="4" />
        <p class="character-count">{{ form.description.length }} / {{ eventLongTextMaxLength }}</p>
      </div>
      <div class="text-field">
        <label for="setup-cfp-description">CFP description</label>
        <textarea id="setup-cfp-description" v-model="form.cfpDescription" :maxlength="eventLongTextMaxLength" rows="4" />
        <p class="character-count">{{ form.cfpDescription.length }} / {{ eventLongTextMaxLength }}</p>
      </div>
      <div class="text-field">
        <label for="setup-code-of-conduct">Code of conduct</label>
        <textarea id="setup-code-of-conduct" v-model="form.codeOfConduct" :maxlength="eventLongTextMaxLength" rows="4" />
        <p class="character-count">{{ form.codeOfConduct.length }} / {{ eventLongTextMaxLength }}</p>
      </div>
      <p v-if="error" class="error">{{ error }}</p>
      <button class="button primary">Complete Setup</button>
    </form>
  </main>
</template>
