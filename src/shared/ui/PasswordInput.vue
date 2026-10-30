<script setup lang="ts">
/**
 * Contraseña con botón para verla mientras se escribe (útil en el celular,
 * donde es fácil equivocarse de tecla). Empieza oculta; el botón no envía el
 * formulario y su estado se anuncia con aria-pressed.
 * Los atributos no declarados (id, autocomplete, aria-describedby…) pasan al <input>.
 */
import { ref } from 'vue'

import { fieldClass, fieldStateClass } from './field'

defineOptions({ inheritAttrs: false })

defineProps<{ invalid?: boolean }>()

const model = defineModel<string>({ default: '' })
const visible = ref(false)
</script>

<template>
  <div class="relative">
    <input
      v-model="model"
      v-bind="$attrs"
      :type="visible ? 'text' : 'password'"
      autocapitalize="off"
      spellcheck="false"
      :aria-invalid="invalid || undefined"
      :class="[fieldClass, fieldStateClass(invalid), 'password-input w-full pr-12 pl-3']"
    />
    <button
      type="button"
      aria-label="Mostrar contraseña"
      :aria-pressed="visible"
      data-test="toggle-password"
      class="absolute top-1/2 right-0 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-lg text-ink-muted transition hover:bg-subtle hover:text-ink"
      @click="visible = !visible"
    >
      <svg v-if="visible" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" class="size-5">
        <path
          fill-rule="evenodd"
          d="M3.28 2.22a.75.75 0 0 0-1.06 1.06l14.5 14.5a.75.75 0 1 0 1.06-1.06l-1.745-1.745a10.03 10.03 0 0 0 3.3-4.38 1.65 1.65 0 0 0 0-1.185A10.004 10.004 0 0 0 9.999 3a9.956 9.956 0 0 0-4.744 1.194L3.28 2.22ZM7.752 6.69l1.092 1.092a2.5 2.5 0 0 1 3.374 3.373l1.091 1.092a4 4 0 0 0-5.557-5.557Z"
          clip-rule="evenodd"
        />
        <path
          d="m10.748 13.93 2.523 2.523a9.987 9.987 0 0 1-3.27.547c-4.258 0-7.894-2.66-9.337-6.41a1.651 1.651 0 0 1 0-1.186A10.007 10.007 0 0 1 2.839 6.02L6.07 9.252a4 4 0 0 0 4.678 4.678Z"
        />
      </svg>
      <svg v-else viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" class="size-5">
        <path d="M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
        <path
          fill-rule="evenodd"
          d="M.664 10.59a1.651 1.651 0 0 1 0-1.186A10.004 10.004 0 0 1 10 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0 1 10 17c-4.257 0-7.893-2.66-9.336-6.41ZM14 10a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z"
          clip-rule="evenodd"
        />
      </svg>
    </button>
  </div>
</template>

<style scoped>
/* El ojo nativo de Edge duplicaría el botón propio. */
.password-input::-ms-reveal {
  display: none;
}
</style>
