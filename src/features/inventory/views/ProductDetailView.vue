<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'

import { ApiError } from '@/core/api/errors'
import type { PaginationMeta } from '@/core/api/types'
import { useSessionStore } from '@/core/auth/session-store'
import EstablishmentFilter from '@/shared/establishments/EstablishmentFilter.vue'
import { useEstablishmentStore } from '@/shared/establishments/store'
import BaseAlert from '@/shared/ui/BaseAlert.vue'
import BaseBadge from '@/shared/ui/BaseBadge.vue'
import BaseButton from '@/shared/ui/BaseButton.vue'
import ProductThumb from '@/shared/ui/ProductThumb.vue'
import { formatMoney, formatQuantity } from '@/shared/utils/format'
import { inventoryApi } from '../api'
import AdjustStockDialog from '../components/AdjustStockDialog.vue'
import LotList from '../components/LotList.vue'
import MovementList from '../components/MovementList.vue'
import ProductPhotoEditor from '../components/ProductPhotoEditor.vue'
import ReverseMovementDialog from '../components/ReverseMovementDialog.vue'
import TransferStockDialog from '../components/TransferStockDialog.vue'
import { useInventoryCatalogs } from '../composables/useInventoryCatalogs'
import type { Lot, Movement, Product } from '../types'

const route = useRoute()
const session = useSessionStore()
const establishments = useEstablishmentStore()
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
const transferOpen = ref(false)
/** Local de los lotes y el historial (spec 017); `null` es «Todos». */
const establishmentFilter = ref(establishments.defaultFilter)

const isAdmin = computed(() => session.isCompanyAdmin)
const tracksStock = computed(() => product.value?.type === 'good')
const canTransfer = computed(() => isAdmin.value && tracksStock.value && establishments.multi)

/** «Stock por local», con el nombre de cada uno (también los inactivos, por su historial). */
const stockByEstablishment = computed(() =>
  (product.value?.stock_by_establishment ?? []).map((s) => ({ ...s, name: establishments.find(s.establishment_id)?.name ?? '' })),
)

if (route.query.guardado) notice.value = 'Producto guardado.'
if (route.query.entrada) notice.value = 'Entrada registrada.'
// El producto se creó pero su foto no se subió (spec 016, HU-1 esc. 7).
if (route.query.foto === 'pendiente') {
  warning.value = 'El producto se guardó, pero la foto no se pudo subir. Puedes intentarlo de nuevo en «Foto».'
}

async function load(movementsPage = 1) {
  try {
    product.value = await inventoryApi.getProduct(productId)
    if (!tracksStock.value) return

    const [lotList, movementPage] = await Promise.all([
      inventoryApi.lots(productId, false, establishmentFilter.value),
      isAdmin.value ? inventoryApi.movements(productId, movementsPage, establishmentFilter.value) : Promise.resolve(null),
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

function onPhotoUpdated(updated: Product, message: string) {
  product.value = updated
  notice.value = message
  warning.value = null
}

function afterTransfer(updated: Product) {
  product.value = updated
  afterChange('Traslado registrado.')
}

function afterChange(message: string) {
  notice.value = message
  warning.value = null
  load()
}

onMounted(() => {
  loadCatalogs()
  establishments.loadReadable()
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
        <BaseButton v-if="canTransfer" variant="secondary" data-test="open-transfer" @click="transferOpen = true">Trasladar</BaseButton>
        <RouterLink :to="{ name: 'product-edit', params: { id: product.id } }">
          <BaseButton variant="secondary" tabindex="-1">Editar</BaseButton>
        </RouterLink>
      </div>
    </div>

    <div class="mt-4 space-y-3">
      <BaseAlert v-if="notice" variant="success">{{ notice }}</BaseAlert>
      <BaseAlert v-if="warning" variant="warning">{{ warning }}</BaseAlert>
    </div>

    <!-- Spec 016: el administrador pone, cambia o quita la foto; los demás solo la ven. -->
    <ProductPhotoEditor v-if="isAdmin" :product="product" class="mt-4 rounded-xl border border-line bg-surface p-4" @updated="onPhotoUpdated" />
    <div v-else-if="product.image" class="mt-4 max-w-xs">
      <ProductThumb :image="product.image" :name="product.name" size="lg" />
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

    <template v-if="tracksStock && establishments.multi && stockByEstablishment.length > 0">
      <h2 class="mt-8 text-lg font-semibold">Stock por local</h2>
      <ul class="mt-3 divide-y divide-line rounded-xl border border-line bg-surface" data-test="stock-by-establishment">
        <li v-for="row in stockByEstablishment" :key="row.establishment_id" class="flex items-center justify-between gap-3 px-4 py-3">
          <span class="min-w-0 truncate">{{ row.name }}</span>
          <span class="shrink-0 text-right">
            <span class="block font-medium">{{ formatQuantity(row.available_stock) }}</span>
            <span class="text-xs text-ink-muted">disponible de {{ formatQuantity(row.stock) }}</span>
          </span>
        </li>
      </ul>
    </template>

    <template v-if="tracksStock">
      <div v-if="establishments.multi" class="mt-8 max-w-xs">
        <EstablishmentFilter id="detail-establishment" v-model="establishmentFilter" @change="load()" />
      </div>
      <h2 class="text-lg font-semibold" :class="establishments.multi ? 'mt-4' : 'mt-8'">Lotes</h2>
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
    <TransferStockDialog v-if="canTransfer" v-model:open="transferOpen" :product="product" :allows-decimals="allowsDecimals(product.unit)" @done="afterTransfer" />
  </template>
</template>
