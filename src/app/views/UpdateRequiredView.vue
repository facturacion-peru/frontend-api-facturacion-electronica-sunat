<script setup lang="ts">
import LogoApp from '@/shared/ui/LogoApp.vue'

/**
 * La app Android quedó por debajo de la versión mínima de la API (426,
 * spec 013, HU-5). La sesión y la venta en curso se conservan: al instalar
 * la versión nueva encima, todo sigue donde estaba.
 */
defineProps<{ minVersion: string; currentVersion: string | null }>()
</script>

<template>
  <main data-test="update-required" class="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 py-10 text-center">
    <LogoApp :size="56" />
    <h1 class="text-2xl font-semibold tracking-tight text-ink">Actualiza la app</h1>
    <p class="max-w-sm text-ink-muted">
      Esta versión ya no es compatible con el servidor. Instala la versión {{ minVersion }} o una más reciente para seguir vendiendo.
    </p>
    <p class="max-w-sm text-sm text-ink-muted">
      Pide el archivo de instalación a quien administra el sistema. Tu sesión y la venta en curso se conservan.
    </p>
    <p v-if="currentVersion" class="text-xs text-ink-muted">Versión instalada: {{ currentVersion }}</p>
  </main>
</template>
