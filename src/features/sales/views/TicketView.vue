<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { ApiError } from '@/core/api/errors'
import { useSessionStore } from '@/core/auth/session-store'
import { useApiForm } from '@/shared/composables/useApiForm'
import BaseAlert from '@/shared/ui/BaseAlert.vue'
import BaseButton from '@/shared/ui/BaseButton.vue'
import BaseDialog from '@/shared/ui/BaseDialog.vue'
import BaseInput from '@/shared/ui/BaseInput.vue'
import FormField from '@/shared/ui/FormField.vue'
import { salesApi } from '../api'
import TicketReceipt from '../components/TicketReceipt.vue'
import type { Ticket } from '../types'

const route = useRoute()
const session = useSessionStore()
const ticketId = Number(route.params.id)

const ticket = ref<Ticket | null>(null)
const loadError = ref<string | null>(null)
const notice = ref<string | null>(route.query.nueva ? 'Venta registrada.' : null)
const voidOpen = ref(false)
const reason = ref('')
const { submitting, generalError, fieldError, reset, submit } = useApiForm()

const companyName = computed(() => session.session?.company?.nombre_comercial ?? session.session?.company?.razon_social ?? '')
const companyRuc = computed(() => session.session?.company?.ruc ?? '')

onMounted(async () => {
  try {
    ticket.value = await salesApi.get(ticketId)
  } catch (e) {
    loadError.value = e instanceof ApiError ? e.message : 'No se pudo cargar el ticket.'
  }
})

watch(voidOpen, (isOpen) => {
  if (isOpen) {
    reason.value = ''
    reset()
  }
})

function print() {
  window.print()
}

async function confirmVoid() {
  if (await submit(async () => (ticket.value = await salesApi.void(ticketId, reason.value)))) {
    voidOpen.value = false
    notice.value = 'Ticket anulado. El stock se devolvió.'
  }
}
</script>

<template>
  <BaseAlert v-if="loadError" variant="error">{{ loadError }}</BaseAlert>

  <template v-else-if="ticket">
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-xl font-semibold">Ticket {{ ticket.display_number }}</h1>
      <div class="flex gap-2">
        <BaseButton variant="secondary" @click="print">Imprimir</BaseButton>
        <BaseButton v-if="session.isCompanyAdmin && ticket.status === 'issued'" variant="danger" @click="voidOpen = true">Anular</BaseButton>
      </div>
    </div>

    <BaseAlert v-if="notice" variant="success" class="mb-4">{{ notice }}</BaseAlert>

    <TicketReceipt :ticket="ticket" :company-name="companyName" :company-ruc="companyRuc" />

    <p class="mt-4 text-center">
      <RouterLink :to="{ name: 'new-sale' }" class="text-sm font-medium text-brand-700">Nueva venta</RouterLink>
    </p>

    <BaseDialog v-model:open="voidOpen" title="Anular ticket">
      <form id="void-form" class="space-y-4" novalidate @submit.prevent="confirmVoid">
        <p class="text-sm text-ink-muted">El ticket conserva su número y el stock vendido vuelve al inventario.</p>
        <BaseAlert v-if="generalError || fieldError('ticket')" variant="error">{{ fieldError('ticket') ?? generalError }}</BaseAlert>
        <FormField v-slot="{ describedBy, invalid }" label="Motivo" for="void-reason" :error="fieldError('reason')">
          <BaseInput id="void-reason" v-model="reason" :invalid="invalid" :aria-describedby="describedBy" />
        </FormField>
      </form>
      <template #actions>
        <BaseButton variant="secondary" @click="voidOpen = false">Cancelar</BaseButton>
        <BaseButton type="submit" form="void-form" variant="danger" :loading="submitting">Anular ticket</BaseButton>
      </template>
    </BaseDialog>
  </template>
</template>
