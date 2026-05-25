<script setup lang="ts">
defineProps<{ status: string }>();
</script>

<template>
  <span class="status" :class="`status-${status}`">{{ status.replace('_', ' ') }}</span>
</template>
