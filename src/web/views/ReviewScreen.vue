<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useReviewStore } from '../stores/reviewStore';
import { useEventStore } from '../stores/eventStore';

const route = useRoute();
const router = useRouter();
const reviews = useReviewStore();
const eventStore = useEventStore();
const score = ref(3);
const comments = ref('');
const item = computed(() => reviews.queue.find((proposal) => proposal.id === route.params.id));
const missing = computed(() => !reviews.loading && !item.value);
const languageLabels: Record<string, string> = { portuguese: 'Portuguese', english: 'English', other: 'Other' };
const levelLabels: Record<string, string> = {
  intermediate: 'Intermediate (basic knowledge of the area)',
  advanced: 'Advanced (deep technical knowledge)',
  expert: 'Expert (original research / advanced exploration)'
};
const proposalFields = computed(() => {
  const proposal = item.value;
  if (!proposal) return [];
  return [
    ['Full name', proposal.speaker_full_name],
    ['Contact email', proposal.speaker_contact_email],
    ['Company / Organization', proposal.company_organization],
    ['Country', proposal.country],
    ['Speaker Bio', proposal.speaker_bio],
    ['Online Presence', proposal.online_presence],
    ['Presentation language', proposal.presentation_languages.map((language) => languageLabels[language] ?? language).join(', ')],
    ['Technical level', levelLabels[proposal.technical_level] ?? proposal.technical_level],
    ['Abstract', proposal.abstract],
    ['Detailed description', proposal.description],
    ['Key takeaways', proposal.key_takeaways],
    ['Related tools or repositories', proposal.related_tools],
    ['Additional notes', proposal.additional_notes]
  ];
});

onMounted(async () => {
  await Promise.all([eventStore.loadEvent(), reviews.loadQueue()]);
});

watch(item, (proposal) => {
  if (!proposal) return;
  score.value = proposal.score ?? 3;
  comments.value = proposal.comments ?? '';
}, { immediate: true });

async function save() {
  await reviews.saveReview(String(route.params.id), score.value, comments.value);
  await router.push('/app/reviews');
}
</script>

<template>
  <section class="stack">
    <h1>{{ item?.title ?? 'Review' }}</h1>
    <div v-if="reviews.loading" class="empty">Loading proposal...</div>
    <div v-else-if="reviews.error" class="empty error">{{ reviews.error }}</div>
    <div v-else-if="missing" class="empty">Proposal is not available for review.</div>
    <dl v-else class="proposal-details">
      <template v-for="[label, value] in proposalFields" :key="label">
        <dt>{{ label }}</dt>
        <dd>{{ value || 'Not provided' }}</dd>
      </template>
    </dl>
    <form v-if="item && eventStore.event?.status === 'reviewing'" class="panel" @submit.prevent="save">
      <label>Score <input v-model.number="score" min="1" max="5" type="number" /></label>
      <label>Comments <textarea v-model="comments" rows="8" required /></label>
      <button class="button primary">Submit Review</button>
    </form>
    <div v-else-if="item" class="empty">Reviews are not open yet.</div>
  </section>
</template>
