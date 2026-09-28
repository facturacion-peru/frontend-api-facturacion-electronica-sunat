<script setup lang="ts">
/**
 * Etiqueta, ayuda y error de un campo. El control va en el slot y recibe
 * `describedBy` para enlazar ayuda y error por aria-describedby.
 */
import { computed } from 'vue'

const props = defineProps<{
  label: string
  for: string
  error?: string | null
  hint?: string
}>()

const hintId = computed(() => `${props.for}-hint`)
const errorId = computed(() => `${props.for}-error`)
const describedBy = computed(
  () => [props.hint && hintId.value, props.error && errorId.value].filter(Boolean).join(' ') || undefined,
)
</script>

<template>
  <div class="space-y-1.5">
    <label :for="props.for" class="block text-sm font-medium text-ink">{{ label }}</label>
    <slot :described-by="describedBy" :invalid="Boolean(error)" />
    <p v-if="hint && !error" :id="hintId" class="text-xs text-ink-muted">{{ hint }}</p>
    <p v-if="error" :id="errorId" class="text-xs text-red-600">{{ error }}</p>
  </div>
</template>
