<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'

import { ApiError } from '@/core/api/errors'
import { useApiForm } from '@/shared/composables/useApiForm'
import BaseAlert from '@/shared/ui/BaseAlert.vue'
import BaseBadge from '@/shared/ui/BaseBadge.vue'
import BaseButton from '@/shared/ui/BaseButton.vue'
import BaseDialog from '@/shared/ui/BaseDialog.vue'
import BaseInput from '@/shared/ui/BaseInput.vue'
import FormField from '@/shared/ui/FormField.vue'
import { formatDateTime } from '@/shared/utils/format'
import { platformApi } from '../api'
import UbigeoPicker from '../components/UbigeoPicker.vue'
import { sunatVariant, taxRegimeLabels, type LegalDataForm, type PlatformCompanyDetail } from '../types'

/** Ficha de la empresa (HU-1.3) con corrección, suspensión e invitación (HU-2.3, HU-3, HU-4). */
const route = useRoute()
const company = ref<PlatformCompanyDetail | null>(null)
const loadError = ref<string | null>(null)
const notice = ref<string | null>(route.query.nueva === '1' ? 'Empresa registrada. Su administrador recibió la invitación por correo.' : null)
const actionError = ref<string | null>(null)
const busy = ref(false)

const editOpen = ref(false)
const form = ref<LegalDataForm>({ ruc: '', razon_social: '', nombre_comercial: null, tax_regime: 'rmt', fiscal_address: { address: '', ubigeo: '' } })
const editForm = useApiForm()
const rucChanged = computed(() => company.value !== null && form.value.ruc !== company.value.ruc)

const suspendOpen = ref(false)
const reason = ref('')
const suspendForm = useApiForm()

const selectClass = 'block min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-base sm:text-sm'
const invitationLabels = { accepted: 'Aceptada', pending: 'Pendiente', expired: 'Vencida', none: 'Sin invitación' } as const

async function load() {
  try {
    company.value = await platformApi.company(Number(route.params.id))
  } catch (e) {
    loadError.value = e instanceof ApiError ? e.message : 'No se pudo cargar la empresa.'
  }
}

function openEdit() {
  const c = company.value!
  form.value = {
    ruc: c.ruc, razon_social: c.razon_social, nombre_comercial: c.nombre_comercial, tax_regime: c.tax_regime,
    fiscal_address: { address: c.fiscal_address?.address ?? '', ubigeo: c.fiscal_address?.ubigeo ?? '' },
  }
  editOpen.value = true
}

async function saveEdit() {
  const changedRuc = rucChanged.value
  const ok = await editForm.submit(async () => {
    company.value = await platformApi.update(company.value!.id, form.value)
  })
  if (ok) {
    editOpen.value = false
    notice.value = changedRuc
      ? 'Datos corregidos. Como cambió el RUC, la empresa debe subir un certificado del nuevo RUC y volver a validar SUNAT.'
      : 'Datos corregidos.'
  }
}

async function suspend() {
  const ok = await suspendForm.submit(async () => {
    company.value = await platformApi.deactivate(company.value!.id, reason.value)
  })
  if (ok) {
    suspendOpen.value = false
    reason.value = ''
    notice.value = 'Empresa suspendida: sus usuarios perdieron el acceso. Sus datos se conservan.'
  }
}

async function run(action: () => Promise<PlatformCompanyDetail>, success: string) {
  busy.value = true
  actionError.value = null
  notice.value = null
  try {
    company.value = await action()
    notice.value = success
  } catch (e) {
    if (!(e instanceof ApiError)) throw e
    actionError.value = Object.values(e.fieldErrors)[0]?.[0] ?? e.message
  } finally {
    busy.value = false
  }
}

onMounted(load)
</script>

