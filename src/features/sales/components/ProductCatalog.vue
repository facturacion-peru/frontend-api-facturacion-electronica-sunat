<script setup lang="ts">
import { useDebounceFn } from '@vueuse/core'
import { onMounted, ref } from 'vue'

import BaseAlert from '@/shared/ui/BaseAlert.vue'
import BaseButton from '@/shared/ui/BaseButton.vue'
import SearchInput from '@/shared/ui/SearchInput.vue'
import { formatMoney, formatQuantity } from '@/shared/utils/format'
import { salesApi, type SellableProduct } from '../api'

/**
 * Catálogo de «Vender» (spec 012, A-57): productos activos para agregar con
 * un toque, sin necesidad de buscar; la búsqueda filtra. Paginado con
 * «Cargar más».
 */
defineProps<{
  /** Cantidad en el carrito por producto, para mostrar cuántos llevo. */
  inCart: Record<number, string>
}>()

const emit = defineEmits<{ add: [SellableProduct] }>()

const search = ref('')
const products = ref<SellableProduct[]>([])
const page = ref(1)
const lastPage = ref(1)
const loading = ref(false)
const failed = ref(false)

async function load(reset: boolean) {
  loading.value = true
  failed.value = false
  const next = reset ? 1 : page.value + 1
  try {
    const result = await salesApi.listProducts({ search: search.value.trim(), page: next })
    products.value = reset ? result.data : [...products.value, ...result.data]
    page.value = result.meta.current_page
    lastPage.value = result.meta.last_page
  } catch {
    failed.value = true
  } finally {
    loading.value = false
  }
}

const runSearch = useDebounceFn(() => load(true), 250)

onMounted(() => load(true))

function canAdd(product: SellableProduct): boolean {
  return product.type === 'service' || Number(product.available_stock ?? 0) > 0
}
</script>

<template>
  <section aria-labelledby="catalog-title">
    <h2 id="catalog-title" class="sr-only">Productos</h2>
    <label for="sale-search" class="sr-only">Buscar producto</label>
    <!-- La búsqueda queda a mano al desplazar el catálogo (bajo la barra superior en el celular). -->
    <div class="sticky top-14 z-10 -mx-1 bg-canvas px-1 pb-2 lg:top-0">
      <SearchInput
        id="sale-search"
        v-model="search"
        placeholder="Buscar producto por nombre o código"
        autocomplete="off"
        @input="runSearch"
        @clear="load(true)"
      />
    </div>

    <BaseAlert v-if="failed" variant="error" class="mt-3">
      No se pudieron cargar los productos.
      <button type="button" class="font-medium underline" @click="load(products.length === 0)">Reintentar</button>
    </BaseAlert>

    <p v-else-if="!loading && products.length === 0" class="mt-6 text-center text-sm text-ink-muted">
      {{ search ? 'Ningún producto coincide con la búsqueda.' : 'Aún no hay productos activos.' }}
    </p>

    <ul class="mt-1 grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-2" data-test="catalog">
      <li v-for="product in products" :key="product.id">
        <button
          type="button"
          class="relative flex h-full min-h-24 w-full flex-col rounded-xl border bg-surface p-3 text-left shadow-xs transition enabled:hover:border-brand-600 enabled:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55"
          :class="inCart[product.id] ? 'border-brand-600 ring-2 ring-brand-600/15' : 'border-line'"
          :disabled="!canAdd(product)"
          @click="emit('add', product)"
        >
          <span class="line-clamp-2 pr-6 text-sm leading-snug font-medium text-ink">{{ product.name }}</span>
          <span class="mt-0.5 text-xs text-ink-muted">{{ product.code }}</span>
          <span class="mt-auto flex items-end justify-between gap-2 pt-2">
            <span class="font-semibold text-ink">{{ formatMoney(product.sale_price) }}</span>
            <span class="text-xs whitespace-nowrap" :class="canAdd(product) ? 'text-ink-muted' : 'font-medium text-danger-700'">
              <template v-if="product.type === 'service'">Servicio</template>
              <template v-else-if="canAdd(product)">Disp. {{ formatQuantity(product.available_stock) }}</template>
              <template v-else>Sin disponible</template>
            </span>
          </span>
          <span
            v-if="inCart[product.id]"
            class="absolute top-2 right-2 inline-flex min-w-6 items-center justify-center rounded-full bg-brand-600 px-1.5 text-xs font-semibold text-white"
          >
            <span class="sr-only">En el carrito: </span>{{ formatQuantity(inCart[product.id]!) }}
          </span>
        </button>
      </li>
      <template v-if="loading">
        <li v-for="n in 4" :key="`skeleton-${n}`" class="h-24 animate-pulse rounded-xl bg-subtle" aria-hidden="true" />
      </template>
    </ul>

    <div v-if="page < lastPage && !loading" class="mt-4 text-center">
      <BaseButton variant="secondary" data-test="catalog-more" @click="load(false)">Cargar más</BaseButton>
    </div>
  </section>
</template>
