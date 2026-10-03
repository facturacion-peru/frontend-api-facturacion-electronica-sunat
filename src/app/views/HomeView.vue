<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import { useSessionStore } from '@/core/auth/session-store'
import { dashboardApi } from '@/features/dashboard/api'
import AttentionList from '@/features/dashboard/components/AttentionList.vue'
import RecentSales from '@/features/dashboard/components/RecentSales.vue'
import TodaySummary from '@/features/dashboard/components/TodaySummary.vue'
import WeekChart from '@/features/dashboard/components/WeekChart.vue'
import type { DashboardSummary } from '@/features/dashboard/types'
import SunatStatusCard from '@/features/sunat/components/SunatStatusCard.vue'
import BaseAlert from '@/shared/ui/BaseAlert.vue'
import BaseButton from '@/shared/ui/BaseButton.vue'
import PilotNotice from '@/shared/ui/PilotNotice.vue'

/**
 * Inicio (spec 011): cómo va el día, qué requiere atención y la venta a un
 * toque. En el celular «Nueva venta» va primero; en escritorio, cuadrícula.
 */
const session = useSessionStore()
const firstName = computed(() => session.session?.user.name.split(' ')[0] ?? '')
const company = computed(() => session.session?.company?.nombre_comercial ?? session.session?.company?.razon_social)

const summary = ref<DashboardSummary | null>(null)
const loading = ref(true)
const failed = ref(false)

const longDate = new Intl.DateTimeFormat('es-PE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
const dateLabel = computed(() => (summary.value ? longDate.format(new Date(`${summary.value.date}T00:00:00Z`)) : ''))

async function load() {
  loading.value = true
  failed.value = false
  try {
    summary.value = await dashboardApi.summary()
  } catch {
    failed.value = true
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="flex flex-wrap items-end justify-between gap-4">
    <div class="min-w-0">
      <h1 class="text-2xl font-semibold tracking-tight">Hola, {{ firstName }}</h1>
      <p class="mt-1 text-sm text-ink-muted">
        <span v-if="dateLabel" class="first-letter:uppercase">{{ dateLabel }} · </span>{{ company }}
      </p>
    </div>
    <RouterLink
      :to="{ name: 'new-sale' }"
      class="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 text-base font-semibold text-white shadow-sm transition hover:bg-brand-800 sm:w-auto"
    >
      <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" class="size-5">
        <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
      </svg>
      Nueva venta
    </RouterLink>
  </div>

  <PilotNotice class="mt-4" />

  <div v-if="loading" class="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3" aria-busy="true" aria-label="Cargando el resumen">
    <div v-for="n in 4" :key="n" class="h-40 animate-pulse rounded-2xl bg-subtle" :class="n === 2 || n === 3 ? 'lg:col-span-2' : ''" />
  </div>

  <BaseAlert v-else-if="failed" variant="error" class="mt-6" title="No se pudo cargar el resumen">
    Revisa tu conexión e inténtalo otra vez.
    <BaseButton variant="secondary" class="mt-3" data-test="retry" @click="load">Reintentar</BaseButton>
  </BaseAlert>

  <div v-else-if="summary" class="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
    <TodaySummary :today="summary.today" :scope="summary.scope" />
    <AttentionList :attention="summary.attention" class="lg:col-span-2" />
    <WeekChart :days="summary.last_7_days" class="lg:col-span-2" />
    <RecentSales :sales="summary.recent_sales" />
  </div>

  <SunatStatusCard class="mt-6" />
</template>
