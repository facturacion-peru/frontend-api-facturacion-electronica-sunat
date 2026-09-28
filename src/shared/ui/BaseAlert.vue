<script setup lang="ts">
withDefaults(defineProps<{ variant?: 'info' | 'success' | 'warning' | 'error'; title?: string }>(), {
  variant: 'info',
})

const styles = {
  info: 'border-brand-100 bg-brand-50 text-brand-700',
  success: 'border-green-200 bg-green-50 text-green-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
  error: 'border-red-200 bg-red-50 text-red-800',
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
