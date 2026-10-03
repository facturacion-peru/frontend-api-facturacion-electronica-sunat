<script setup lang="ts">
/**
 * Lista desplegable con el estilo único de campo (spec 010, HU-4). Las
 * <option> van en el slot; los atributos no declarados pasan al <select>.
 */
import { fieldClass, fieldStateClass } from './field'

defineOptions({ inheritAttrs: false })

defineProps<{ invalid?: boolean }>()

const model = defineModel<string | number | boolean | null>()
</script>

<template>
  <div class="relative">
    <select
      v-model="model"
      v-bind="$attrs"
      :aria-invalid="invalid || undefined"
      :class="[fieldClass, fieldStateClass(invalid), 'w-full cursor-pointer appearance-none pr-10 pl-3']"
    >
      <slot />
    </select>
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
      class="pointer-events-none absolute top-1/2 right-3 size-5 -translate-y-1/2 text-ink-muted"
    >
      <path
        fill-rule="evenodd"
        d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
        clip-rule="evenodd"
      />
    </svg>
  </div>
</template>
