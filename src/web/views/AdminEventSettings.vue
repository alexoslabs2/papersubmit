<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useEventStore } from '../stores/eventStore';
import type { PublicEvent, ScoringScale, TalkFormat } from '@shared/types';
import { errorMessage } from '../errors';

const eventStore = useEventStore();
const maxLogoBytes = 2 * 1024 * 1024;
const eventLongTextMaxLength = 1000;
const error = ref('');
const saved = ref(false);
const logoError = ref('');
const logoSaved = ref(false);
const logoUploading = ref(false);
const form = reactive({
  name: '',
  slug: '',
  location: '',
  startDate: '',
  endDate: '',
  timezone: 'UTC',
  description: '',
  codeOfConduct: '',
  cfpOpensAt: '',
  cfpClosesAt: '',
  cfpDescription: '',
  talkFormats: ['talk'] as TalkFormat[],
  scoringScale: 'SCALE_1_5' as ScoringScale,
  minReviewsRequired: 1,
  travelAssistance: '',
  status: 'draft' as PublicEvent['status']
});

const lockMessage = computed(() => {
  if (form.status === 'reviewing' || form.status === 'closed') return 'Only description and code of conduct can be changed after review starts.';
  return '';
});
const canStartReview = computed(() => eventStore.event?.status === 'open');

