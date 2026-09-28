<script setup lang="ts">
import { env } from '@/core/config/env'
</script>

<template>
  <main class="mx-auto max-w-2xl px-4 py-16">
    <h1 class="text-2xl font-semibold text-slate-900">{{ env.appName }}</h1>
    <p class="mt-2 text-slate-600">
      Proyecto base listo. Las funcionalidades se irán agregando por módulos en
      <code class="rounded bg-slate-100 px-1 py-0.5 text-sm">src/features/</code>.
    </p>
  </main>
</template>
