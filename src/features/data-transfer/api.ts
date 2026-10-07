import { apiClient } from '@/core/api/client'
import { downloadFile } from '@/core/api/download'
import { unwrapData } from '@/core/api/errors'
import type { ExportFormat, ImportKind, ImportMode, ImportPreview, ImportResult, SalesExportFilters } from './types'

/**
 * El generador de OpenAPI tipa todo parámetro de ruta como número; aquí son
 * `products`/`customers` y un UUID.
 */
const pathParam = (value: string) => value as unknown as number

/** Exportar e importar datos (spec 014): descargas con `downloadFile` (en Android, «Compartir»). */
export const dataTransferApi = {
  /** Ventas: dos hojas; en CSV llegan como un ZIP con un CSV por hoja. */
  exportSales: (filters: SalesExportFilters) => {
    const query = new URLSearchParams({ from: filters.from, to: filters.to, format: filters.format })
    filters.types.forEach((type) => query.append('types[]', type))
    filters.statuses.forEach((status) => query.append('statuses[]', status))
    const extension = filters.format === 'csv' ? 'zip' : 'xlsx'

    return downloadFile(`/api/v1/exports/sales?${query}`, `ventas-${filters.from}_${filters.to}.${extension}`)
  },

  exportProducts: (format: ExportFormat) => downloadFile(`/api/v1/exports/products?format=${format}&status=all`, `productos.${format}`),

  exportCustomers: (format: ExportFormat) => downloadFile(`/api/v1/exports/customers?format=${format}`, `clientes.${format}`),

  template: (kind: ImportKind) =>
    downloadFile(`/api/v1/imports/${kind}/template`, `plantilla-${kind === 'products' ? 'productos' : 'clientes'}.xlsx`),

  preview: (kind: ImportKind, file: File, mode: ImportMode) => {
    const form = new FormData()
    form.append('file', file)
    form.append('mode', mode)

    return unwrapData<ImportPreview>(
      apiClient.POST('/api/v1/imports/{kind}/preview', {
        params: { path: { kind: pathParam(kind) } },
        // Multipart: se envía el FormData tal cual, sin serializar a JSON.
        body: form as never,
        bodySerializer: (body) => body as unknown as FormData,
      }),
    )
  },

  confirm: (id: string) =>
    unwrapData<ImportResult>(apiClient.POST('/api/v1/imports/{preview}/confirm', { params: { path: { preview: pathParam(id) } } })),
}
