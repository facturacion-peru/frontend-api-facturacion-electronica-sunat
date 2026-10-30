<script setup lang="ts">
/**
 * Crear o editar un local (spec 017, HU-1; A-89 ⚖️). El código de anexo es el
 * de la ficha RUC: la app no lo puede comprobar en SUNAT, así que el aviso
 * queda siempre a la vista. Con comprobantes, el código ya no cambia. Un
 * local no se borra: se desactiva, y el principal tampoco eso.
 */
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { ApiError } from '@/core/api/errors'
import { useApiForm } from '@/shared/composables/useApiForm'
import { establishmentsApi } from '@/shared/establishments/api'
import { useEstablishmentStore } from '@/shared/establishments/store'
import type { Establishment, EstablishmentForm } from '@/shared/establishments/types'
import BaseAlert from '@/shared/ui/BaseAlert.vue'
import BaseButton from '@/shared/ui/BaseButton.vue'
import BaseDialog from '@/shared/ui/BaseDialog.vue'
import BaseInput from '@/shared/ui/BaseInput.vue'
import FormField from '@/shared/ui/FormField.vue'
import UbigeoPicker from '@/shared/ui/UbigeoPicker.vue'

const route = useRoute()
const router = useRouter()
const store = useEstablishmentStore()
const { submitting, generalError, fieldError, submit } = useApiForm()

const id = computed(() => (route.params.id ? Number(route.params.id) : null))
const establishment = ref<Establishment | null>(null)
const form = ref<EstablishmentForm>({ code: '', name: '', address: '', ubigeo: '' })
const loadError = ref<string | null>(null)
const loaded = ref(id.value === null)
const confirmToggle = ref(false)

onMounted(async () => {
  if (id.value === null) return
  try {
    // No hay GET de un local: la lista completa del administrador lo trae.
    const found = (await establishmentsApi.list(true)).find((e) => e.id === id.value)
    if (!found) {
      loadError.value = 'No encontramos ese local.'
      return
    }
    establishment.value = found
    form.value = { code: found.code, name: found.name, address: found.address, ubigeo: found.ubigeo }
  } catch (e) {
    loadError.value = e instanceof ApiError ? e.message : 'No se pudo cargar el local.'
  } finally {
    loaded.value = true
  }
})

async function done(result: 'creado' | 'guardado') {
  // Un local nuevo o desactivado cambia el selector y los filtros de la sesión.
  await store.reload().catch(() => {})
  await router.push({ name: 'company', query: { local: result } })
}

async function onSubmit() {
  const current = establishment.value
  const ok = await submit(async () => {
    if (current) {
      const { code, ...rest } = form.value
      await establishmentsApi.update(current.id, current.code_locked ? rest : { code, ...rest })
    } else {
      await establishmentsApi.create(form.value)
    }
  })
  if (ok) await done(current ? 'guardado' : 'creado')
}

async function toggleActive() {
  confirmToggle.value = false
  const current = establishment.value!
  if (await submit(() => establishmentsApi.update(current.id, { active: !current.active }))) await done('guardado')
}
</script>

<template>
  <BaseAlert v-if="loadError" variant="error">{{ loadError }}</BaseAlert>

  <template v-else-if="loaded">
    <h1 class="text-xl font-semibold">{{ establishment ? 'Editar local' : 'Nuevo local' }}</h1>
    <p class="text-sm text-ink-muted">
      <RouterLink :to="{ name: 'company' }" class="text-brand-700 hover:underline">Mi empresa</RouterLink> · Locales
    </p>

    <form class="mt-4 max-w-lg space-y-4 rounded-xl border border-line bg-surface p-5" novalidate @submit.prevent="onSubmit">
      <BaseAlert v-if="generalError || fieldError('active')" variant="error">{{ fieldError('active') ?? generalError }}</BaseAlert>

      <BaseAlert variant="warning" data-test="code-warning">
        Usa el código de anexo de tu ficha RUC. Si no existe en SUNAT, tus comprobantes serán observados o rechazados.
      </BaseAlert>

      <FormField
        v-slot="{ describedBy, invalid }"
        label="Código de anexo"
        for="establishment-code"
        :hint="establishment?.code_locked ? 'No se puede cambiar: el local ya tiene comprobantes.' : '4 dígitos, como figura en SUNAT.'"
        :error="fieldError('code')"
      >
        <BaseInput
          id="establishment-code"
          v-model="form.code"
          inputmode="numeric"
          maxlength="4"
          autocomplete="off"
          :disabled="establishment?.code_locked"
          :invalid="invalid"
          :aria-describedby="describedBy"
        />
      </FormField>
      <FormField v-slot="{ describedBy, invalid }" label="Nombre" for="establishment-name" hint="Cómo lo verán en la app, p. ej. «Sucursal Centro»." :error="fieldError('name')">
        <BaseInput id="establishment-name" v-model="form.name" :invalid="invalid" :aria-describedby="describedBy" />
      </FormField>
      <FormField v-slot="{ describedBy, invalid }" label="Dirección" for="establishment-address" :error="fieldError('address')">
        <BaseInput id="establishment-address" v-model="form.address" autocomplete="street-address" :invalid="invalid" :aria-describedby="describedBy" />
      </FormField>
      <FormField v-slot="{ describedBy, invalid }" label="Distrito" for="establishment-ubigeo" :error="fieldError('ubigeo')">
        <UbigeoPicker
          id="establishment-ubigeo"
          v-model="form.ubigeo"
          :search="establishmentsApi.searchUbigeos"
          :label="establishment?.district"
          :invalid="invalid"
          :described-by="describedBy"
        />
      </FormField>

      <div class="flex flex-wrap gap-2">
        <BaseButton type="submit" :loading="submitting">{{ establishment ? 'Guardar cambios' : 'Crear local' }}</BaseButton>
        <BaseButton
          v-if="establishment && !establishment.is_main"
          :variant="establishment.active ? 'danger' : 'secondary'"
          :disabled="submitting"
          data-test="toggle-active"
          @click="confirmToggle = true"
        >
          {{ establishment.active ? 'Desactivar' : 'Activar' }}
        </BaseButton>
      </div>
    </form>

    <BaseDialog v-if="establishment" v-model:open="confirmToggle" :title="establishment.active ? '¿Desactivar el local?' : '¿Activar el local?'">
      <p class="text-sm text-ink-muted">
        <template v-if="establishment.active">
          No se podrá vender ni asignar usuarios en {{ establishment.name }}. Sus ventas, series y stock se siguen viendo, y puedes activarlo otra vez.
        </template>
        <template v-else>Se podrá vender otra vez en {{ establishment.name }} y asignarle usuarios.</template>
      </p>
      <template #actions>
        <BaseButton variant="secondary" @click="confirmToggle = false">Cancelar</BaseButton>
        <BaseButton :variant="establishment.active ? 'danger' : 'primary'" data-autofocus data-test="confirm-toggle" @click="toggleActive">
          {{ establishment.active ? 'Desactivar' : 'Activar' }}
        </BaseButton>
      </template>
    </BaseDialog>
  </template>
</template>
