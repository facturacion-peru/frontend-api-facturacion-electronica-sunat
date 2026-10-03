<script setup lang="ts">
/**
 * Logo de la aplicación. Es provisional y genérico (el proyecto es público):
 * para cambiarlo basta con reemplazar el <svg>. Toma los colores del tema
 * (brand-*), así que sigue a la marca definida en `main.css`. `size` es el
 * lado del símbolo en píxeles. Si cambias el dibujo o la marca, actualiza
 * también `public/favicon.svg`, que repite el dibujo con colores fijos.
 */
import { env } from '@/core/config/env'

withDefaults(defineProps<{ size?: number; withName?: boolean }>(), { size: 40, withName: false })
</script>

<template>
  <span class="inline-flex items-center gap-3">
    <svg
      viewBox="0 0 48 48"
      :width="size"
      :height="size"
      class="shrink-0"
      :role="withName ? undefined : 'img'"
      :aria-label="withName ? undefined : env.appName"
      :aria-hidden="withName || undefined"
    >
      <rect width="48" height="48" rx="12" class="fill-brand-600" />
      <path d="M15 11h13l7 7v19a2 2 0 0 1-2 2H15a2 2 0 0 1-2-2V13a2 2 0 0 1 2-2Z" class="fill-white" />
      <path d="M28 11v5a2 2 0 0 0 2 2h5Z" class="fill-brand-200" />
      <path d="M18 21h8M18 26h12" class="stroke-brand-300" stroke-width="2.5" stroke-linecap="round" fill="none" />
      <path
        d="m19 32 3 3 6-6"
        class="stroke-brand-600"
        stroke-width="3"
        stroke-linecap="round"
        stroke-linejoin="round"
        fill="none"
      />
    </svg>
    <span v-if="withName" class="text-lg font-semibold tracking-tight text-ink">{{ env.appName }}</span>
  </span>
</template>
