<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

import { useApiForm } from '@/shared/composables/useApiForm'
import BaseAlert from '@/shared/ui/BaseAlert.vue'
import BaseButton from '@/shared/ui/BaseButton.vue'
import BaseInput from '@/shared/ui/BaseInput.vue'
import FormField from '@/shared/ui/FormField.vue'
import { platformApi } from '../api'
import UbigeoPicker from '../components/UbigeoPicker.vue'
import { taxRegimeLabels, type NewCompanyForm } from '../types'

/** Alta de una empresa y su administrador (spec 006, HU-2; mismas reglas que la 001). */
const router = useRouter()
const form = ref<NewCompanyForm>({
  ruc: '', razon_social: '', nombre_comercial: null, tax_regime: 'rmt', email: '', phone: null, address: '', ubigeo: '', admin_email: '',
})
const { submitting, generalError, fieldError, submit } = useApiForm()
const selectClass = 'block min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-base sm:text-sm'

async function onSubmit() {
  let createdId: number | null = null
  const ok = await submit(async () => {
    createdId = (await platformApi.create(form.value)).id
  })
  if (ok && createdId !== null) await router.push({ name: 'platform-company', params: { id: createdId }, query: { nueva: '1' } })
}
</script>

<template>
  <RouterLink :to="{ name: 'platform-companies' }" class="inline-flex min-h-11 items-center text-sm text-brand-700">← Empresas</RouterLink>
  <h1 class="mt-2 text-xl font-semibold">Nueva empresa</h1>

  <form class="mt-4 grid gap-4 rounded-xl border border-line bg-surface p-5 sm:grid-cols-2" novalidate @submit.prevent="onSubmit">
    <BaseAlert v-if="generalError" variant="error" class="sm:col-span-2">{{ generalError }}</BaseAlert>

    <FormField v-slot="{ describedBy, invalid }" label="RUC" for="ruc" :error="fieldError('ruc')">
      <BaseInput id="ruc" v-model="form.ruc" inputmode="numeric" maxlength="11" :invalid="invalid" :aria-describedby="describedBy" />
    </FormField>
    <FormField label="Régimen tributario" for="tax_regime" :error="fieldError('tax_regime')">
      <select id="tax_regime" v-model="form.tax_regime" :class="selectClass">
        <option v-for="(label, value) in taxRegimeLabels" :key="value" :value="value">{{ label }}</option>
      </select>
    </FormField>
    <FormField v-slot="{ describedBy, invalid }" label="Razón social" for="razon_social" :error="fieldError('razon_social')">
      <BaseInput id="razon_social" v-model="form.razon_social" :invalid="invalid" :aria-describedby="describedBy" />
    </FormField>
    <FormField v-slot="{ describedBy, invalid }" label="Nombre comercial (opcional)" for="nombre_comercial" :error="fieldError('nombre_comercial')">
      <BaseInput id="nombre_comercial" v-model="form.nombre_comercial" :invalid="invalid" :aria-describedby="describedBy" />
    </FormField>
    <FormField v-slot="{ describedBy, invalid }" label="Domicilio fiscal" for="address" :error="fieldError('address')">
      <BaseInput id="address" v-model="form.address" :invalid="invalid" :aria-describedby="describedBy" />
    </FormField>
    <FormField v-slot="{ describedBy, invalid }" label="Distrito (ubigeo)" for="ubigeo" :error="fieldError('ubigeo')">
      <UbigeoPicker id="ubigeo" v-model="form.ubigeo" :invalid="invalid" :described-by="describedBy" />
    </FormField>
    <FormField v-slot="{ describedBy, invalid }" label="Correo de la empresa" for="email" :error="fieldError('email')">
      <BaseInput id="email" v-model="form.email" type="email" :invalid="invalid" :aria-describedby="describedBy" />
    </FormField>
    <FormField v-slot="{ describedBy, invalid }" label="Teléfono (opcional)" for="phone" :error="fieldError('phone')">
      <BaseInput id="phone" v-model="form.phone" type="tel" :invalid="invalid" :aria-describedby="describedBy" />
    </FormField>
    <FormField
      v-slot="{ describedBy, invalid }"
      class="sm:col-span-2"
      label="Correo del administrador de la empresa"
      for="admin_email"
      hint="Recibirá una invitación para crear su contraseña."
      :error="fieldError('admin_email')"
    >
      <BaseInput id="admin_email" v-model="form.admin_email" type="email" :invalid="invalid" :aria-describedby="describedBy" />
    </FormField>

    <div class="sm:col-span-2"><BaseButton type="submit" :loading="submitting">Registrar empresa</BaseButton></div>
  </form>
</template>
