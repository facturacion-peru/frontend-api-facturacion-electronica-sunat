<script setup lang="ts">
/**
 * Casillas de los locales activos donde puede trabajar un vendedor (spec 017,
 * A-87). Al menos uno: lo exige la API. Sus errores llegan en
 * `establishment_ids` o, por local, en `establishment_ids.0`.
 */
import { computed } from 'vue'

import { useEstablishmentStore } from '@/shared/establishments/store'

const props = defineProps<{ name: string; errors: Record<string, string[]> }>()
const selected = defineModel<number[]>({ default: () => [] })
const store = useEstablishmentStore()

const error = computed(
  () => Object.entries(props.errors).find(([key]) => key === 'establishment_ids' || key.startsWith('establishment_ids.'))?.[1][0] ?? null,
)
</script>

<template>
  <fieldset>
    <legend class="text-sm font-medium text-ink">Locales donde trabaja</legend>
    <div class="mt-2 grid gap-2 sm:grid-cols-2">
      <label
        v-for="establishment in store.allowed"
        :key="establishment.id"
        class="flex min-h-11 min-w-0 cursor-pointer items-center gap-2 rounded-lg border border-line px-3 text-sm has-checked:border-brand-600 has-checked:bg-brand-50"
      >
        <input v-model="selected" type="checkbox" :name="name" :value="establishment.id" class="size-4" />
        <span class="truncate">{{ establishment.name }}</span>
      </label>
    </div>
    <p v-if="error" class="mt-1 text-xs text-danger-700" data-test="establishments-error">{{ error }}</p>
  </fieldset>
</template>
