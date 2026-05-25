<script setup lang="ts">
import { onMounted } from 'vue';
import { RouterLink } from 'vue-router';
import { useAdminStore } from '../stores/adminStore';
import StatusBadge from '../components/StatusBadge.vue';

const admin = useAdminStore();
onMounted(() => admin.loadSubmissions());
</script>

<template>
  <section>
    <h1>Submissions</h1>
    <div v-if="admin.submissions.length === 0" class="empty">No submissions yet.</div>
    <table v-else>
      <thead><tr><th>Title</th><th>Speaker</th><th>Status</th><th></th></tr></thead>
      <tbody>
        <tr v-for="submission in admin.submissions" :key="String(submission.id)">
          <td>{{ submission.title }}</td>
          <td>{{ submission.speaker_full_name || submission.speaker_name }}</td>
          <td><StatusBadge :status="String(submission.status)" /></td>
          <td><RouterLink :to="`/app/submissions/${submission.id}`">Open</RouterLink></td>
        </tr>
      </tbody>
    </table>
  </section>
</template>
