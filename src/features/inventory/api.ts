import { apiClient } from '@/core/api/client'
import { downloadFile } from '@/core/api/download'
import { unwrap, unwrapData } from '@/core/api/errors'
import type { CollectionResponse, PaginatedResponse } from '@/core/api/types'
import type {
  AdjustmentReason,
  InventoryAlerts,
  InventoryCatalogs,
  Lot,
  Movement,
  Product,
  ProductFilters,
  ProductPayload,
  StockEntryPayload,
} from './types'

export const inventoryApi = {
  /** Catálogo con stock y los filtros de la lista (spec 014). En CSV con lotes llega un ZIP. */
  exportProducts: (filters: ProductFilters, format: 'xlsx' | 'csv', lots: boolean) => {
    const query = new URLSearchParams({ format, status: filters.status, lots: lots ? '1' : '0' })
    if (filters.search) query.set('search', filters.search)
    if (filters.type) query.set('type', filters.type)

    return downloadFile(`/api/v1/exports/products?${query}`, `productos.${format === 'csv' && lots ? 'zip' : format}`)
  },

  catalogs: () => unwrapData<InventoryCatalogs>(apiClient.GET('/api/v1/catalogs/inventory')),

  listProducts: (filters: ProductFilters) =>
    unwrap<PaginatedResponse<Product>>(
      apiClient.GET('/api/v1/products', {
        params: {
          query: {
            ...(filters.search && { search: filters.search }),
            ...(filters.type && { type: filters.type }),
            status: filters.status,
            page: filters.page,
          },
        },
      }),
    ),

  getProduct: (id: number) =>
    unwrapData<Product>(apiClient.GET('/api/v1/products/{product}', { params: { path: { product: id } } })),

  createProduct: (body: ProductPayload) => unwrapData<Product>(apiClient.POST('/api/v1/products', { body })),

  /** Devuelve también el aviso de la API (p. ej. desactivar con stock). */
  updateProduct: async (id: number, body: Partial<ProductPayload>) => {
    const response = await unwrap<{ data: Product; warning?: string }>(
      apiClient.PATCH('/api/v1/products/{product}', { params: { path: { product: id } }, body }),
    )

    return { product: response.data, warning: response.warning ?? null }
  },

  lots: async (id: number, includeEmpty = false) =>
    (
      await unwrap<CollectionResponse<Lot>>(
        apiClient.GET('/api/v1/products/{product}/lots', {
          params: { path: { product: id }, query: includeEmpty ? ({ include_empty: 1 } as never) : undefined },
        }),
      )
    ).data,

  movements: (id: number, page = 1) =>
    unwrap<PaginatedResponse<Movement>>(
      apiClient.GET('/api/v1/products/{product}/movements', {
        params: { path: { product: id }, query: { page } as never },
      }),
    ),

  registerEntry: async (id: number, body: StockEntryPayload) => {
    const response = await unwrap<{ data: Lot; product_stock: string }>(
      apiClient.POST('/api/v1/products/{product}/entries', { params: { path: { product: id } }, body }),
    )

    return { lot: response.data, productStock: response.product_stock }
  },

  adjust: (lotId: number, body: { quantity: string; reason: AdjustmentReason; note?: string }) =>
    unwrapData<Movement>(apiClient.POST('/api/v1/lots/{lot}/adjustments', { params: { path: { lot: lotId } }, body })),

  reverse: (movementId: number, body: { reason: AdjustmentReason; note?: string }) =>
    unwrapData<Movement>(
      apiClient.POST('/api/v1/movements/{movement}/reverse', { params: { path: { movement: movementId } }, body }),
    ),

  alerts: () => unwrapData<InventoryAlerts>(apiClient.GET('/api/v1/inventory/alerts')),
}
