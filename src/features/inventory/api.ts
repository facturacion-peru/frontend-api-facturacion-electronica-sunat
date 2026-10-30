import { apiClient } from '@/core/api/client'
import { downloadFile } from '@/core/api/download'
import { unwrap, unwrapData } from '@/core/api/errors'
import { uploadForm, type UploadOptions } from '@/core/api/upload'
import type { CollectionResponse, PaginatedResponse, ResourceResponse } from '@/core/api/types'
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
  TransferPayload,
} from './types'

export const inventoryApi = {
  /** Catálogo con stock y los filtros de la lista (spec 014). En CSV con lotes llega un ZIP. */
  exportProducts: (filters: ProductFilters, format: 'xlsx' | 'csv', lots: boolean) => {
    const query = new URLSearchParams({ format, status: filters.status, lots: lots ? '1' : '0' })
    if (filters.search) query.set('search', filters.search)
    if (filters.type) query.set('type', filters.type)
    if (filters.establishment_id) query.set('establishment_id', String(filters.establishment_id))

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
            ...(filters.establishment_id && { establishment_id: filters.establishment_id }),
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

  /** Sube la foto ya reducida (spec 016); va aparte de guardar el producto (RF-010). */
  uploadImage: async (id: number, photo: File, options?: UploadOptions) => {
    const form = new FormData()
    form.append('image', photo)

    return (await uploadForm<ResourceResponse<Product>>(`/api/v1/products/${id}/image`, form, options)).data
  },

  removeImage: (id: number) =>
    unwrapData<Product>(apiClient.DELETE('/api/v1/products/{product}/image', { params: { path: { product: id } } })),

  /** `establishmentId` null: los lotes de todos los locales que puede leer (spec 017). */
  lots: async (id: number, includeEmpty = false, establishmentId: number | null = null) =>
    (
      await unwrap<CollectionResponse<Lot>>(
        apiClient.GET('/api/v1/products/{product}/lots', {
          params: {
            path: { product: id },
            query: {
              // La regla `boolean` de Laravel no acepta «true»: va como 1.
              ...(includeEmpty && { include_empty: 1 as unknown as boolean }),
              ...(establishmentId && { establishment_id: establishmentId }),
            },
          },
        }),
      )
    ).data,

  movements: (id: number, page = 1, establishmentId: number | null = null) =>
    unwrap<PaginatedResponse<Movement>>(
      apiClient.GET('/api/v1/products/{product}/movements', {
        params: { path: { product: id }, query: { page, ...(establishmentId && { establishment_id: establishmentId }) } },
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

  alerts: (establishmentId: number | null = null) =>
    unwrapData<InventoryAlerts>(
      apiClient.GET('/api/v1/inventory/alerts', { params: { query: establishmentId ? { establishment_id: establishmentId } : {} } }),
    ),

  /** Traslado entre locales (spec 017, HU-3); devuelve el producto con `stock_by_establishment`. */
  transfer: (id: number, body: TransferPayload) =>
    unwrapData<Product>(apiClient.POST('/api/v1/products/{product}/transfers', { params: { path: { product: id } }, body })),
}
