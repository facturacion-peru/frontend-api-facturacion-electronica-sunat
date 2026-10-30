<script setup lang="ts">
import { ref, watch } from 'vue'

/**
 * Foto de un producto en una caja de tamaño fijo (spec 016, RF-013): el
 * espacio queda reservado aunque la foto tarde, y nada se mueve al llegar.
 * Sin foto, o si no carga (S3 caído, sin red), muestra un marcador neutro
 * que el lector de pantalla no lee.
 */
const props = withDefaults(
  defineProps<{
    image: { url: string; thumb_url: string } | null
    /** Nombre del producto: es el texto alternativo de la foto. */
    name: string
    /** sm: 48 px (lista), md: 64 px (catálogo de «Vender»), lg: ficha. */
    size?: 'sm' | 'md' | 'lg'
  }>(),
  { size: 'sm' },
)

const failed = ref(false)
watch(
  () => props.image?.url,
  () => (failed.value = false),
)

const boxClass = { sm: 'size-12 rounded-lg', md: 'size-16 rounded-lg', lg: 'w-full max-w-xs rounded-xl' }
</script>

<template>
  <div class="relative aspect-square shrink-0 overflow-hidden border border-line bg-subtle" :class="boxClass[size]" data-test="product-thumb">
    <img
      v-if="image && !failed"
      :src="size === 'lg' ? image.url : image.thumb_url"
      :alt="name"
      loading="lazy"
      decoding="async"
      class="size-full object-cover"
      @error="failed = true"
    />
    <svg
      v-else
      data-test="thumb-placeholder"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      aria-hidden="true"
      class="absolute inset-0 m-auto size-1/2 text-ink-muted"
    >
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="1.75" />
      <path d="m21 16-5-5-9 9" stroke-linejoin="round" />
    </svg>
  </div>
</template>