function toLocalInput(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return '';
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function fromLocalInput(value: string) {
  return value ? new Date(value).toISOString() : undefined;
}

function sync(event: PublicEvent) {
  form.name = event.name;
  form.slug = event.slug;
  form.location = event.location ?? '';
  form.startDate = toLocalInput(event.startDate);
  form.endDate = toLocalInput(event.endDate);
  form.timezone = event.timezone;
  form.description = event.description ?? '';
  form.codeOfConduct = event.codeOfConduct ?? '';
  form.cfpOpensAt = toLocalInput(event.cfpOpensAt);
  form.cfpClosesAt = toLocalInput(event.cfpClosesAt);
  form.cfpDescription = event.cfpDescription ?? '';
  form.talkFormats = [...event.talkFormats];
  form.scoringScale = event.scoringScale;
  form.minReviewsRequired = event.minReviewsRequired;
  form.travelAssistance = event.travelAssistance ?? '';
  form.status = event.status;
}

async function save() {
  error.value = '';
  saved.value = false;
  try {
    await eventStore.updateEvent({
      name: form.name,
      slug: form.slug,
      location: form.location || null,
      startDate: fromLocalInput(form.startDate),
      endDate: fromLocalInput(form.endDate),
      timezone: form.timezone,
      description: form.description || null,
      codeOfConduct: form.codeOfConduct || null,
      cfpOpensAt: fromLocalInput(form.cfpOpensAt),
      cfpClosesAt: fromLocalInput(form.cfpClosesAt),
      cfpDescription: form.cfpDescription || null,
      talkFormats: form.talkFormats,
      scoringScale: form.scoringScale,
      minReviewsRequired: form.minReviewsRequired,
      travelAssistance: form.travelAssistance || null,
      status: form.status
    });
    saved.value = true;
  } catch (err) {
    error.value = errorMessage(err, 'Event update failed');
  }
}

async function startReviewPhase() {
  if (!canStartReview.value) return;
  form.status = 'reviewing';
  await save();
}

async function uploadLogo(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  logoError.value = '';
  logoSaved.value = false;
  if (!file) return;
  if (!['image/jpeg', 'image/png'].includes(file.type) || file.size > maxLogoBytes) {
    logoError.value = 'Logo must be JPEG or PNG and at most 2 MB.';
    input.value = '';
    return;
  }
  logoUploading.value = true;
  try {
    await eventStore.uploadLogo(file);
    logoSaved.value = true;
  } catch (err) {
    logoError.value = errorMessage(err, 'Logo upload failed');
  } finally {
    logoUploading.value = false;
    input.value = '';
  }
}

function toggleTalkFormat(format: TalkFormat) {
  if (form.talkFormats.includes(format)) {
    if (form.talkFormats.length > 1) form.talkFormats = form.talkFormats.filter((item) => item !== format);
  } else {
    form.talkFormats = [...form.talkFormats, format];
  }
}

onMounted(async () => {
  await eventStore.loadEvent();
  if (eventStore.event) sync(eventStore.event);
});

watch(() => eventStore.event, (event) => {
  if (event) sync(event);
});
</script>

<template>
  <section class="stack">
    <header class="page-header">
      <div>
        <h1>Event & CFP</h1>
        <p>Configure the single event instance and its CFP window.</p>
      </div>
      <div class="actions">
        <button v-if="canStartReview" class="button primary" type="button" @click="startReviewPhase">Start Review Phase</button>
        <span class="status-pill">{{ form.status }}</span>
      </div>
    </header>

    <div v-if="eventStore.loading" class="empty">Loading event settings...</div>
    <div v-else-if="eventStore.error" class="empty error">{{ eventStore.error }}</div>
    <form v-else class="panel wide stack" @submit.prevent="save">
      <p v-if="lockMessage" class="notice">{{ lockMessage }}</p>
      <section class="logo-upload">
        <img v-if="eventStore.event?.logoUrl" class="logo-preview" :src="eventStore.event.logoUrl" alt="" />
        <div v-else class="logo-preview" aria-hidden="true"></div>
        <div>
          <label>CFP landing page image <input accept="image/jpeg,image/png" type="file" @change="uploadLogo" /></label>
          <p class="field-help">JPEG or PNG, maximum 2 MB. The image is resized to 400x400 WebP.</p>
          <p v-if="logoError" class="error">{{ logoError }}</p>
          <p v-if="logoSaved" class="notice">Logo uploaded.</p>
          <p v-if="logoUploading" class="notice">Uploading logo...</p>
        </div>
      </section>

      <div class="grid two">
        <label>Event name <input v-model="form.name" required maxlength="200" /></label>
        <label>Slug <input v-model="form.slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" /></label>
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
        <label>Minimum reviews <input v-model.number="form.minReviewsRequired" min="1" type="number" required /></label>
        <label>Status
          <select v-model="form.status">
            <option value="draft">Draft</option>
            <option value="open">Open</option>
            <option value="reviewing">Reviewing</option>
            <option value="closed">Closed</option>
          </select>
        </label>
        <label>Travel assistance <input v-model="form.travelAssistance" maxlength="100" /></label>
      </div>

      <fieldset class="field-group">
        <legend>Talk formats</legend>
        <label><input :checked="form.talkFormats.includes('talk')" type="checkbox" @change="toggleTalkFormat('talk')" /> Talk</label>
        <label><input :checked="form.talkFormats.includes('lightning')" type="checkbox" @change="toggleTalkFormat('lightning')" /> Lightning Talk</label>
        <label><input :checked="form.talkFormats.includes('workshop')" type="checkbox" @change="toggleTalkFormat('workshop')" /> Workshop</label>
      </fieldset>

      <div class="text-field">
        <label for="event-description">Description</label>
        <textarea id="event-description" v-model="form.description" :maxlength="eventLongTextMaxLength" rows="4" />
        <p class="character-count">{{ form.description.length }} / {{ eventLongTextMaxLength }}</p>
      </div>
      <div class="text-field">
        <label for="event-cfp-description">CFP description</label>
        <textarea id="event-cfp-description" v-model="form.cfpDescription" :maxlength="eventLongTextMaxLength" rows="4" />
        <p class="character-count">{{ form.cfpDescription.length }} / {{ eventLongTextMaxLength }}</p>
      </div>
      <div class="text-field">
        <label for="event-code-of-conduct">Code of conduct</label>
        <textarea id="event-code-of-conduct" v-model="form.codeOfConduct" :maxlength="eventLongTextMaxLength" rows="5" />
        <p class="character-count">{{ form.codeOfConduct.length }} / {{ eventLongTextMaxLength }}</p>
      </div>

      <p v-if="error" class="error">{{ error }}</p>
      <p v-if="saved" class="notice">Saved.</p>
      <button class="button primary">Save Event</button>
    </form>
  </section>
</template>
