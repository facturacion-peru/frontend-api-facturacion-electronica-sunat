<script setup lang="ts">
withDefaults(defineProps<{ variant?: 'info' | 'success' | 'warning' | 'error'; title?: string }>(), {
  variant: 'info',
})

const styles = {
  info: 'border-brand-100 bg-brand-50 text-brand-700',
  success: 'border-success-200 bg-success-50 text-success-800',
  warning: 'border-warning-200 bg-warning-50 text-warning-900',
  error: 'border-danger-200 bg-danger-50 text-danger-800',
}
</script>

<template>
  <div
    :role="variant === 'error' ? 'alert' : 'status'"
    class="rounded-lg border px-4 py-3 text-sm"
    :class="styles[variant]"
  >
    <p v-if="title" class="font-medium">{{ title }}</p>
    <div :class="title && 'mt-1'"><slot /></div>
  </div>
</template>
