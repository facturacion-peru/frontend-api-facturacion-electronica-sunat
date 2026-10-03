<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
    type?: 'button' | 'submit' | 'reset'
    loading?: boolean
    disabled?: boolean
    block?: boolean
  }>(),
  { variant: 'primary', type: 'button', loading: false, disabled: false, block: false },
)

const variants = {
  primary: 'bg-brand-600 text-white shadow-sm hover:bg-brand-800',
  secondary: 'border border-line bg-surface text-ink shadow-xs hover:bg-subtle',
  danger: 'bg-danger-600 text-white shadow-sm hover:brightness-110',
  ghost: 'text-brand-700 hover:bg-brand-50',
}

const classes = computed(() => [
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition active:translate-y-px',
  'disabled:cursor-not-allowed disabled:opacity-60',
  variants[props.variant],
  props.block && 'w-full',
])
</script>

<template>
  <button :type="type" :class="classes" :disabled="disabled || loading" :aria-busy="loading">
    <span
      v-if="loading"
      class="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
      aria-hidden="true"
    />
    <slot />
  </button>
</template>