<template>
  <RouterLink :to="{ name: 'platform-companies' }" class="inline-flex min-h-11 items-center text-sm text-brand-700">← Empresas</RouterLink>

  <BaseAlert v-if="loadError" variant="error" class="mt-2">{{ loadError }}</BaseAlert>

  <template v-else-if="company">
    <div class="mt-2 flex flex-wrap items-center gap-3">
      <h1 class="text-xl font-semibold">{{ company.razon_social }}</h1>
      <BaseBadge :variant="company.active ? 'success' : 'danger'" data-test="active">{{ company.active ? 'Activa' : 'Suspendida' }}</BaseBadge>
    </div>

    <BaseAlert v-if="notice" variant="success" class="mt-4" data-test="notice">{{ notice }}</BaseAlert>
    <BaseAlert v-if="actionError" variant="error" class="mt-4">{{ actionError }}</BaseAlert>

    <div class="mt-4 grid gap-4 lg:grid-cols-2">
      <section class="rounded-xl border border-line bg-surface p-5 text-sm" aria-labelledby="legal-title">
        <div class="flex items-center justify-between gap-2">
          <h2 id="legal-title" class="font-semibold">Datos legales</h2>
          <BaseButton variant="secondary" @click="openEdit">Corregir</BaseButton>
        </div>
        <dl class="mt-3 space-y-2" data-test="legal">
          <div><dt class="text-ink-muted">RUC</dt><dd>{{ company.ruc }}</dd></div>
          <div v-if="company.nombre_comercial"><dt class="text-ink-muted">Nombre comercial</dt><dd>{{ company.nombre_comercial }}</dd></div>
          <div><dt class="text-ink-muted">Régimen</dt><dd>{{ company.tax_regime_label }}</dd></div>
          <div v-if="company.fiscal_address">
            <dt class="text-ink-muted">Domicilio fiscal</dt>
            <dd>{{ company.fiscal_address.address }}<br />{{ company.fiscal_address.district }}</dd>
          </div>
          <div><dt class="text-ink-muted">Contacto</dt><dd>{{ company.email }}<template v-if="company.phone"> · {{ company.phone }}</template></dd></div>
        </dl>
      </section>

      <div class="space-y-4">
        <section class="rounded-xl border border-line bg-surface p-5 text-sm" aria-labelledby="status-title">
          <h2 id="status-title" class="font-semibold">Estado</h2>
          <dl class="mt-3 space-y-2" data-test="status">
            <div class="flex items-center justify-between gap-2">
              <dt class="text-ink-muted">Emisión SUNAT</dt>
              <dd><BaseBadge :variant="sunatVariant[company.sunat_status]">{{ company.sunat_status_label }}</BaseBadge></dd>
            </div>
            <p v-if="company.sunat_reason" class="text-xs text-ink-muted">{{ company.sunat_reason }}</p>
            <div class="flex justify-between gap-2"><dt class="text-ink-muted">Comprobantes pendientes</dt><dd>{{ company.pending_documents }}</dd></div>
            <div class="flex justify-between gap-2"><dt class="text-ink-muted">Comprobantes rechazados</dt><dd>{{ company.rejected_documents }}</dd></div>
            <div class="flex justify-between gap-2"><dt class="text-ink-muted">Usuarios activos</dt><dd>{{ company.active_users }} de {{ company.users_count }}</dd></div>
            <div class="flex justify-between gap-2"><dt class="text-ink-muted">Última actividad</dt><dd>{{ company.last_activity_at ? formatDateTime(company.last_activity_at) : 'Sin ventas aún' }}</dd></div>
          </dl>
          <RouterLink
            v-if="company.pending_documents || company.rejected_documents"
            :to="{ name: 'platform-support', query: { empresa: company.id } }"
            class="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-brand-700"
          >
            Ver en soporte
          </RouterLink>
        </section>

        <section class="rounded-xl border border-line bg-surface p-5 text-sm" aria-labelledby="admin-title">
          <h2 id="admin-title" class="font-semibold">Administrador de la empresa</h2>
          <p class="mt-2" data-test="admin">
            {{ company.admin.name ?? 'Aún sin cuenta' }}<br />
            <span class="text-ink-muted">{{ company.admin.email ?? '—' }}</span>
          </p>
          <p class="mt-1">Invitación: <BaseBadge :variant="company.admin.invitation === 'accepted' ? 'success' : 'warning'">{{ invitationLabels[company.admin.invitation] }}</BaseBadge></p>
          <BaseButton
            v-if="company.admin.invitation === 'pending' || company.admin.invitation === 'expired'"
            variant="secondary"
            class="mt-3"
            :loading="busy"
            @click="run(() => platformApi.resendAdminInvitation(company!.id), 'Invitación reenviada. El enlace anterior ya no sirve.')"
          >
            Reenviar invitación
          </BaseButton>
        </section>

        <section class="rounded-xl border border-line bg-surface p-5 text-sm" aria-labelledby="service-title">
          <h2 id="service-title" class="font-semibold">Servicio</h2>
          <BaseButton v-if="company.active" variant="danger" class="mt-3" @click="suspendOpen = true">Suspender empresa</BaseButton>
          <BaseButton
            v-else
            class="mt-3"
            :loading="busy"
            @click="run(() => platformApi.activate(company!.id), 'Empresa reactivada: sus usuarios pueden volver a entrar.')"
          >
            Reactivar empresa
          </BaseButton>
        </section>
      </div>
    </div>

    <BaseDialog v-model:open="editOpen" title="Corregir datos legales">
      <form id="legal-form" class="space-y-4" novalidate @submit.prevent="saveEdit">
        <BaseAlert v-if="editForm.generalError.value" variant="error">{{ editForm.generalError.value }}</BaseAlert>
        <FormField v-slot="{ describedBy, invalid }" label="RUC" for="edit-ruc" :error="editForm.fieldError('ruc')">
          <BaseInput id="edit-ruc" v-model="form.ruc" inputmode="numeric" maxlength="11" :invalid="invalid" :aria-describedby="describedBy" />
        </FormField>
        <BaseAlert v-if="rucChanged" variant="warning" data-test="ruc-warning">
          Al cambiar el RUC, la configuración SUNAT de la empresa vuelve a «pendiente» y tendrá que subir un certificado del nuevo RUC.
          Los comprobantes ya emitidos conservan el RUC anterior.
        </BaseAlert>
        <FormField v-slot="{ describedBy, invalid }" label="Razón social" for="edit-razon" :error="editForm.fieldError('razon_social')">
          <BaseInput id="edit-razon" v-model="form.razon_social" :invalid="invalid" :aria-describedby="describedBy" />
        </FormField>
        <FormField v-slot="{ describedBy, invalid }" label="Nombre comercial" for="edit-comercial" :error="editForm.fieldError('nombre_comercial')">
          <BaseInput id="edit-comercial" v-model="form.nombre_comercial" :invalid="invalid" :aria-describedby="describedBy" />
        </FormField>
        <FormField label="Régimen tributario" for="edit-regime" :error="editForm.fieldError('tax_regime')">
          <select id="edit-regime" v-model="form.tax_regime" :class="selectClass">
            <option v-for="(label, value) in taxRegimeLabels" :key="value" :value="value">{{ label }}</option>
          </select>
        </FormField>
        <FormField v-slot="{ describedBy, invalid }" label="Domicilio fiscal" for="edit-address" :error="editForm.fieldError('fiscal_address.address')">
          <BaseInput id="edit-address" v-model="form.fiscal_address.address" :invalid="invalid" :aria-describedby="describedBy" />
        </FormField>
        <FormField v-slot="{ describedBy, invalid }" label="Distrito (ubigeo)" for="edit-ubigeo" :error="editForm.fieldError('fiscal_address.ubigeo')">
          <UbigeoPicker id="edit-ubigeo" v-model="form.fiscal_address.ubigeo" :label="company.fiscal_address?.district" :invalid="invalid" :described-by="describedBy" />
        </FormField>
      </form>
      <template #actions>
        <BaseButton variant="secondary" @click="editOpen = false">Cancelar</BaseButton>
        <BaseButton type="submit" form="legal-form" :loading="editForm.submitting.value">Guardar</BaseButton>
      </template>
    </BaseDialog>

    <BaseDialog v-model:open="suspendOpen" title="Suspender empresa">
      <form id="suspend-form" class="space-y-4" novalidate @submit.prevent="suspend">
        <p class="text-sm">Sus usuarios perderán el acceso de inmediato. Los datos se conservan y los comprobantes pendientes se siguen enviando a SUNAT.</p>
        <FormField v-slot="{ describedBy, invalid }" label="Motivo" for="suspend-reason" :error="suspendForm.fieldError('reason')">
          <BaseInput id="suspend-reason" v-model="reason" :invalid="invalid" :aria-describedby="describedBy" />
        </FormField>
      </form>
      <template #actions>
        <BaseButton variant="secondary" @click="suspendOpen = false">Cancelar</BaseButton>
        <BaseButton type="submit" form="suspend-form" variant="danger" :loading="suspendForm.submitting.value">Suspender</BaseButton>
      </template>
    </BaseDialog>
  </template>
</template>
