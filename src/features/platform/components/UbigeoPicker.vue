<script setup lang="ts">
import { useDebounceFn } from '@vueuse/core'
import { ref } from 'vue'

import SearchInput from '@/shared/ui/SearchInput.vue'
import { platformApi } from '../api'
import type { Ubigeo } from '../types'

/** Buscador de distrito (ubigeo) para el domicilio fiscal. */
const props = defineProps<{ id: string; label?: string | null; invalid?: boolean; describedBy?: string }>()
const ubigeo = defineModel<string>({ default: '' })
const emit = defineEmits<{ picked: [Ubigeo] }>()

const search = ref(props.label ?? '')
const results = ref<Ubigeo[]>([])

const runSearch = useDebounceFn(async () => {
  const q = search.value.trim()
  results.value = q.length >= 2 ? await platformApi.searchUbigeos(q).catch(() => []) : []
}, 250)

function pick(u: Ubigeo) {
  ubigeo.value = u.id
  search.value = u.ubigeo_completo
  results.value = []
  emit('picked', u)
}
</script>

<template>
  <div>
    <SearchInput
      :id="id"
      v-model="search"
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
