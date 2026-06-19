<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { useProposalStore } from '../stores/proposalStore';
import StatusBadge from '../components/StatusBadge.vue';
import { errorMessage } from '../errors';

const proposals = useProposalStore();
const actionError = ref('');
onMounted(() => proposals.loadProposals());

async function withdraw(id: string) {
  actionError.value = '';
  try {
    await proposals.withdraw(id);
  } catch (error) {
    actionError.value = errorMessage(error, 'Proposal could not be withdrawn');
  }
}
</script>

<template>
  <section>
    <div class="section-header">
      <h1>My Proposals</h1>
      <RouterLink class="button primary" to="/app/proposals/new">New Proposal</RouterLink>
    </div>
    <p v-if="actionError" class="error">{{ actionError }}</p>
    <div v-if="proposals.loading" class="empty">Loading proposals...</div>
    <div v-else-if="proposals.error" class="empty error">{{ proposals.error }}</div>
    <div v-else-if="proposals.proposals.length === 0" class="empty">No proposals yet.</div>
    <div class="grid">
      <article v-for="proposal in proposals.proposals" :key="proposal.id" class="item">
        <h2>{{ proposal.title }}</h2>
        <StatusBadge :status="proposal.status" />
        <p>{{ proposal.abstract }}</p>
        <button class="button" :disabled="proposal.status !== 'submitted'" @click="withdraw(proposal.id)">Withdraw</button>
      </article>
    </div>
  </section>
</template>
