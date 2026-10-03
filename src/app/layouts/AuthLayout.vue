<script setup lang="ts">
import LogoApp from '@/shared/ui/LogoApp.vue'
import ThemeToggle from '@/shared/ui/ThemeToggle.vue'
</script>

<template>
  <div class="relative flex min-h-dvh flex-col items-center justify-center bg-linear-to-b from-brand-50 to-canvas px-4 py-10">
    <ThemeToggle class="absolute top-3 right-3 text-ink-muted hover:text-ink" />
    <LogoApp with-name :size="44" class="mb-6" />
    <main class="w-full max-w-sm rounded-2xl border border-line bg-surface p-6 shadow-sm">
      <RouterView />
    </main>
  </div>
</template>
