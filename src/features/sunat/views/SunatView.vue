<script setup lang="ts">
import { onMounted, ref } from 'vue'

import { ApiError } from '@/core/api/errors'
import { useApiForm } from '@/shared/composables/useApiForm'
import { formatDate, formatDateTime } from '@/shared/utils/format'
import BaseAlert from '@/shared/ui/BaseAlert.vue'
import BaseBadge from '@/shared/ui/BaseBadge.vue'
import BaseButton from '@/shared/ui/BaseButton.vue'
import BaseInput from '@/shared/ui/BaseInput.vue'
import EnvironmentBadge from '@/shared/ui/EnvironmentBadge.vue'
import FormField from '@/shared/ui/FormField.vue'
import { sunatApi } from '../api'
import { CERTIFICATE_WARNING_DAYS, statusVariant, type SunatSettings, type SunatStatusInfo } from '../types'

/**
 * Configuración SUNAT del administrador (HU-1, HU-2). Los secretos solo
 * viajan hacia la API: la clave SOL y la contraseña del certificado nunca
 * se muestran ni se vuelven a cargar en el formulario.
 */
const settings = ref<SunatSettings | null>(null)
const status = ref<SunatStatusInfo | null>(null)
const loadError = ref<string | null>(null)
const notice = ref<string | null>(null)

const credentials = ref({ sol_user: '', sol_password: '' })
const credentialsForm = useApiForm()

const certificateFile = ref<File | null>(null)
const certificatePassword = ref('')
const fileInputKey = ref(0)
const certificateForm = useApiForm()

const validateForm = useApiForm()

async function load() {
  ;[settings.value, status.value] = await Promise.all([sunatApi.settings(), sunatApi.status()])
}

onMounted(async () => {
  try {
    await load()
  } catch (e) {
    loadError.value = e instanceof ApiError ? e.message : 'No se pudo cargar la configuración de SUNAT.'
  }
})

async function saveCredentials() {
  notice.value = null
  const ok = await credentialsForm.submit(async () => {
    settings.value = await sunatApi.updateCredentials(credentials.value)
    status.value = await sunatApi.status()
  })
  if (ok) {
    credentials.value = { sol_user: '', sol_password: '' }
    notice.value = 'Credenciales SOL guardadas. Valida la configuración para poder emitir.'
  }
}

function onCertificateSelected(event: Event) {
  certificateFile.value = (event.target as HTMLInputElement).files?.[0] ?? null
}

async function uploadCertificate() {
  if (!certificateFile.value) return
  notice.value = null
  const ok = await certificateForm.submit(async () => {
    settings.value = await sunatApi.uploadCertificate(certificateFile.value!, certificatePassword.value)
    status.value = await sunatApi.status()
  })
  if (ok) {
    certificateFile.value = null
    certificatePassword.value = ''
    fileInputKey.value++
    notice.value = 'Certificado guardado. Valida la configuración para poder emitir.'
  }
}

