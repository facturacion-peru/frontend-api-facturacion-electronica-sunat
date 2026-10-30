<script setup lang="ts">
/**
 * Filtro de local de las listas, el inicio y las exportaciones (spec 017,
 * A-90). `null` es «Todos los locales»: la vista no manda `establishment_id`
 * y la API usa los permitidos. Con un solo local activo no se pinta (RF-010).
 * El valor inicial lo da `useEstablishmentStore().defaultFilter`.
 */
import { onMounted } from 'vue'

import BaseSelect from '@/shared/ui/BaseSelect.vue'
import { useEstablishmentStore } from './store'

/** `showLabel`: etiqueta visible, como la de `FormField`, para los formularios de filtros. */
defineProps<{ id: string; showLabel?: boolean }>()
const emit = defineEmits<{ change: [id: number | null] }>()

const model = defineModel<number | null>({ default: null })
const store = useEstablishmentStore()
onMounted(store.loadReadable)

function onChange(value: unknown) {
  // `model.value` sigue con el valor anterior hasta que el padre lo actualiza.
  const id = typeof value === 'number' ? value : null
  model.value = id
  emit('change', id)
}
</script>

<template>
  <div v-if="store.multi" :class="showLabel && 'space-y-1.5'">
    <label :for="id" :class="showLabel ? 'block text-sm font-medium text-ink' : 'sr-only'">Local</label>
    <!-- «Todos» va como '' y no como null: una <option> sin value toma su texto. -->
    <BaseSelect :id="id" :model-value="model ?? ''" data-test="establishment-filter" @update:model-value="onChange">
      <option value="">Todos los locales</option>
      <option v-for="establishment in store.filterOptions" :key="establishment.id" :value="establishment.id">
        {{ establishment.name }}{{ establishment.active ? '' : ' (inactivo)' }}
      </option>
    </BaseSelect>
  </div>
</template>
