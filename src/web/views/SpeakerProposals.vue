<script setup lang="ts">
import { onMounted } from 'vue';
import { RouterLink } from 'vue-router';
import { useProposalStore } from '../stores/proposalStore';
import StatusBadge from '../components/StatusBadge.vue';
const proposals = useProposalStore();
onMounted(() => proposals.loadProposals());
</script>

<template>
  <section>
    <div class="section-header">
      <h1>My Proposals</h1>
      <RouterLink class="button primary" to="/app/proposals/new">New Proposal</RouterLink>
    </div>
    <div v-if="proposals.proposals.length === 0" class="empty">No proposals yet.</div>
    <div class="grid">
      <article v-for="proposal in proposals.proposals" :key="proposal.id" class="item">
        <h2>{{ proposal.title }}</h2>
        <StatusBadge :status="proposal.status" />
        <p>{{ proposal.abstract }}</p>
        <button class="button" :disabled="proposal.status !== 'submitted'" @click="proposals.withdraw(proposal.id)">Withdraw</button>
      </article>
    </div>
  </section>
</template>
