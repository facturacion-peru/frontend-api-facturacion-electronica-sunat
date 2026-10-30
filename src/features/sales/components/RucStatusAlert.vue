<script setup lang="ts">
import { computed } from 'vue'

import BaseAlert from '@/shared/ui/BaseAlert.vue'
import type { Customer } from '../types'

/**
 * Aviso de un RUC que SUNAT no da como activo y habido (spec 018, A-95 ⚖️).
 * Solo avisa: emitir sigue permitido.
 */
const props = defineProps<{ customer: Pick<Customer, 'document_type' | 'ruc_status' | 'ruc_condition'> }>()

const problems = computed(() => {
  const { document_type: type, ruc_status: status, ruc_condition: condition } = props.customer
  if (type !== '6') return []

  return [status && status !== 'ACTIVO' ? status : null, condition && condition !== 'HABIDO' ? condition : null].filter(
    (p): p is string => p !== null,
  )
})
</script>

<template>
  <BaseAlert v-if="problems.length" variant="warning" data-test="ruc-status-alert">
    Este RUC figura como {{ problems.join(' y ') }} en SUNAT. Puedes emitir, pero confírmalo con el cliente.
  </BaseAlert>
</template>
