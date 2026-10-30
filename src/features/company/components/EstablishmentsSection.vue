<script setup lang="ts">
/**
 * «Mi empresa → Locales» (spec 017, HU-1): los locales de la empresa,
 * también los inactivos (su historial se sigue viendo). Se muestra aunque
 * haya uno solo: es donde el administrador crea el segundo.
 */
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'

import { ApiError } from '@/core/api/errors'
import { useEstablishmentStore } from '@/shared/establishments/store'
import BaseAlert from '@/shared/ui/BaseAlert.vue'
import BaseBadge from '@/shared/ui/BaseBadge.vue'
import BaseButton from '@/shared/ui/BaseButton.vue'

const route = useRoute()
const store = useEstablishmentStore()
const loading = ref(true)
const error = ref<string | null>(null)

onMounted(async () => {
  try {
    await store.reload()
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : 'No se pudieron cargar los locales.'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <section class="rounded-xl border border-line bg-surface p-5" aria-labelledby="establishments-title">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 id="establishments-title" class="font-semibold">Locales</h2>
        <p class="mt-1 text-xs text-ink-muted">Cada local con su código de anexo de SUNAT, su serie y su stock.</p>
      </div>
      <RouterLink :to="{ name: 'establishment-create' }">
        <BaseButton variant="secondary" tabindex="-1">Nuevo local</BaseButton>
      </RouterLink>
    </div>

    <BaseAlert v-if="route.query.local" variant="success" class="mt-4">
      {{ route.query.local === 'creado' ? 'Local creado.' : 'Cambios del local guardados.' }}
    </BaseAlert>
    <BaseAlert v-if="error" variant="error" class="mt-4">{{ error }}</BaseAlert>
    <p v-else-if="loading" class="mt-4 text-sm text-ink-muted">Cargando…</p>

    <ul v-else class="mt-4 divide-y divide-line rounded-xl border border-line" data-test="establishment-list">
      <li v-for="establishment in store.filterOptions" :key="establishment.id">
        <RouterLink
          :to="{ name: 'establishment-edit', params: { id: establishment.id } }"
          class="flex items-center gap-3 px-4 py-3 hover:bg-canvas"
          :data-test="`establishment-${establishment.id}`"
        >
          <span class="w-12 shrink-0 font-mono text-sm text-ink-muted">{{ establishment.code }}</span>
          <span class="min-w-0 flex-1">
            <span class="flex flex-wrap items-center gap-2 font-medium">
              <span class="truncate">{{ establishment.name }}</span>
              <BaseBadge v-if="establishment.is_main" variant="info">Principal</BaseBadge>
              <BaseBadge v-if="!establishment.active" variant="neutral">Inactivo</BaseBadge>
            </span>
            <span class="block truncate text-sm text-ink-muted">{{ establishment.address }}</span>
          </span>
        </RouterLink>
      </li>
    </ul>
  </section>
</template>
