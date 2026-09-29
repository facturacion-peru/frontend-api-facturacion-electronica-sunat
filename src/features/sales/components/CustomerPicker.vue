<script setup lang="ts">
import { useDebounceFn } from '@vueuse/core'
import { computed, ref } from 'vue'

import { useApiForm } from '@/shared/composables/useApiForm'
import BaseAlert from '@/shared/ui/BaseAlert.vue'
import BaseButton from '@/shared/ui/BaseButton.vue'
import BaseDialog from '@/shared/ui/BaseDialog.vue'
import BaseInput from '@/shared/ui/BaseInput.vue'
import FormField from '@/shared/ui/FormField.vue'
import { customersApi } from '../api'
import type { Customer, CustomerDocumentType, CustomerForm } from '../types'

/**
 * Buscar o registrar al cliente sin salir de «Vender» (HU-5, A-34). Con
 * `requireRuc` (factura) solo se pueden elegir clientes con RUC.
 */
const props = withDefaults(defineProps<{ requireRuc?: boolean }>(), { requireRuc: false })
const customer = defineModel<Customer | null>({ default: null })

const search = ref('')
const results = ref<Customer[]>([])
const dialogOpen = ref(false)
const emptyForm = (): CustomerForm => ({ document_type: props.requireRuc ? '6' : '1', document_number: '', name: '', address: null })
const form = ref<CustomerForm>(emptyForm())
const { submitting, generalError, fieldError, submit } = useApiForm()

const selectClass = 'block min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-base sm:text-sm'
const documentOptions = computed<{ value: CustomerDocumentType; label: string }[]>(() =>
  props.requireRuc
    ? [{ value: '6', label: 'RUC' }]
    : [
        { value: '1', label: 'DNI' },
        { value: '6', label: 'RUC' },
        { value: '4', label: 'Carné de extranjería' },
      ],
)

const runSearch = useDebounceFn(async () => {
  const term = search.value.trim()
  results.value = term ? await customersApi.search(term).catch(() => []) : []
}, 250)

function selectable(c: Customer): boolean {
  return !props.requireRuc || c.document_type === '6'
}

function choose(c: Customer) {
  customer.value = c
  search.value = ''
  results.value = []
}

function openDialog() {
  form.value = emptyForm()
  // Si lo buscado parece un documento, se propone como número.
  if (/^\d{8}$|^\d{11}$/.test(search.value.trim())) {
    form.value.document_number = search.value.trim()
    form.value.document_type = search.value.trim().length === 11 ? '6' : form.value.document_type
  }
  dialogOpen.value = true
}

async function save() {
  const ok = await submit(async () => choose(await customersApi.create(form.value)))
  if (ok) dialogOpen.value = false
}
</script>

<template>
  <div data-test="customer-picker">
    <div v-if="customer" class="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface px-3 py-2" data-test="selected-customer">
      <p class="min-w-0 text-sm">
        <span class="block truncate font-medium">{{ customer.name }}</span>
        <span class="text-xs text-ink-muted">{{ customer.document_type_label }} {{ customer.document_number }}</span>
      </p>
      <button type="button" class="min-h-11 shrink-0 text-sm font-medium text-brand-700" @click="customer = null">Cambiar</button>
    </div>

    <template v-else>
      <label for="customer-search" class="sr-only">Buscar cliente</label>
      <BaseInput
        id="customer-search"
        v-model="search"
        type="search"
        :placeholder="requireRuc ? 'Buscar cliente por RUC o razón social' : 'Buscar cliente por documento o nombre'"
        autocomplete="off"
        @input="runSearch"
      />
      <ul v-if="results.length" class="mt-2 divide-y divide-line rounded-xl border border-line bg-surface" data-test="customer-results">
        <li v-for="c in results" :key="c.id">
          <button
            type="button"
            class="flex min-h-11 w-full flex-col px-4 py-2 text-left hover:bg-canvas disabled:opacity-50"
            :disabled="!selectable(c)"
            @click="choose(c)"
          >
            <span class="font-medium">{{ c.name }}</span>
            <span class="text-xs text-ink-muted">
              {{ c.document_type_label }} {{ c.document_number }}
              <template v-if="!selectable(c)"> · la factura requiere RUC</template>
            </span>
          </button>
        </li>
      </ul>
      <button type="button" class="mt-1 min-h-11 text-sm font-medium text-brand-700" @click="openDialog">+ Registrar cliente</button>
    </template>

    <BaseDialog v-model:open="dialogOpen" title="Nuevo cliente">
      <form id="customer-form" class="space-y-4" novalidate @submit.prevent="save">
        <BaseAlert v-if="generalError" variant="error">{{ generalError }}</BaseAlert>
        <FormField label="Tipo de documento" for="new-customer-type" :error="fieldError('document_type')">
          <select id="new-customer-type" v-model="form.document_type" :class="selectClass">
            <option v-for="o in documentOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
          </select>
        </FormField>
        <FormField v-slot="{ describedBy, invalid }" label="Número de documento" for="new-customer-number" :error="fieldError('document_number')">
          <BaseInput id="new-customer-number" v-model="form.document_number" inputmode="numeric" autocomplete="off" :invalid="invalid" :aria-describedby="describedBy" />
        </FormField>
        <FormField
          v-slot="{ describedBy, invalid }"
          :label="form.document_type === '6' ? 'Razón social' : 'Nombre completo'"
          for="new-customer-name"
          :error="fieldError('name')"
        >
          <BaseInput id="new-customer-name" v-model="form.name" autocomplete="off" :invalid="invalid" :aria-describedby="describedBy" />
        </FormField>
        <FormField v-slot="{ describedBy, invalid }" label="Dirección (opcional)" for="new-customer-address" :error="fieldError('address')">
          <BaseInput id="new-customer-address" v-model="form.address" autocomplete="off" :invalid="invalid" :aria-describedby="describedBy" />
        </FormField>
      </form>
      <template #actions>
        <BaseButton variant="secondary" @click="dialogOpen = false">Cancelar</BaseButton>
        <BaseButton type="submit" form="customer-form" :loading="submitting">Registrar</BaseButton>
      </template>
    </BaseDialog>
  </div>
</template>
