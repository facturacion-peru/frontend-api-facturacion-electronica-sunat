<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import { ApiError } from '@/core/api/errors'
import BaseAlert from '@/shared/ui/BaseAlert.vue'
import { platformApi } from '../api'
import type { LookupUsageDay } from '../types'

/**
 * Consultas de DNI y RUC al servicio (spec 018, HU-4): cuántas se hacen al
 * día, para decidir cuándo pagar el plan ilimitado (A-96). Lo ya guardado no
 * gasta consultas, así que aquí solo cuenta lo que se pidió al servicio.
 */
const days = ref<LookupUsageDay[]>([])
const error = ref<string | null>(null)
const loaded = ref(false)

/** Más reciente primero; el último día de la API es hoy. */
const rows = computed(() => [...days.value].reverse())
const today = computed(() => days.value[days.value.length - 1] ?? null)

const dayFormat = new Intl.DateTimeFormat('es-PE', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
const dayLabel = (date: string) => dayFormat.format(new Date(`${date}T00:00:00Z`))

onMounted(async () => {
  try {
    days.value = await platformApi.lookupUsage()
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : 'No se pudo cargar el uso.'
  } finally {
    loaded.value = true
  }
})
</script>

<template>
  <h1 class="text-xl font-semibold">Consultas DNI/RUC</h1>
  <p class="mt-1 text-sm text-ink-muted">Consultas al servicio de los últimos 14 días, de todas las empresas. Lo que ya estaba guardado no cuenta.</p>

  <BaseAlert v-if="error" variant="error" class="mt-4">{{ error }}</BaseAlert>
  <p v-else-if="!loaded" class="mt-4 text-sm text-ink-muted">Cargando…</p>

  <template v-else>
    <dl class="mt-4 w-fit rounded-xl border border-line bg-surface p-4" data-test="lookups-today">
      <dt class="text-xs text-ink-muted">Hoy</dt>
      <dd class="mt-1 text-2xl font-semibold">{{ today?.total ?? 0 }} consultas</dd>
    </dl>

    <div class="mt-4 overflow-x-auto rounded-xl border border-line bg-surface">
      <table class="w-full min-w-[28rem] text-sm" data-test="lookups-table">
        <caption class="sr-only">Consultas por día</caption>
        <thead class="text-left text-xs text-ink-muted">
          <tr class="border-b border-line">
            <th scope="col" class="px-4 py-2 font-medium">Día</th>
            <th scope="col" class="px-4 py-2 text-right font-medium">Total</th>
            <th scope="col" class="px-4 py-2 text-right font-medium">Encontrados</th>
            <th scope="col" class="px-4 py-2 text-right font-medium">No encontrados</th>
            <th scope="col" class="px-4 py-2 text-right font-medium">Fallidos</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-line">
          <tr v-for="day in rows" :key="day.date">
            <th scope="row" class="px-4 py-2 text-left font-normal first-letter:uppercase">{{ dayLabel(day.date) }}</th>
            <td class="px-4 py-2 text-right font-medium tabular-nums">{{ day.total }}</td>
            <td class="px-4 py-2 text-right tabular-nums">{{ day.found }}</td>
            <td class="px-4 py-2 text-right tabular-nums">{{ day.not_found }}</td>
            <td class="px-4 py-2 text-right tabular-nums" :class="day.failed > 0 && 'text-warning-700'">{{ day.failed }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </template>
</template>
