<script setup lang="ts">
import { useDebounceFn } from '@vueuse/core'
import { onMounted, ref } from 'vue'

import { ApiError } from '@/core/api/errors'
import type { PaginationMeta } from '@/core/api/types'
import { useApiForm } from '@/shared/composables/useApiForm'
import BaseAlert from '@/shared/ui/BaseAlert.vue'
import BaseButton from '@/shared/ui/BaseButton.vue'
import BaseDialog from '@/shared/ui/BaseDialog.vue'
import BaseInput from '@/shared/ui/BaseInput.vue'
import BaseSelect from '@/shared/ui/BaseSelect.vue'
import EmptyState from '@/shared/ui/EmptyState.vue'
import ExportButton from '@/shared/ui/ExportButton.vue'
import FormField from '@/shared/ui/FormField.vue'
import SearchInput from '@/shared/ui/SearchInput.vue'
import { customersApi } from '../api'
import type { Customer, CustomerForm } from '../types'

/**
 * Clientes de la empresa para el administrador (A-34): buscar y editar.
 * Se registran al vender y no se borran; los comprobantes ya emitidos
 * conservan los datos del momento (RF-006).
 */
const search = ref('')
const customers = ref<Customer[]>([])
const meta = ref<PaginationMeta | null>(null)
const page = ref(1)
const loadError = ref<string | null>(null)
const notice = ref<string | null>(null)

const editing = ref<Customer | null>(null)
const dialogOpen = ref(false)
const form = ref<CustomerForm>({ document_type: '1', document_number: '', name: '', address: null })
const { submitting, generalError, fieldError, submit } = useApiForm()

async function load() {
  try {
    const result = await customersApi.list(search.value.trim(), page.value)
    customers.value = result.data
    meta.value = result.meta
  } catch (e) {
    loadError.value = e instanceof ApiError ? e.message : 'No se pudieron cargar los clientes.'
  }
}

const onSearch = useDebounceFn(() => {
  page.value = 1
  load()
}, 250)

function edit(customer: Customer) {
  editing.value = customer
  form.value = { document_type: customer.document_type, document_number: customer.document_number, name: customer.name, address: customer.address }
  notice.value = null
  dialogOpen.value = true
}

async function save() {
  if (!editing.value) return
  const ok = await submit(() => customersApi.update(editing.value!.id, form.value))
  if (ok) {
    dialogOpen.value = false
    notice.value = 'Cliente actualizado. Los comprobantes ya emitidos conservan los datos anteriores.'
    await load()
  }
}

function goTo(next: number) {
  page.value = next
  load()
}

onMounted(load)
</script>

<template>
  <div class="flex flex-wrap items-center justify-between gap-3">
    <h1 class="text-xl font-semibold">Clientes</h1>
    <ExportButton title="Exportar clientes" :download="(format) => customersApi.export(search.trim(), format)" />
  </div>
  <p class="mt-1 text-sm text-ink-muted">Se registran al emitir boletas y facturas. Aquí puedes corregir sus datos.</p>

  <div class="mt-4">
    <label for="customers-search" class="sr-only">Buscar cliente</label>
    <SearchInput id="customers-search" v-model="search" placeholder="Buscar por documento o nombre" autocomplete="off" @input="onSearch" @clear="onSearch" />
  </div>

  <BaseAlert v-if="loadError" variant="error" class="mt-4">{{ loadError }}</BaseAlert>
  <BaseAlert v-if="notice" variant="success" class="mt-4">{{ notice }}</BaseAlert>

  <EmptyState v-if="!loadError && customers.length === 0" class="mt-4" title="No hay clientes" description="Aparecerán al registrarlos desde «Vender»." />

  <ul v-else class="mt-4 divide-y divide-line rounded-xl border border-line bg-surface">
    <li v-for="c in customers" :key="c.id" class="flex items-center justify-between gap-3 p-4" data-test="customer-row">
      <p class="min-w-0 text-sm">
        <span class="block truncate font-medium">{{ c.name }}</span>
        <span class="text-ink-muted">{{ c.document_type_label }} {{ c.document_number }}<template v-if="c.address"> · {{ c.address }}</template></span>
      </p>
      <BaseButton variant="secondary" @click="edit(c)">Editar</BaseButton>
    </li>
  </ul>

  <nav v-if="meta && meta.last_page > 1" class="mt-4 flex items-center justify-between" aria-label="Paginación">
    <BaseButton variant="secondary" :disabled="meta.current_page <= 1" @click="goTo(meta.current_page - 1)">Anterior</BaseButton>
    <span class="text-sm text-ink-muted">Página {{ meta.current_page }} de {{ meta.last_page }}</span>
    <BaseButton variant="secondary" :disabled="meta.current_page >= meta.last_page" @click="goTo(meta.current_page + 1)">Siguiente</BaseButton>
  </nav>

  <BaseDialog v-model:open="dialogOpen" title="Editar cliente">
    <form id="edit-customer-form" class="space-y-4" novalidate @submit.prevent="save">
      <BaseAlert v-if="generalError" variant="error">{{ generalError }}</BaseAlert>
      <FormField label="Tipo de documento" for="edit-customer-type" :error="fieldError('document_type')">
        <BaseSelect id="edit-customer-type" v-model="form.document_type">
          <option value="1">DNI</option>
          <option value="6">RUC</option>
          <option value="4">Carné de extranjería</option>
        </BaseSelect>
      </FormField>
      <FormField v-slot="{ describedBy, invalid }" label="Número de documento" for="edit-customer-number" :error="fieldError('document_number')">
        <BaseInput id="edit-customer-number" v-model="form.document_number" :invalid="invalid" :aria-describedby="describedBy" />
      </FormField>
      <FormField v-slot="{ describedBy, invalid }" label="Nombre o razón social" for="edit-customer-name" :error="fieldError('name')">
        <BaseInput id="edit-customer-name" v-model="form.name" :invalid="invalid" :aria-describedby="describedBy" />
      </FormField>
      <FormField v-slot="{ describedBy, invalid }" label="Dirección (opcional)" for="edit-customer-address" :error="fieldError('address')">
        <BaseInput id="edit-customer-address" v-model="form.address" :invalid="invalid" :aria-describedby="describedBy" />
      </FormField>
    </form>
    <template #actions>
      <BaseButton variant="secondary" @click="dialogOpen = false">Cancelar</BaseButton>
      <BaseButton type="submit" form="edit-customer-form" :loading="submitting">Guardar</BaseButton>
    </template>
  </BaseDialog>
</template>
