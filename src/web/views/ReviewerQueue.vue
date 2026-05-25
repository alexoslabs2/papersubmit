<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { useReviewStore } from '../stores/reviewStore';
import { useEventStore } from '../stores/eventStore';

const reviews = useReviewStore();
const eventStore = useEventStore();
const activeTab = ref<'pending' | 'completed'>('pending');
const pending = computed(() => reviews.queue.filter((item) => !item.review_id));
const completed = computed(() => reviews.queue.filter((item) => item.review_id));
const visibleQueue = computed(() => activeTab.value === 'pending' ? pending.value : completed.value);
const emptyMessage = computed(() => {
  if (reviews.error) return reviews.error;
  if (eventStore.event && eventStore.event.status !== 'reviewing') return 'Reviews are not open yet.';
  return activeTab.value === 'pending' ? 'No proposals pending review.' : 'No completed reviews.';
});

onMounted(async () => {
  await Promise.all([eventStore.loadEvent(), reviews.loadQueue()]);
});
</script>

<template>
  <section class="stack">
    <header class="page-header">
      <div>
        <h1>Review Queue</h1>
        <p>{{ pending.length }} pending · {{ completed.length }} completed</p>
      </div>
      <span v-if="eventStore.event" class="status-pill">{{ eventStore.event.status }}</span>
    </header>

    <div class="tabs" role="tablist" aria-label="Review queue">
      <button :class="{ active: activeTab === 'pending' }" type="button" @click="activeTab = 'pending'">Pending</button>
      <button :class="{ active: activeTab === 'completed' }" type="button" @click="activeTab = 'completed'">Completed</button>
    </div>

    <div v-if="reviews.loading" class="empty">Loading review queue...</div>
    <div v-else-if="visibleQueue.length === 0" class="empty" :class="{ error: reviews.error }">{{ emptyMessage }}</div>
    <div class="grid">
      <article v-for="item in visibleQueue" :key="item.id" class="item stack">
        <h2>{{ item.title }}</h2>
        <small>{{ item.speaker_full_name || item.speaker_name }} · {{ item.company_organization || item.country }}</small>
        <p>{{ item.abstract }}</p>
        <RouterLink v-if="eventStore.event?.status === 'reviewing'" class="button" :to="`/app/reviews/${item.id}`">
          {{ item.review_id ? 'Edit review' : 'Review' }}
        </RouterLink>
        <span v-else class="status-pill">Locked</span>
      </article>
    </div>
  </section>
</template>
