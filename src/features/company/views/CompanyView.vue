<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

import { ApiError } from '@/core/api/errors'
import { useApiForm } from '@/shared/composables/useApiForm'
import BaseAlert from '@/shared/ui/BaseAlert.vue'
import BaseButton from '@/shared/ui/BaseButton.vue'
import BaseInput from '@/shared/ui/BaseInput.vue'
import FormField from '@/shared/ui/FormField.vue'
import { companyApi } from '../api'
import { personTypeLabels, taxRegimeLabels, type CompanyContactForm, type CompanyDetail } from '../types'

const company = ref<CompanyDetail | null>(null)
const loadError = ref<string | null>(null)
const form = ref<CompanyContactForm>({ nombre_comercial: null, email: '', phone: null, expiry_warning_days: 30 })
const saved = ref(false)
const { submitting, generalError, fieldError, submit } = useApiForm()

const logoForm = useApiForm()
const logoPreview = ref<string | null>(null)
const logoFile = ref<File | null>(null)

function fill(data: CompanyDetail) {
  company.value = data
  form.value = {
    nombre_comercial: data.nombre_comercial,
    email: data.email,
    phone: data.phone,
    expiry_warning_days: data.expiry_warning_days,
  }
}

onMounted(async () => {
  try {
    fill(await companyApi.get())
  } catch (e) {
    loadError.value = e instanceof ApiError ? e.message : 'No se pudieron cargar los datos de la empresa.'
  }
})

async function onSubmit() {
  saved.value = false
  saved.value = await submit(async () => fill(await companyApi.update(form.value)))
}

function onLogoSelected(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0] ?? null
  if (logoPreview.value) URL.revokeObjectURL(logoPreview.value)
  logoFile.value = file
  logoPreview.value = file ? URL.createObjectURL(file) : null
}

async function uploadLogo() {
  if (!logoFile.value) return
  const ok = await logoForm.submit(async () => fill(await companyApi.uploadLogo(logoFile.value!)))
  if (ok) {
    if (logoPreview.value) URL.revokeObjectURL(logoPreview.value)
    logoPreview.value = null
    logoFile.value = null
  }
}

onBeforeUnmount(() => {
  if (logoPreview.value) URL.revokeObjectURL(logoPreview.value)
})
</script>

<template>
  <h1 class="text-xl font-semibold">Mi empresa</h1>

  <BaseAlert v-if="loadError" variant="error" class="mt-4">{{ loadError }}</BaseAlert>

  <div v-else-if="company" class="mt-4 grid gap-6 lg:grid-cols-2">
    <section class="rounded-xl border border-line bg-surface p-5" aria-labelledby="legal-title">
      <h2 id="legal-title" class="font-semibold">Datos legales</h2>
      <p class="mt-1 text-xs text-ink-muted">Para corregirlos, contacta al administrador de la plataforma.</p>
      <dl class="mt-4 space-y-3 text-sm" data-test="legal-data">
        <div><dt class="text-ink-muted">RUC</dt><dd class="font-medium">{{ company.ruc }}</dd></div>
        <div><dt class="text-ink-muted">Razón social</dt><dd class="font-medium">{{ company.razon_social }}</dd></div>
        <div><dt class="text-ink-muted">Tipo</dt><dd>{{ personTypeLabels[company.person_type] }}</dd></div>
        <div><dt class="text-ink-muted">Régimen</dt><dd>{{ taxRegimeLabels[company.tax_regime] }}</dd></div>
        <div v-if="company.fiscal_address">
          <dt class="text-ink-muted">Domicilio fiscal</dt>
          <dd>{{ company.fiscal_address.address }}<br />{{ company.fiscal_address.district }}</dd>
        </div>
      </dl>
    </section>

    <div class="space-y-6">
      <section class="rounded-xl border border-line bg-surface p-5" aria-labelledby="contact-title">
        <h2 id="contact-title" class="font-semibold">Datos de contacto</h2>
        <form class="mt-4 space-y-4" novalidate @submit.prevent="onSubmit">
          <BaseAlert v-if="generalError" variant="error">{{ generalError }}</BaseAlert>
          <BaseAlert v-if="saved" variant="success">Cambios guardados.</BaseAlert>

          <FormField v-slot="{ describedBy, invalid }" label="Nombre comercial" for="nombre_comercial" :error="fieldError('nombre_comercial')">
            <BaseInput id="nombre_comercial" v-model="form.nombre_comercial" :invalid="invalid" :aria-describedby="describedBy" />
          </FormField>
          <FormField v-slot="{ describedBy, invalid }" label="Correo de contacto" for="company-email" :error="fieldError('email')">
            <BaseInput id="company-email" v-model="form.email" type="email" inputmode="email" :invalid="invalid" :aria-describedby="describedBy" />
          </FormField>
          <FormField v-slot="{ describedBy, invalid }" label="Teléfono" for="phone" :error="fieldError('phone')">
            <BaseInput id="phone" v-model="form.phone" type="tel" inputmode="tel" :invalid="invalid" :aria-describedby="describedBy" />
          </FormField>

          <FormField
            v-slot="{ describedBy, invalid }"
            label="Aviso de vencimiento (días)"
            for="expiry_warning_days"
            hint="Con cuántos días de anticipación avisar de los lotes por vencer."
            :error="fieldError('expiry_warning_days')"
          >
            <BaseInput
              id="expiry_warning_days"
              v-model.number="form.expiry_warning_days"
              type="number"
              min="1"
              max="365"
              inputmode="numeric"
              :invalid="invalid"
              :aria-describedby="describedBy"
            />
          </FormField>

          <BaseButton type="submit" :loading="submitting">Guardar cambios</BaseButton>
        </form>
      </section>

      <section class="rounded-xl border border-line bg-surface p-5" aria-labelledby="logo-title">
        <h2 id="logo-title" class="font-semibold">Logo</h2>
        <p class="mt-1 text-xs text-ink-muted">PNG o JPG, hasta 1 MB. Aparecerá en tus documentos.</p>
        <div class="mt-4 flex items-center gap-4">
          <img
            v-if="logoPreview || company.logo_url"
            :src="logoPreview ?? company.logo_url ?? undefined"
            alt="Logo de la empresa"
            class="size-20 rounded-lg border border-line object-contain"
          />
          <div class="space-y-2">
            <label for="logo" class="sr-only">Elegir logo</label>
            <input id="logo" type="file" accept="image/png,image/jpeg" class="text-sm" @change="onLogoSelected" />
            <BaseButton variant="secondary" :disabled="!logoFile" :loading="logoForm.submitting.value" @click="uploadLogo">
              Subir logo
            </BaseButton>
          </div>
        </div>
        <p v-if="logoForm.fieldError('logo') || logoForm.generalError.value" class="mt-2 text-xs text-danger-700" role="alert">
          {{ logoForm.fieldError('logo') ?? logoForm.generalError.value }}
        </p>
      </section>
    </div>
  </div>
</template>
