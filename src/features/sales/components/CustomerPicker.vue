<script setup lang="ts">
import { useDebounceFn } from '@vueuse/core'
import { computed, ref, watch } from 'vue'

import { useApiForm } from '@/shared/composables/useApiForm'
import BaseAlert from '@/shared/ui/BaseAlert.vue'
import BaseButton from '@/shared/ui/BaseButton.vue'
import BaseDialog from '@/shared/ui/BaseDialog.vue'
import BaseInput from '@/shared/ui/BaseInput.vue'
import BaseSelect from '@/shared/ui/BaseSelect.vue'
import FormField from '@/shared/ui/FormField.vue'
import PilotNotice from '@/shared/ui/PilotNotice.vue'
import SearchInput from '@/shared/ui/SearchInput.vue'
import { documentKind } from '@/shared/utils/documents'
import { customersApi } from '../api'
import { useDocumentLookup } from '../composables/useDocumentLookup'
import type { Customer, CustomerDocumentType, CustomerForm, LookupResult } from '../types'
import CustomerVerifiedBadge from './CustomerVerifiedBadge.vue'
import RucStatusAlert from './RucStatusAlert.vue'

/**
 * Buscar o registrar al cliente sin salir de «Vender» (HU-5, A-34). Con
 * `requireRuc` (factura) solo se pueden elegir clientes con RUC.
 *
 * Un DNI o RUC completo se consulta (spec 018): en la empresa, en la tabla
 * común o en RENIEC/SUNAT, y el cliente queda elegido solo (CE-001). Si no
 * aparece, se dice por qué y se registra a mano sin perder la venta (RF-010).
 * Un texto busca por nombre, como siempre.
 */
const props = withDefaults(defineProps<{ requireRuc?: boolean }>(), { requireRuc: false })
const customer = defineModel<Customer | null>({ default: null })

const search = ref('')
const results = ref<Customer[]>([])
const dialogOpen = ref(false)
const emptyForm = (): CustomerForm => ({ document_type: props.requireRuc ? '6' : '1', document_number: '', name: '', address: null })
const form = ref<CustomerForm>(emptyForm())
const { submitting, generalError, fieldError, submit } = useApiForm()

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
  // Un DNI o RUC completo lo resuelve la consulta, no la búsqueda por nombre.
  results.value = term && !documentKind(term) ? await customersApi.search(term).catch(() => []) : []
}, 250)

const { state: lookup } = useDocumentLookup(search, { lookup: customersApi.lookup, requireRuc: () => props.requireRuc })

/** Por qué no se encontró o no se verificó, dicho para quien atiende. */
function reasonText(reason: NonNullable<LookupResult['reason']>, kind: 'dni' | 'ruc'): string {
  const where = kind === 'dni' ? 'ese DNI en RENIEC' : 'ese RUC en SUNAT'
  return {
    not_found: `No encontramos ${where}.`,
    unavailable: 'El servicio de consulta no responde.',
    quota: 'Se acabaron las consultas automáticas de hoy.',
    disabled: 'La consulta automática no está disponible.',
  }[reason]
}

/** El cliente elegido es manual y no se pudo verificar: el motivo queda a la vista. */
const unverifiedNote = ref<string | null>(null)

watch(lookup, (state) => {
  if (state.status !== 'found') return
  const kind = state.customer.document_type === '6' ? 'ruc' : 'dni'
  choose(state.customer)
  unverifiedNote.value = state.reason ? `${reasonText(state.reason, kind)} Se usa el cliente registrado a mano.` : null
})

function selectable(c: Customer): boolean {
  return !props.requireRuc || c.document_type === '6'
}

function choose(c: Customer) {
  unverifiedNote.value = null
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
    <div v-if="customer" class="space-y-2 rounded-lg border border-line bg-surface px-3 py-2" data-test="selected-customer">
      <div class="flex items-center justify-between gap-3">
        <p class="min-w-0 text-sm">
          <span class="flex flex-wrap items-center gap-2">
            <span class="min-w-0 truncate font-medium">{{ customer.name }}</span>
            <CustomerVerifiedBadge :customer="customer" />
          </span>
          <span class="block text-xs text-ink-muted">{{ customer.document_type_label }} {{ customer.document_number }}</span>
          <span v-if="customer.address" class="block truncate text-xs text-ink-muted" data-test="selected-address">{{ customer.address }}</span>
        </p>
        <button type="button" class="min-h-11 shrink-0 text-sm font-medium text-brand-700" @click="customer = null">Cambiar</button>
      </div>
      <p v-if="unverifiedNote" class="text-xs text-ink-muted" data-test="unverified-note">{{ unverifiedNote }}</p>
      <RucStatusAlert :customer="customer" />
    </div>

    <template v-else>
      <label for="customer-search" class="sr-only">Buscar cliente</label>
      <SearchInput
        id="customer-search"
        v-model="search"
        :placeholder="requireRuc ? 'Buscar cliente por RUC o razón social' : 'Buscar cliente por documento o nombre'"
        autocomplete="off"
        @input="runSearch"
        @clear="runSearch"
      />
      <!-- La consulta y su resultado se anuncian sin mover el foco. -->
      <div aria-live="polite" data-test="lookup-status">
        <p v-if="lookup.status === 'searching'" class="mt-2 text-sm text-ink-muted">
          Buscando en {{ lookup.kind === 'dni' ? 'RENIEC' : 'SUNAT' }}…
        </p>
        <p v-else-if="lookup.status === 'invalid'" class="mt-2 text-sm text-danger-700">{{ lookup.message }}</p>
        <div v-else-if="lookup.status === 'missing' || lookup.status === 'offline'" class="mt-2 rounded-lg bg-subtle p-3 text-sm">
          <p>
            <template v-if="lookup.status === 'offline'">Sin conexión: la consulta del DNI o RUC necesita internet.</template>
            <template v-else>{{ reasonText(lookup.reason, lookup.kind) }}</template>
            Puedes registrarlo a mano.
          </p>
          <BaseButton variant="secondary" class="mt-2" data-test="register-manually" @click="openDialog">Registrar a mano</BaseButton>
        </div>
      </div>
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
        <PilotNotice compact />
        <BaseAlert v-if="generalError" variant="error">{{ generalError }}</BaseAlert>
        <FormField label="Tipo de documento" for="new-customer-type" :error="fieldError('document_type')">
          <BaseSelect id="new-customer-type" v-model="form.document_type">
            <option v-for="o in documentOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
          </BaseSelect>
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
