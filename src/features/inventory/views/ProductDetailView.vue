<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'

import { ApiError } from '@/core/api/errors'
import type { PaginationMeta } from '@/core/api/types'
import { useSessionStore } from '@/core/auth/session-store'
import BaseAlert from '@/shared/ui/BaseAlert.vue'
import BaseBadge from '@/shared/ui/BaseBadge.vue'
import BaseButton from '@/shared/ui/BaseButton.vue'
import { formatMoney, formatQuantity } from '@/shared/utils/format'
import { inventoryApi } from '../api'
import AdjustStockDialog from '../components/AdjustStockDialog.vue'
import LotList from '../components/LotList.vue'
import MovementList from '../components/MovementList.vue'
import ReverseMovementDialog from '../components/ReverseMovementDialog.vue'
import { useInventoryCatalogs } from '../composables/useInventoryCatalogs'
import type { Lot, Movement, Product } from '../types'

const route = useRoute()
const session = useSessionStore()
const { load: loadCatalogs, unitLabel, igvLabel, allowsDecimals } = useInventoryCatalogs()

const productId = Number(route.params.id)
const product = ref<Product | null>(null)
const lots = ref<Lot[]>([])
const movements = ref<Movement[]>([])
const movementsMeta = ref<PaginationMeta | null>(null)
const loadError = ref<string | null>(null)
const notice = ref<string | null>(null)
const warning = ref<string | null>(typeof route.query.aviso === 'string' ? route.query.aviso : null)

const adjustingLot = ref<Lot | null>(null)
const adjustOpen = ref(false)
const reversing = ref<Movement | null>(null)
const reverseOpen = ref(false)

const isAdmin = computed(() => session.isCompanyAdmin)
const tracksStock = computed(() => product.value?.type === 'good')

if (route.query.guardado) notice.value = 'Producto guardado.'
if (route.query.entrada) notice.value = 'Entrada registrada.'

async function load(movementsPage = 1) {
  try {
    product.value = await inventoryApi.getProduct(productId)
    if (!tracksStock.value) return

    const [lotList, movementPage] = await Promise.all([
      inventoryApi.lots(productId),
      isAdmin.value ? inventoryApi.movements(productId, movementsPage) : Promise.resolve(null),
    ])
    lots.value = lotList
    if (movementPage) {
      movements.value = movementPage.data
      movementsMeta.value = movementPage.meta
    }
  } catch (e) {
    loadError.value = e instanceof ApiError ? e.message : 'No se pudo cargar el producto.'
  }
}

function openAdjust(lot: Lot) {
  adjustingLot.value = lot
  adjustOpen.value = true
}

function openReverse(movement: Movement) {
  reversing.value = movement
  reverseOpen.value = true
}

function afterChange(message: string) {
  notice.value = message
  warning.value = null
  load()
}

onMounted(() => {
  loadCatalogs()
  load()
})
</script>

<template>
  <BaseAlert v-if="loadError" variant="error">{{ loadError }}</BaseAlert>

  <template v-else-if="product">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="min-w-0">
        <h1 class="flex flex-wrap items-center gap-2 text-xl font-semibold">
          <span>{{ product.name }}</span>
          <BaseBadge v-if="!product.active" variant="neutral">Desactivado</BaseBadge>
          <BaseBadge v-if="!tracksStock" variant="info">Servicio</BaseBadge>
        </h1>
        <p class="text-sm text-ink-muted">{{ product.code }} · {{ unitLabel(product.unit) }} · {{ igvLabel(product.igv_affectation) }}</p>
      </div>
      <div v-if="isAdmin" class="flex flex-wrap gap-2">
        <RouterLink v-if="tracksStock && product.active" :to="{ name: 'stock-entry', params: { id: product.id } }">
          <BaseButton tabindex="-1">Registrar entrada</BaseButton>
        </RouterLink>
        <RouterLink :to="{ name: 'product-edit', params: { id: product.id } }">
          <BaseButton variant="secondary" tabindex="-1">Editar</BaseButton>
        </RouterLink>
      </div>
    </div>

    <div class="mt-4 space-y-3">
      <BaseAlert v-if="notice" variant="success">{{ notice }}</BaseAlert>
      <BaseAlert v-if="warning" variant="warning">{{ warning }}</BaseAlert>
    </div>

    <dl class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4" data-test="product-summary">
      <div class="rounded-xl border border-line bg-surface p-4">
        <dt class="text-xs text-ink-muted">Precio (con IGV)</dt>
        <dd class="mt-1 text-lg font-semibold">{{ formatMoney(product.sale_price) }}</dd>
      </div>
      <template v-if="tracksStock">
        <div class="rounded-xl border border-line bg-surface p-4">
          <dt class="text-xs text-ink-muted">Disponible</dt>
          <dd class="mt-1 text-lg font-semibold">{{ formatQuantity(product.available_stock) }}</dd>
        </div>
        <div class="rounded-xl border border-line bg-surface p-4">
          <dt class="text-xs text-ink-muted">Stock físico</dt>
          <dd class="mt-1 text-lg font-semibold">{{ formatQuantity(product.stock) }}</dd>
        </div>
        <div v-if="product.last_unit_cost !== undefined" class="rounded-xl border border-line bg-surface p-4">
          <dt class="text-xs text-ink-muted">Último costo</dt>
          <dd class="mt-1 text-lg font-semibold">{{ formatMoney(product.last_unit_cost) }}</dd>
        </div>
      </template>
    </dl>

    <template v-if="tracksStock">
      <h2 class="mt-8 text-lg font-semibold">Lotes</h2>
      <LotList class="mt-3" :lots="lots" :can-adjust="isAdmin" @adjust="openAdjust" />

      <template v-if="isAdmin">
        <h2 class="mt-8 text-lg font-semibold">Historial</h2>
        <MovementList class="mt-3" :movements="movements" @reverse="openReverse" />
        <nav v-if="movementsMeta && movementsMeta.last_page > 1" class="mt-4 flex items-center justify-between" aria-label="Paginación del historial">
          <BaseButton variant="secondary" :disabled="movementsMeta.current_page <= 1" @click="load(movementsMeta.current_page - 1)">Anterior</BaseButton>
          <span class="text-sm text-ink-muted">Página {{ movementsMeta.current_page }} de {{ movementsMeta.last_page }}</span>
          <BaseButton variant="secondary" :disabled="movementsMeta.current_page >= movementsMeta.last_page" @click="load(movementsMeta.current_page + 1)">
            Siguiente
          </BaseButton>
        </nav>
      </template>
    </template>

    <AdjustStockDialog v-model:open="adjustOpen" :lot="adjustingLot" :allows-decimals="allowsDecimals(product.unit)" @done="afterChange('Ajuste registrado.')" />
    <ReverseMovementDialog v-model:open="reverseOpen" :movement="reversing" @done="afterChange('Movimiento revertido.')" />
  </template>
</template>
