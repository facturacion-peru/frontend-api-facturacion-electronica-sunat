<script setup lang="ts">
import { env } from '@/core/config/env'

/**
 * Aviso del piloto (spec 009, A-43): mientras no se cierre la revisión legal
 * de datos personales (A-24), las empresas no registran datos reales de sus
 * clientes. Solo se muestra con VITE_PILOT_MODE=true.
 */
defineProps<{ compact?: boolean }>()
</script>

<template>
  <div
    v-if="env.pilotMode"
    role="note"
    class="rounded-lg border border-warning-300 bg-warning-50 text-warning-900"
    :class="compact ? 'px-3 py-2 text-xs' : 'px-4 py-3 text-sm'"
    data-test="pilot-notice"
  >
    <strong>Piloto:</strong> no registres datos personales reales de tus clientes (nombres, DNI). Usa «Cliente varios» o datos de prueba.
  </div>
</template>
