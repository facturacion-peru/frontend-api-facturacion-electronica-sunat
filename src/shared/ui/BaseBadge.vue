<script setup lang="ts">
withDefaults(defineProps<{ variant?: 'neutral' | 'success' | 'warning' | 'danger' | 'info' }>(), {
  variant: 'neutral',
})

const styles = {
  neutral: 'bg-subtle text-ink-muted',
  success: 'bg-success-100 text-success-800',
  warning: 'bg-warning-100 text-warning-900',
  danger: 'bg-danger-100 text-danger-800',
  info: 'bg-brand-100 text-brand-700',
}
</script>

<template>
  <span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium" :class="styles[variant]">
    <slot />
  </span>
</template>