async function validate() {
  notice.value = null
  const ok = await validateForm.submit(async () => {
    settings.value = await sunatApi.validate()
    status.value = await sunatApi.status()
  })
  if (ok && settings.value?.status === 'validated') notice.value = 'Configuración validada: ya puedes emitir en pruebas.'
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-3">
    <h1 class="text-xl font-semibold">SUNAT</h1>
    <EnvironmentBadge :environment="settings?.environment" />
  </div>

  <BaseAlert v-if="loadError" variant="error" class="mt-4">{{ loadError }}</BaseAlert>

  <div v-else-if="settings && status" class="mt-4 space-y-6">
    <BaseAlert v-if="notice" variant="success">{{ notice }}</BaseAlert>

    <section class="rounded-xl border border-line bg-surface p-5" aria-labelledby="status-title" data-test="status">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h2 id="status-title" class="font-semibold">Estado de la emisión</h2>
        <BaseBadge :variant="statusVariant[settings.status]">{{ settings.status_label }}</BaseBadge>
      </div>
      <p class="mt-1 text-sm text-ink-muted">Ambiente: {{ settings.environment_label }}</p>

      <p v-if="settings.last_validation_error" class="mt-3 text-sm text-danger-700" data-test="status-reason">
        {{ settings.last_validation_error }}
      </p>
      <ul v-if="status.missing.length" class="mt-3 list-disc space-y-1 pl-5 text-sm" data-test="missing">
        <li v-for="item in status.missing" :key="item">{{ item }}</li>
      </ul>
      <p v-if="settings.last_validated_at" class="mt-3 text-xs text-ink-muted">
        Última validación: {{ formatDateTime(settings.last_validated_at) }}
      </p>

      <BaseAlert v-if="validateForm.generalError.value" variant="error" class="mt-3">
        {{ validateForm.generalError.value }}
      </BaseAlert>
      <ul
        v-if="validateForm.fieldErrors.value.configuration"
        class="mt-3 list-disc space-y-1 pl-5 text-sm text-danger-700"
        role="alert"
        data-test="validate-errors"
      >
        <li v-for="item in validateForm.fieldErrors.value.configuration" :key="item">{{ item }}</li>
      </ul>

      <BaseButton class="mt-4" :loading="validateForm.submitting.value" @click="validate">Validar</BaseButton>
    </section>

    <div class="grid gap-6 lg:grid-cols-2">
      <section class="rounded-xl border border-line bg-surface p-5" aria-labelledby="sol-title">
        <h2 id="sol-title" class="font-semibold">Credenciales SOL</h2>
        <p class="mt-1 text-sm" data-test="sol-summary">
          <template v-if="settings.has_sol_password">
            Usuario <span class="font-mono">{{ settings.sol_user_masked }}</span> · clave
            <BaseBadge variant="success">registrada</BaseBadge>
          </template>
          <span v-else class="text-ink-muted">Aún no registras tus credenciales SOL.</span>
        </p>
        <BaseAlert v-if="settings.has_sol_password && !settings.sol_verified" variant="warning" class="mt-3" data-test="sol-unverified">
          En pruebas SUNAT usa credenciales genéricas: tu clave SOL real queda guardada pero
          <strong>no verificada</strong> hasta que pases a producción.
        </BaseAlert>

        <form class="mt-4 space-y-4" novalidate autocomplete="off" @submit.prevent="saveCredentials">
          <BaseAlert v-if="credentialsForm.generalError.value" variant="error">{{ credentialsForm.generalError.value }}</BaseAlert>
          <FormField
            v-slot="{ describedBy, invalid }"
            label="Usuario SOL"
            for="sol_user"
            hint="El usuario secundario que creaste en SUNAT Operaciones en Línea."
            :error="credentialsForm.fieldError('sol_user')"
          >
            <BaseInput id="sol_user" v-model="credentials.sol_user" autocomplete="off" :invalid="invalid" :aria-describedby="describedBy" />
          </FormField>
          <FormField v-slot="{ describedBy, invalid }" label="Clave SOL" for="sol_password" :error="credentialsForm.fieldError('sol_password')">
            <BaseInput
              id="sol_password"
              v-model="credentials.sol_password"
              type="password"
              autocomplete="new-password"
              :invalid="invalid"
              :aria-describedby="describedBy"
            />
          </FormField>
          <BaseButton type="submit" variant="secondary" :loading="credentialsForm.submitting.value">
            {{ settings.has_sol_password ? 'Reemplazar credenciales' : 'Guardar credenciales' }}
          </BaseButton>
        </form>
      </section>

      <section class="rounded-xl border border-line bg-surface p-5" aria-labelledby="cert-title">
        <h2 id="cert-title" class="font-semibold">Certificado digital</h2>
        <dl v-if="settings.certificate" class="mt-3 space-y-2 text-sm" data-test="certificate">
          <div><dt class="text-ink-muted">Titular</dt><dd class="break-words">{{ settings.certificate.subject }}</dd></div>
          <div><dt class="text-ink-muted">RUC</dt><dd>{{ settings.certificate.ruc }}</dd></div>
          <div>
            <dt class="text-ink-muted">Vigencia</dt>
            <dd>
              {{ formatDate(settings.certificate.valid_from) }} al {{ formatDate(settings.certificate.valid_to) }}
              <BaseBadge v-if="settings.certificate.days_to_expire < 0" variant="danger">vencido</BaseBadge>
              <BaseBadge v-else-if="settings.certificate.days_to_expire <= CERTIFICATE_WARNING_DAYS" variant="warning">
                vence en {{ settings.certificate.days_to_expire }} días
              </BaseBadge>
            </dd>
          </div>
        </dl>
        <p v-else class="mt-1 text-sm text-ink-muted">Aún no subes un certificado.</p>

        <form class="mt-4 space-y-4" novalidate autocomplete="off" @submit.prevent="uploadCertificate">
          <BaseAlert v-if="certificateForm.generalError.value" variant="error">{{ certificateForm.generalError.value }}</BaseAlert>
          <FormField
            v-slot="{ describedBy, invalid }"
            label="Archivo del certificado"
            for="certificate"
            hint=".pfx, .p12 o .pem, hasta 1 MB."
            :error="certificateForm.fieldError('certificate')"
          >
            <input
              id="certificate"
              :key="fileInputKey"
              type="file"
              accept=".pfx,.p12,.pem"
              class="block w-full text-sm"
              :aria-invalid="invalid || undefined"
              :aria-describedby="describedBy"
              @change="onCertificateSelected"
            />
          </FormField>
          <FormField
            v-slot="{ describedBy, invalid }"
            label="Contraseña del certificado"
            for="certificate_password"
            :error="certificateForm.fieldError('password')"
          >
            <BaseInput
              id="certificate_password"
              v-model="certificatePassword"
              type="password"
              autocomplete="new-password"
              :invalid="invalid"
              :aria-describedby="describedBy"
            />
          </FormField>
          <BaseButton type="submit" variant="secondary" :disabled="!certificateFile" :loading="certificateForm.submitting.value">
            {{ settings.certificate ? 'Reemplazar certificado' : 'Subir certificado' }}
          </BaseButton>
        </form>
      </section>
    </div>

    <section v-if="settings.certificates_history.length > 1" class="rounded-xl border border-line bg-surface p-5" aria-labelledby="history-title">
      <h2 id="history-title" class="font-semibold">Historial de certificados</h2>
      <ul class="mt-3 divide-y divide-line text-sm" data-test="history">
        <li v-for="(item, i) in settings.certificates_history" :key="i" class="flex flex-wrap items-center justify-between gap-2 py-2">
          <span>
            Vence {{ formatDate(item.valid_to) }}
            <span v-if="item.uploaded_by" class="text-ink-muted">· subido por {{ item.uploaded_by }}</span>
          </span>
          <BaseBadge :variant="item.status === 'current' ? 'success' : 'neutral'">
            {{ item.status === 'current' ? 'Vigente' : `Reemplazado ${formatDate(item.replaced_at)}` }}
          </BaseBadge>
        </li>
      </ul>
    </section>
  </div>
</template>
