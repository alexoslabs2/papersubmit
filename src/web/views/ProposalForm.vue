<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useProposalStore, type ProposalFormPayload } from '../stores/proposalStore';
import { useAuthStore } from '../stores/authStore';

const error = ref('');
const saving = ref(false);
const proposals = useProposalStore();
const auth = useAuthStore();
const router = useRouter();
const keyTakeawaysMaxLength = 500;

const form = reactive<ProposalFormPayload>({
  speakerFullName: auth.user?.name ?? '',
  speakerContactEmail: auth.user?.email ?? '',
  companyOrganization: '',
  country: '',
  speakerBio: '',
  onlinePresence: '',
  title: '',
  presentationLanguages: [],
  technicalLevel: '',
  abstract: '',
  description: '',
  keyTakeaways: '',
  relatedTools: '',
  additionalNotes: ''
});

const fieldLimits = {
  speakerFullName: 80,
  speakerContactEmail: 80,
  companyOrganization: 80,
  country: 80,
  speakerBio: 500,
  onlinePresence: 100,
  abstract: 1000,
  description: 2000,
  keyTakeaways: keyTakeawaysMaxLength,
  relatedTools: 100,
  additionalNotes: 100
} as const;

const languageOptions = [
  { value: 'portuguese', label: 'Portuguese' },
  { value: 'english', label: 'English' },
  { value: 'other', label: 'Other' }
];

const technicalLevelOptions = [
  { value: 'intermediate', label: 'Intermediate', hint: 'basic knowledge of the area' },
  { value: 'advanced', label: 'Advanced', hint: 'deep technical knowledge' },
  { value: 'expert', label: 'Expert', hint: 'original research / advanced exploration' }
];

const canSubmit = computed(() => form.presentationLanguages.length > 0 && Boolean(form.technicalLevel) && !saving.value);

async function submit() {
  error.value = '';
  saving.value = true;
  try {
    await proposals.submit({ ...form, presentationLanguages: [...form.presentationLanguages] });
    await router.push('/app/proposals');
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Submission failed';
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <section class="stack">
    <header class="page-header">
      <div>
        <h1>New Proposal</h1>
        <p>Share the speaker profile and talk details reviewers need to evaluate the submission.</p>
      </div>
    </header>

    <form class="panel wide proposal-form" @submit.prevent="submit">
      <section class="form-section">
        <h2>Speaker</h2>
        <div class="form-grid">
          <label>Full name <input v-model="form.speakerFullName" :maxlength="fieldLimits.speakerFullName" required /></label>
          <label>Contact email <input v-model="form.speakerContactEmail" :maxlength="fieldLimits.speakerContactEmail" type="email" required /></label>
          <label>Company / Organization <input v-model="form.companyOrganization" :maxlength="fieldLimits.companyOrganization" required /></label>
          <label>Country <input v-model="form.country" :maxlength="fieldLimits.country" required /></label>
        </div>
        <label>Speaker Bio
          <textarea v-model="form.speakerBio" :maxlength="fieldLimits.speakerBio" rows="5" required />
          <span class="character-count">{{ form.speakerBio.length }} / {{ fieldLimits.speakerBio }}</span>
        </label>
        <label>Online Presence
          <input v-model="form.onlinePresence" :maxlength="fieldLimits.onlinePresence" placeholder="Twitter/X, LinkedIn, GitHub, personal blog" required />
          <span class="character-count">{{ form.onlinePresence.length }} / {{ fieldLimits.onlinePresence }}</span>
        </label>
      </section>

      <section class="form-section">
        <h2>Talk</h2>
        <label>Talk title <input v-model="form.title" required /></label>
        <fieldset class="field-group">
          <legend>Presentation language</legend>
          <label v-for="option in languageOptions" :key="option.value">
            <input v-model="form.presentationLanguages" type="checkbox" :value="option.value" />
            {{ option.label }}
          </label>
        </fieldset>
        <fieldset class="field-group">
          <legend>Technical level</legend>
          <label v-for="option in technicalLevelOptions" :key="option.value">
            <input v-model="form.technicalLevel" type="radio" :value="option.value" required />
            <span>{{ option.label }} <small>({{ option.hint }})</small></span>
          </label>
        </fieldset>
        <label>Abstract
          <textarea v-model="form.abstract" :maxlength="fieldLimits.abstract" rows="6" required />
          <span class="character-count">{{ form.abstract.length }} / {{ fieldLimits.abstract }}</span>
        </label>
        <label>Detailed description
          <textarea v-model="form.description" :maxlength="fieldLimits.description" rows="10" required />
          <span class="character-count">{{ form.description.length }} / {{ fieldLimits.description }}</span>
        </label>
      </section>

      <section class="form-section">
        <h2>Additional Details</h2>
        <label>Key takeaways
          <textarea v-model="form.keyTakeaways" :maxlength="fieldLimits.keyTakeaways" rows="3" required />
          <span class="character-count">{{ form.keyTakeaways.length }} / {{ fieldLimits.keyTakeaways }}</span>
        </label>
        <label>Related tools or repositories
          <input v-model="form.relatedTools" :maxlength="fieldLimits.relatedTools" required />
          <span class="character-count">{{ form.relatedTools.length }} / {{ fieldLimits.relatedTools }}</span>
        </label>
        <label>Additional notes
          <textarea v-model="form.additionalNotes" :maxlength="fieldLimits.additionalNotes" rows="3" required />
          <span class="character-count">{{ form.additionalNotes.length }} / {{ fieldLimits.additionalNotes }}</span>
        </label>
      </section>

      <p v-if="error" class="error">{{ error }}</p>
      <button class="button primary" :disabled="!canSubmit">{{ saving ? 'Submitting...' : 'Submit' }}</button>
    </form>
  </section>
</template>
