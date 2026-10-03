<script setup lang="ts">
/**
 * Búsqueda con lupa y botón para limpiarla (spec 010, HU-4). Al limpiar
 * vacía el texto, emite `clear` para que la vista quite el filtro (suele ser
 * el mismo manejador que usa al escribir) y devuelve el foco al campo.
 * Los atributos no declarados (id, placeholder, @input…) pasan al <input>.
 */
import { useTemplateRef } from 'vue'

import { fieldClass, fieldStateClass } from './field'

defineOptions({ inheritAttrs: false })

defineProps<{ invalid?: boolean }>()

const emit = defineEmits<{ clear: [] }>()

const model = defineModel<string>({ default: '' })
const input = useTemplateRef<HTMLInputElement>('input')

function clear() {
  model.value = ''
  emit('clear')
  input.value?.focus()
}
</script>

<template>
  <div class="relative">
    <svg
      data-test="search-icon"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
      class="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-ink-muted"
    >
      <path
        fill-rule="evenodd"
        d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.45 4.39l3.08 3.08a.75.75 0 1 1-1.06 1.06l-3.08-3.08A7 7 0 0 1 2 9Z"
        clip-rule="evenodd"
      />
    </svg>
    <input
      ref="input"
      v-model="model"
      v-bind="$attrs"
      type="search"
      :aria-invalid="invalid || undefined"
      :class="[fieldClass, fieldStateClass(invalid), 'search-input w-full pr-12 pl-10']"
    />
    <button
      v-if="model"
      type="button"
      aria-label="Limpiar búsqueda"
      class="absolute top-1/2 right-0 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-lg text-ink-muted transition hover:bg-subtle hover:text-ink"
      @click="clear"
    >
      <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" class="size-5">
        <path
          d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z"
        />
      </svg>
    </button>
  </div>
</template>

<style scoped>
/* La «x» nativa duplicaría el botón propio. */
.search-input::-webkit-search-cancel-button {
  appearance: none;
}
</style>
