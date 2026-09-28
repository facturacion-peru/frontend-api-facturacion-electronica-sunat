<script setup lang="ts">
import { env } from '@/core/config/env'
</script>

<template>
  <div class="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
    <p class="mb-6 text-center text-sm font-semibold tracking-wide text-brand-700 uppercase">{{ env.appName }}</p>
    <main class="w-full max-w-sm rounded-2xl border border-line bg-surface p-6 shadow-sm">
      <RouterView />
    </main>
  </div>
</template>
