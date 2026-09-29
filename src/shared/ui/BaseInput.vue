<script setup lang="ts">
/**
 * Campo de texto. Los atributos no declarados (id, type, autocomplete,
 * aria-describedby…) pasan directamente al <input>.
 */
defineOptions({ inheritAttrs: false })

defineProps<{ invalid?: boolean }>()

const model = defineModel<string | number | null>({ default: '' })
</script>

<template>
  <input
    v-model="model"
    v-bind="$attrs"
    :aria-invalid="invalid || undefined"
    class="block min-h-11 w-full rounded-lg border bg-surface px-3 text-base text-ink placeholder:text-ink-muted/70 disabled:bg-canvas sm:text-sm"
    :class="invalid ? 'border-red-500' : 'border-line'"
  />
</template>
