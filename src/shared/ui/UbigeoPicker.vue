<script setup lang="ts">
import { useDebounceFn } from '@vueuse/core'
import { ref } from 'vue'

import SearchInput from './SearchInput.vue'
import type { Ubigeo } from './ubigeo'

/**
 * Buscador de distrito (ubigeo): el domicilio fiscal en la plataforma y la
 * dirección de un local en la empresa (spec 017). Cada uno pasa su búsqueda
 * (`/platform/ubigeos/search` o `/ubigeos/search`) en `search`.
 */
const props = defineProps<{
  id: string
  search: (q: string) => Promise<Ubigeo[]>
  label?: string | null
  invalid?: boolean
  describedBy?: string
}>()
const ubigeo = defineModel<string>({ default: '' })
const emit = defineEmits<{ picked: [Ubigeo] }>()

const text = ref(props.label ?? '')
const results = ref<Ubigeo[]>([])

const runSearch = useDebounceFn(async () => {
  const q = text.value.trim()
  results.value = q.length >= 2 ? await props.search(q).catch(() => []) : []
}, 250)

function pick(u: Ubigeo) {
  ubigeo.value = u.id
  text.value = u.ubigeo_completo
  results.value = []
  emit('picked', u)
}
</script>

<template>
  <div>
    <SearchInput
      :id="id"
      v-model="text"
      placeholder="Escribe el distrito"
      autocomplete="off"
      :invalid="invalid"
      :aria-describedby="describedBy"
      @input="runSearch"
      @clear="runSearch"
    />
    <ul v-if="results.length" class="mt-1 max-h-60 divide-y divide-line overflow-y-auto rounded-xl border border-line bg-surface" :data-test="`${id}-results`">
      <li v-for="u in results" :key="u.id">
        <button type="button" class="flex min-h-11 w-full items-center justify-between gap-2 px-3 text-left text-sm hover:bg-canvas" @click="pick(u)">
          <span>{{ u.ubigeo_completo }}</span>
          <span class="text-xs text-ink-muted">{{ u.id }}</span>
        </button>
      </li>
    </ul>
  </div>
</template>
