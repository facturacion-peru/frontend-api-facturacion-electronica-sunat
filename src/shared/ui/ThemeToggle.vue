<script setup lang="ts">
import { computed } from 'vue'

import { useTheme, type ThemePreference } from '@/shared/composables/useTheme'

/** Selector de tema (spec 010, HU-5): alterna Sistema → Claro → Oscuro. */
const { preference, setPreference } = useTheme()

const order: ThemePreference[] = ['system', 'light', 'dark']
const labels: Record<ThemePreference, string> = { system: 'según el sistema', light: 'claro', dark: 'oscuro' }

const label = computed(() => `Tema: ${labels[preference.value]}. Cambiar tema`)

function next() {
  setPreference(order[(order.indexOf(preference.value) + 1) % order.length]!)
}
</script>

<template>
  <button
    type="button"
    :aria-label="label"
    :title="label"
    class="inline-flex size-11 shrink-0 items-center justify-center rounded-lg transition hover:bg-current/10"
    @click="next"
  >
    <svg v-if="preference === 'light'" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" class="size-5">
      <path
        d="M10 2a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 10 2Zm0 13a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 10 15Zm0-8a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm5.66-2.66a.75.75 0 0 1 0 1.06l-1.06 1.06a.75.75 0 1 1-1.06-1.06l1.06-1.06a.75.75 0 0 1 1.06 0Zm-9.2 9.2a.75.75 0 0 1 0 1.06L5.4 15.66a.75.75 0 0 1-1.06-1.06l1.06-1.06a.75.75 0 0 1 1.06 0ZM18 10a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1 0-1.5h1.5A.75.75 0 0 1 18 10ZM5 10a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1 0-1.5h1.5A.75.75 0 0 1 5 10Zm10.66 5.66a.75.75 0 0 1-1.06 0l-1.06-1.06a.75.75 0 1 1 1.06-1.06l1.06 1.06a.75.75 0 0 1 0 1.06Zm-9.2-9.2a.75.75 0 0 1-1.06 0L4.34 5.4A.75.75 0 0 1 5.4 4.34l1.06 1.06a.75.75 0 0 1 0 1.06Z"
      />
    </svg>
    <svg v-else-if="preference === 'dark'" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" class="size-5">
      <path
        fill-rule="evenodd"
        d="M7.46 2.3a.75.75 0 0 1 .17.81 6 6 0 0 0 7.26 7.98.75.75 0 0 1 .95.9A7.5 7.5 0 1 1 6.6 2.14a.75.75 0 0 1 .86.16Z"
        clip-rule="evenodd"
      />
    </svg>
    <svg v-else viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" class="size-5">
      <path
        fill-rule="evenodd"
        d="M2 4.25A2.25 2.25 0 0 1 4.25 2h11.5A2.25 2.25 0 0 1 18 4.25v8.5A2.25 2.25 0 0 1 15.75 15h-3.1l.43 1.5h1.17a.75.75 0 0 1 0 1.5H5.75a.75.75 0 0 1 0-1.5h1.17l.43-1.5h-3.1A2.25 2.25 0 0 1 2 12.75v-8.5Zm2.25-.75a.75.75 0 0 0-.75.75v7.5c0 .41.34.75.75.75h11.5a.75.75 0 0 0 .75-.75v-7.5a.75.75 0 0 0-.75-.75H4.25Z"
        clip-rule="evenodd"
      />
    </svg>
  </button>
</template>
