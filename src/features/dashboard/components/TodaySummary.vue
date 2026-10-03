<script setup lang="ts">
import { formatMoney } from '@/shared/utils/format'
import type { DashboardSummary } from '../types'

/** Ventas de hoy (HU-1): un número protagonista, no un gráfico. */
defineProps<{ today: DashboardSummary['today']; scope: DashboardSummary['scope'] }>()
</script>

<template>
  <section aria-labelledby="today-title" class="rounded-2xl border border-line bg-surface p-5 shadow-xs">
    <h2 id="today-title" class="text-sm font-medium text-ink-muted">
      {{ scope === 'own' ? 'Tus ventas de hoy' : 'Ventas de hoy' }}
    </h2>
    <p class="mt-1 text-3xl font-semibold tracking-tight text-ink">{{ formatMoney(today.total) }}</p>
    <p class="mt-1 text-sm text-ink-muted">
      {{ today.count === 1 ? '1 venta' : `${today.count} ventas` }}
    </p>
    <p class="mt-3 border-t border-line pt-3 text-xs text-ink-muted">
      Incluye IGV y descuenta las notas de crédito. Es un indicador del día, no un reporte contable.
    </p>
  </section>
</template>
