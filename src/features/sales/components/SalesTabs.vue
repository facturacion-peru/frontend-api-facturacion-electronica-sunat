<script setup lang="ts">
/** Pestañas de «Ventas»: tickets internos y comprobantes electrónicos (plan 005). */
</script>

<template>
  <nav aria-label="Tipo de venta" class="mt-3 flex gap-1 border-b border-line">
    <RouterLink
      :to="{ name: 'tickets' }"
      class="inline-flex min-h-11 items-center border-b-2 border-transparent px-3 text-sm text-ink-muted"
      exact-active-class="!border-brand-600 !text-brand-700 font-medium"
    >
      Tickets
    </RouterLink>
    <RouterLink
      :to="{ name: 'sales-documents' }"
      class="inline-flex min-h-11 items-center border-b-2 border-transparent px-3 text-sm text-ink-muted"
      exact-active-class="!border-brand-600 !text-brand-700 font-medium"
    >
      Comprobantes
    </RouterLink>
  </nav>
</template>
