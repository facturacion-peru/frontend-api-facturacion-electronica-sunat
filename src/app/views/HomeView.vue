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
import EstablishmentFilter from '@/shared/establishments/EstablishmentFilter.vue'
import { useEstablishmentStore } from '@/shared/establishments/store'
import BaseAlert from '@/shared/ui/BaseAlert.vue'
import BaseButton from '@/shared/ui/BaseButton.vue'
import CompanyMark from '@/shared/ui/CompanyMark.vue'
import PilotNotice from '@/shared/ui/PilotNotice.vue'

/**
 * Inicio (spec 011): cómo va el día, qué requiere atención y la venta a un
 * toque. En el celular «Nueva venta» va primero; en escritorio, cuadrícula.
 * Con varios locales, las cifras son de un local o de «Todos» (spec 017, A-90).
 */
const session = useSessionStore()
const firstName = computed(() => session.session?.user.name.split(' ')[0] ?? '')
const company = computed(() => session.session?.company ?? null)
/** Nombre comercial como título; sin él, la razón social (y no se repite debajo). */
const companyTitle = computed(() => company.value?.nombre_comercial || company.value?.razon_social || '')
const legalName = computed(() => (company.value?.nombre_comercial ? company.value.razon_social : null))

const establishments = useEstablishmentStore()
const establishmentFilter = ref(establishments.defaultFilter)

const summary = ref<DashboardSummary | null>(null)
const loading = ref(true)
const failed = ref(false)

const longDate = new Intl.DateTimeFormat('es-PE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
const dateLabel = computed(() => (summary.value ? longDate.format(new Date(`${summary.value.date}T00:00:00Z`)) : ''))

async function load() {
  loading.value = true
  failed.value = false
  try {
    summary.value = await dashboardApi.summary(establishmentFilter.value)
  } catch {
    failed.value = true
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <section
    class="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-surface p-4 shadow-sm sm:p-5"
    aria-labelledby="home-company"
    data-test="home-header"
  >
    <div class="flex min-w-0 flex-1 items-center gap-4">
      <!-- En el celular la cabecera del layout ya lleva el logo. -->
      <div class="hidden shrink-0 sm:block"><CompanyMark :logo-url="company?.logo_url ?? null" :company-name="companyTitle" :size="56" /></div>
      <div class="min-w-0">
        <p class="text-sm text-ink-muted">
          Hola, {{ firstName }}<span v-if="dateLabel"> · <span class="inline-block first-letter:uppercase">{{ dateLabel }}</span></span>
        </p>
        <h1 id="home-company" class="mt-0.5 truncate text-2xl font-semibold tracking-tight text-ink" data-test="company-title">{{ companyTitle }}</h1>
        <p v-if="company" class="mt-1 flex min-w-0 flex-col gap-y-0.5 text-sm text-ink-muted sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-2" data-test="company-legal">
          <span v-if="legalName" class="min-w-0 truncate">{{ legalName }}</span>
          <span v-if="legalName" class="hidden sm:inline" aria-hidden="true">·</span>
          <span class="whitespace-nowrap">RUC <span class="font-medium text-ink tabular-nums">{{ company.ruc }}</span></span>
        </p>
      </div>
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
  </section>

  <PilotNotice class="mt-4" />

  <div v-if="establishments.multi" class="mt-4 max-w-xs">
    <EstablishmentFilter id="home-establishment" v-model="establishmentFilter" @change="load" />
  </div>

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
