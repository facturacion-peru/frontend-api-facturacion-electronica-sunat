<script setup lang="ts">
/**
 * Logo de la empresa (barra lateral, cabecera del celular e Inicio). Sin logo,
 * o si la imagen no carga, el del sistema. Va sobre un recuadro claro también
 * en modo oscuro: los logos suelen ser oscuros sobre transparente.
 */
import { ref, watch } from 'vue'

import LogoApp from '@/shared/ui/LogoApp.vue'

const props = defineProps<{ logoUrl: string | null; companyName: string; size: number }>()

const failed = ref(false)
watch(
  () => props.logoUrl,
  () => (failed.value = false),
)
</script>

<template>
  <span
    v-if="logoUrl && !failed"
    class="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-line bg-white p-0.5"
    :style="{ width: `${size}px`, height: `${size}px` }"
  >
    <img
      :src="logoUrl"
      :alt="`Logo de ${companyName}`"
      class="size-full object-contain"
      data-test="company-logo"
      @error="failed = true"
    />
  </span>
  <LogoApp v-else :size="size" />
</template>
