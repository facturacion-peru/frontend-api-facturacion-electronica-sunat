<script setup lang="ts">
import { computed } from 'vue'

import { formatMoney } from '@/shared/utils/format'
import type { DashboardDay } from '../types'

/**
 * Ventas de los últimos 7 días (HU-1): una sola serie, así que sin leyenda;
 * el título la nombra. Barras finas con extremo redondeado sobre la línea
 * base, el valor de hoy rotulado y el resto al pasar el cursor. Para lectores
 * de pantalla, el gráfico se oculta y se expone una tabla con los datos.
 */
const props = defineProps<{ days: DashboardDay[] }>()

const weekday = new Intl.DateTimeFormat('es-PE', { weekday: 'short', timeZone: 'UTC' })
const longDate = new Intl.DateTimeFormat('es-PE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
const asDate = (iso: string) => new Date(`${iso}T00:00:00Z`)

const bars = computed(() => {
  // Un día con más notas de crédito que ventas puede ser negativo: se dibuja en 0.
  const values = props.days.map((d) => Math.max(Number(d.total), 0))
  const max = Math.max(...values, 0)

  return props.days.map((day, i) => {
    const isToday = i === props.days.length - 1

    return {
      ...day,
      isToday,
      // Rótulos y tooltips de los extremos se alinean al borde para no salirse de la tarjeta.
      align: i === 0 ? 'left-0' : i >= props.days.length - 2 ? 'right-0' : 'left-1/2 -translate-x-1/2',
      label: isToday ? 'Hoy' : weekday.format(asDate(day.date)).replace('.', ''),
      longLabel: isToday ? 'Hoy' : longDate.format(asDate(day.date)),
      height: max > 0 ? (values[i]! / max) * 100 : 0,
    }
  })
})
</script>

<template>
  <section aria-labelledby="week-title" class="flex flex-col rounded-2xl border border-line bg-surface p-5 shadow-xs">
    <h2 id="week-title" class="text-sm font-medium text-ink-muted">Últimos 7 días</h2>

    <div aria-hidden="true" class="mt-2 flex flex-1 flex-col">
      <div class="relative flex min-h-36 flex-1 items-end gap-0.5 border-b border-line pt-10">
        <div
          v-for="bar in bars"
          :key="bar.date"
          data-test="bar"
          class="group relative flex h-full flex-1 items-end justify-center"
        >
          <!-- Área de cursor más grande que la barra. -->
          <div
            class="w-full max-w-7 rounded-t transition-colors"
            :class="bar.isToday ? 'bg-brand-500' : 'bg-brand-300 group-hover:bg-brand-400'"
            :style="{ height: `${bar.height}%`, minHeight: bar.height > 0 ? '2px' : '0' }"
          />
          <span
            v-if="bar.isToday && bar.height > 0"
            class="absolute right-0 -translate-y-full pb-1 text-xs font-semibold whitespace-nowrap text-ink"
            :style="{ bottom: `${bar.height}%` }"
          >
            {{ formatMoney(bar.total) }}
          </span>
          <div
            class="pointer-events-none absolute bottom-full z-10 mb-1 hidden rounded-lg bg-ink px-2.5 py-1.5 text-xs whitespace-nowrap text-surface shadow-lg group-hover:block"
            :class="bar.align"
          >
            <p class="font-medium capitalize">{{ bar.longLabel }}</p>
            <p>{{ formatMoney(bar.total) }} · {{ bar.count === 1 ? '1 venta' : `${bar.count} ventas` }}</p>
          </div>
        </div>
      </div>
      <div class="mt-1.5 flex gap-0.5">
        <span
          v-for="bar in bars"
          :key="bar.date"
          class="flex-1 text-center text-xs capitalize"
          :class="bar.isToday ? 'font-semibold text-ink' : 'text-ink-muted'"
        >
          {{ bar.label }}
        </span>
      </div>
    </div>

    <!-- sr-only va en un div: aplicado a <table> no la oculta del todo (la tabla ignora el ancho y el caption puede verse). -->
    <div class="sr-only">
      <table>
        <caption>Ventas de los últimos 7 días</caption>
        <thead>
          <tr><th scope="col">Día</th><th scope="col">Monto</th><th scope="col">Ventas</th></tr>
        </thead>
        <tbody>
          <tr v-for="bar in bars" :key="bar.date">
            <th scope="row">{{ bar.longLabel }}</th>
            <td>{{ formatMoney(bar.total) }}</td>
            <td>{{ bar.count }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
