<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { RouterLink } from 'vue-router';
import { formatCfpDescription } from '../landingText';
import { useEventStore } from '../stores/eventStore';

const eventStore = useEventStore();
onMounted(() => eventStore.loadEvent());

const formatter = computed(() => {
  const timezone = eventStore.event?.timezone ?? 'UTC';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short', timeZone: timezone });
});

const cfpState = computed(() => {
  const event = eventStore.event;
  if (!event) return { label: 'CFP pending', open: false };
  const now = Date.now();
  const opens = new Date(event.cfpOpensAt).getTime();
  const closes = new Date(event.cfpClosesAt).getTime();
  if (event.status === 'open' && now >= opens && now <= closes) return { label: `Open until ${formatter.value.format(new Date(closes))}`, open: true };
  if (now < opens) return { label: `Coming soon: ${formatter.value.format(new Date(opens))}`, open: false };
  return { label: 'CFP closed', open: false };
});

const cfpDescription = computed(() => formatCfpDescription(eventStore.event?.cfpDescription));

function formatDate(value: string) {
  return formatter.value.format(new Date(value));
}

function formatTalk(format: string) {
  if (format === 'lightning') return 'Lightning Talk';
  return format.charAt(0).toUpperCase() + format.slice(1);
}
</script>

<template>
  <main class="public-page">
    <section class="public-hero">
      <section class="hero-logo">
        <img v-if="eventStore.event?.logoUrl" class="event-logo" :src="eventStore.event.logoUrl" alt="" />
      </section>
      <section class="hero-copy">
        <h1>{{ eventStore.event?.name ?? 'Paper Submit' }}</h1>
        <p v-if="eventStore.error" class="error">{{ eventStore.error }}</p>
        <div class="actions">
          <RouterLink v-if="cfpState.open" class="button primary" to="/register?next=/app/proposals/new">Submit a Proposal</RouterLink>
          <button v-else class="button primary" disabled>Submit a Proposal</button>
          <RouterLink class="button" to="/login">Login</RouterLink>
          <a v-if="eventStore.event?.codeOfConduct" class="button" href="#code-of-conduct">Code of Conduct</a>
        </div>
      </section>
    </section>

    <section v-if="eventStore.event" class="public-details">
      <section class="timeline">
        <span>{{ cfpState.label }}</span>
        <strong>{{ formatDate(eventStore.event.startDate) }} - {{ formatDate(eventStore.event.endDate) }}</strong>
        <small v-if="eventStore.event.location">{{ eventStore.event.location }}</small>
      </section>

      <article v-if="eventStore.event.description" class="topic">
        <h2>Event Description</h2>
        <p>{{ eventStore.event.description }}</p>
        <div class="format-list">
          <span v-for="format in eventStore.event.talkFormats" :key="format" class="status-pill">{{ formatTalk(format) }}</span>
        </div>
      </article>

      <article v-if="eventStore.event.cfpDescription" class="topic">
        <h2>CFP Description</h2>
        <p v-if="cfpDescription.intro">{{ cfpDescription.intro }}</p>
        <p v-for="paragraph in cfpDescription.paragraphs" :key="paragraph">{{ paragraph }}</p>
        <ul v-if="cfpDescription.listItems.length" class="topic-list">
          <li v-for="item in cfpDescription.listItems" :key="item">{{ item }}</li>
        </ul>
      </article>

      <article v-if="eventStore.event.travelAssistance" class="topic">
        <h2>Travel Assistance information</h2>
        <p>{{ eventStore.event.travelAssistance }}</p>
      </article>

      <article v-if="eventStore.event.codeOfConduct" id="code-of-conduct" class="topic">
        <h2>Link to the code of conduct</h2>
        <a href="#code-of-conduct">Read the code of conduct</a>
      </article>
    </section>
  </main>
</template>
