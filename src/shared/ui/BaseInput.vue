<script setup lang="ts">
/**
 * Campo de texto. Los atributos no declarados (id, type, autocomplete,
 * aria-describedby…) pasan directamente al <input>. `narrow` es para
 * cantidades e importes dentro de una fila (5 caracteres de ancho).
 */
import { fieldClass, fieldStateClass, fieldWidthClass } from './field'

defineOptions({ inheritAttrs: false })

defineProps<{ invalid?: boolean; narrow?: boolean }>()

const model = defineModel<string | number | null>({ default: '' })
</script>

<template>
  <input
    v-model="model"
    v-bind="$attrs"
    :aria-invalid="invalid || undefined"
    :class="[fieldClass, fieldStateClass(invalid), narrow ? 'w-20 px-2' : fieldWidthClass]"
  />
</template>
