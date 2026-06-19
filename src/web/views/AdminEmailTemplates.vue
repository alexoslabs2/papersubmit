<script setup lang="ts">
import { onMounted } from 'vue';
import { useAdminStore } from '../stores/adminStore';
const admin = useAdminStore();
onMounted(() => admin.loadTemplates());
</script>

<template>
  <section>
    <h1>Email Templates</h1>
    <div v-if="admin.loading" class="empty">Loading email templates...</div>
    <div v-else-if="admin.error" class="empty error">{{ admin.error }}</div>
    <div v-else class="grid">
      <article v-for="template in admin.templates" :key="String(template.id)" class="item">
        <h2>{{ template.name }}</h2>
        <p>{{ template.subject }}</p>
      </article>
    </div>
  </section>
</template>
