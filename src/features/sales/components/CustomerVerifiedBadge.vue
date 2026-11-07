<script setup lang="ts">
import BaseBadge from '@/shared/ui/BaseBadge.vue'
import { formatDate } from '@/shared/utils/format'
import type { Customer } from '../types'

/** «Verificado» (traído de RENIEC o SUNAT, con la fecha) o «Manual» (spec 018, HU-2 esc. 4). */
defineProps<{ customer: Pick<Customer, 'verified' | 'verified_at'> }>()
</script>

<template>
  <BaseBadge
    v-if="customer.verified"
    variant="success"
    :title="customer.verified_at ? `Consultado el ${formatDate(customer.verified_at)}` : undefined"
    data-test="customer-verified"
  >
    Verificado<span v-if="customer.verified_at" class="sr-only">, consultado el {{ formatDate(customer.verified_at) }}</span>
  </BaseBadge>
  <BaseBadge v-else variant="neutral" data-test="customer-manual">Manual</BaseBadge>
</template>
