<script setup lang="ts">
defineProps<{ title: string; description?: string }>()
</script>

<template>
  <div class="rounded-lg border border-dashed border-line px-6 py-10 text-center">
    <p class="font-medium text-ink">{{ title }}</p>
    <p v-if="description" class="mt-1 text-sm text-ink-muted">{{ description }}</p>
    <div v-if="$slots.default" class="mt-4"><slot /></div>
  </div>
</template>
