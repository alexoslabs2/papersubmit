<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useProposalStore } from '../stores/proposalStore';
import { useAdminStore } from '../stores/adminStore';
import { useAuthStore } from '../stores/authStore';
import { api } from '../api';
import StatusBadge from '../components/StatusBadge.vue';
import { errorMessage } from '../errors';

const route = useRoute();
const router = useRouter();
const proposals = useProposalStore();
const admin = useAdminStore();
const auth = useAuthStore();
const score = ref(5);
const comments = ref('');
const savingReview = ref(false);
const reviewError = ref('');
const decisionError = ref('');
const reviews = computed(() => proposals.selected?.reviews ?? []);
const averageScore = computed(() => proposals.selected?.averageScore ?? null);
const ownReview = computed(() => reviews.value.find((review) => review.reviewerId === auth.user?.id));
const canReview = computed(() => proposals.selected?.status === 'under_review');
const languageLabels: Record<string, string> = { portuguese: 'Portuguese', english: 'English', other: 'Other' };
const levelLabels: Record<string, string> = {
  intermediate: 'Intermediate (basic knowledge of the area)',
  advanced: 'Advanced (deep technical knowledge)',
  expert: 'Expert (original research / advanced exploration)'
};
const proposalFields = computed(() => {
  const proposal = proposals.selected;
  if (!proposal) return [];
  return [
    ['Full name', proposal.speakerFullName],
    ['Contact email', proposal.speakerContactEmail],
    ['Company / Organization', proposal.companyOrganization],
    ['Country', proposal.country],
    ['Speaker Bio', proposal.speakerBio],
    ['Online Presence', proposal.onlinePresence],
    ['Presentation language', proposal.presentationLanguages.map((language) => languageLabels[language] ?? language).join(', ')],
    ['Technical level', levelLabels[proposal.technicalLevel] ?? proposal.technicalLevel],
    ['Abstract', proposal.abstract],
    ['Detailed description', proposal.description],
    ['Key takeaways', proposal.keyTakeaways],
    ['Related tools or repositories', proposal.relatedTools],
    ['Additional notes', proposal.additionalNotes]
  ];
});
onMounted(() => proposals.loadProposal(String(route.params.id)));
watch(ownReview, (review) => {
  if (!review) return;
  score.value = review.score;
  comments.value = review.comments;
}, { immediate: true });
async function decide(decision: 'accepted' | 'rejected') {
  if (!window.confirm(`Mark proposal as ${decision}?`)) return;
  decisionError.value = '';
  try {
    await admin.decide(String(route.params.id), decision);
    await router.push('/app/submissions');
  } catch (error) {
    decisionError.value = errorMessage(error, 'Decision could not be saved');
  }
}
async function saveReview() {
  savingReview.value = true;
  reviewError.value = '';
  try {
    await api('/reviews', {
      method: 'POST',
      body: JSON.stringify({ proposalId: String(route.params.id), score: score.value, comments: comments.value })
    });
    await proposals.loadProposal(String(route.params.id));
  } catch (error) {
    reviewError.value = error instanceof Error ? error.message : 'Unable to save review';
  } finally {
    savingReview.value = false;
  }
}
</script>

<template>
  <section v-if="proposals.selected">
    <h1>{{ proposals.selected.title }}</h1>
    <StatusBadge :status="proposals.selected.status" />
    <dl class="proposal-details">
      <template v-for="[label, value] in proposalFields" :key="label">
        <dt>{{ label }}</dt>
        <dd>{{ value || 'Not provided' }}</dd>
      </template>
    </dl>
    <section class="review-summary">
      <h2>Reviews</h2>
      <div class="metric-grid">
        <article class="metric">
          <span>Reviews</span>
          <strong>{{ proposals.selected.reviewCount ?? reviews.length }}</strong>
        </article>
        <article class="metric">
          <span>Average score</span>
          <strong>{{ averageScore ?? 'N/A' }}</strong>
        </article>
      </div>
      <div v-if="reviews.length === 0" class="empty">No reviews have been submitted yet.</div>
      <div v-else class="review-list">
        <article v-for="review in reviews" :key="review.id" class="item review-item">
          <header>
            <div>
              <h3>{{ review.reviewerName }}</h3>
              <small>{{ review.reviewerEmail }}</small>
            </div>
            <strong class="score">Score {{ review.score }}</strong>
          </header>
          <p>{{ review.comments || 'No comments provided.' }}</p>
        </article>
      </div>
      <form class="item review-editor" @submit.prevent="saveReview">
        <h3>{{ ownReview ? 'Update Admin Review' : 'Add Admin Review' }}</h3>
        <label>Score <input v-model.number="score" min="1" max="10" type="number" :disabled="!canReview || savingReview" required /></label>
        <label>Comments <textarea v-model="comments" rows="5" :disabled="!canReview || savingReview" required /></label>
        <p v-if="reviewError" class="error">{{ reviewError }}</p>
        <button class="button primary" :disabled="!canReview || savingReview">{{ savingReview ? 'Saving...' : 'Save Review' }}</button>
      </form>
    </section>
    <p v-if="decisionError" class="error">{{ decisionError }}</p>
    <div class="actions">
      <button class="button accept" :disabled="proposals.selected.status !== 'under_review'" @click="decide('accepted')">Accept</button>
      <button class="button reject" :disabled="proposals.selected.status !== 'under_review'" @click="decide('rejected')">Reject</button>
    </div>
  </section>
  <section v-else class="stack">
    <h1>Submission</h1>
    <div v-if="proposals.loading" class="empty">Loading submission...</div>
    <div v-else-if="proposals.error" class="empty error">{{ proposals.error }}</div>
    <div v-else class="empty">Submission not found.</div>
  </section>
</template>
