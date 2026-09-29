<script setup lang="ts">
/**
 * Distintivo del ambiente de SUNAT (HU-4.2). En beta nada tiene valor
 * legal y debe verse siempre; lo usan la configuración y la emisión (005).
 */
withDefaults(defineProps<{ environment?: 'beta' | 'production' }>(), { environment: 'beta' })
</script>

<template>
  <span
    v-if="environment === 'beta'"
    class="inline-flex items-center rounded-full border border-amber-300 bg-amber-100 px-2.5 py-0.5 text-xs font-semibold tracking-wide text-amber-900"
    data-test="environment-badge"
  >
    PRUEBAS — sin valor legal
  </span>
</template>
