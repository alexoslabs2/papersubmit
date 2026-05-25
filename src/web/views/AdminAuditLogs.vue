<script setup lang="ts">
import { onMounted } from 'vue';
import { useAdminStore } from '../stores/adminStore';
const admin = useAdminStore();
onMounted(() => admin.loadAuditLogs());
</script>

<template>
  <section>
    <h1>Audit Logs</h1>
    <table>
      <thead><tr><th>ID</th><th>Action</th><th>Entity</th><th>Created</th></tr></thead>
      <tbody>
        <tr v-for="log in admin.auditLogs" :key="String(log.id)">
          <td>{{ log.id }}</td>
          <td>{{ log.action }}</td>
          <td>{{ log.entity_type }}</td>
          <td>{{ log.created_at }}</td>
        </tr>
      </tbody>
    </table>
  </section>
</template>
