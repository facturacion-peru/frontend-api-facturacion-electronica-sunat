<script setup lang="ts">
import { onMounted, ref } from 'vue'

import { useSessionStore } from '@/core/auth/session-store'
import BaseAlert from '@/shared/ui/BaseAlert.vue'
import BaseBadge from '@/shared/ui/BaseBadge.vue'
import EnvironmentBadge from '@/shared/ui/EnvironmentBadge.vue'
import { sunatApi } from '../api'
import { CERTIFICATE_WARNING_DAYS, statusVariant, type SunatStatusInfo } from '../types'

/**
 * «Emisión SUNAT» en el Inicio (HU-4): todos ven si se puede emitir y qué
 * falta; el administrador, además, el aviso de certificado por vencer.
 */
const session = useSessionStore()
const status = ref<SunatStatusInfo | null>(null)
const failed = ref(false)

onMounted(async () => {
  try {
    status.value = await sunatApi.status()
  } catch {
    failed.value = true
  }
})

function expiryText(days: number): string {
  if (days < 0) return 'El certificado digital está vencido. Sube uno vigente para seguir emitiendo.'
  if (days === 0) return 'El certificado digital vence hoy.'

  return `El certificado digital vence en ${days} ${days === 1 ? 'día' : 'días'}. Renuévalo a tiempo para no dejar de emitir.`
}
</script>

<template>
  <section class="rounded-xl border border-line bg-surface p-4" aria-labelledby="sunat-card-title" data-test="sunat-card">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h2 id="sunat-card-title" class="font-medium">Emisión SUNAT</h2>
      <div v-if="status" class="flex flex-wrap gap-2">
        <EnvironmentBadge :environment="status.environment" />
        <BaseBadge :variant="statusVariant[status.status]">{{ status.can_issue ? 'Disponible' : status.status_label }}</BaseBadge>
      </div>
    </div>

    <p v-if="failed" class="mt-2 text-sm text-ink-muted">No se pudo consultar el estado de la emisión.</p>
    <template v-else-if="status">
      <p v-if="status.can_issue" class="mt-2 text-sm text-ink-muted">La configuración está lista para emitir boletas y facturas de prueba.</p>
      <template v-else>
        <p v-if="status.reason" class="mt-2 text-sm text-danger-700">{{ status.reason }}</p>
        <ul v-if="status.missing.length" class="mt-2 list-disc space-y-1 pl-5 text-sm" data-test="sunat-missing">
          <li v-for="item in status.missing" :key="item">{{ item }}</li>
        </ul>
        <p v-if="!session.isCompanyAdmin" class="mt-2 text-sm text-ink-muted">Pide al administrador que complete la configuración.</p>
      </template>

      <BaseAlert
        v-if="session.isCompanyAdmin && status.certificate_days_to_expire !== null && status.certificate_days_to_expire <= CERTIFICATE_WARNING_DAYS"
        variant="warning"
        class="mt-3"
        data-test="certificate-warning"
      >
        {{ expiryText(status.certificate_days_to_expire) }}
      </BaseAlert>

      <RouterLink v-if="session.isCompanyAdmin" to="/sunat" class="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-brand-700">
        Ir a la configuración SUNAT
      </RouterLink>
    </template>
  </section>
</template>
