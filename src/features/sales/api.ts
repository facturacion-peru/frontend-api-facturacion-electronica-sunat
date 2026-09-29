import { apiClient } from '@/core/api/client'
import { unwrap, unwrapData } from '@/core/api/errors'
import type { PaginatedResponse } from '@/core/api/types'
import type { NewTicketPayload, Ticket, TicketFilters, TicketTotals } from './types'

/** Producto vendible para la pantalla de venta. Llamada propia: una feature no importa de otra. */
export interface SellableProduct {
  id: number
  code: string
  name: string
  type: 'good' | 'service'
  unit: string
  sale_price: string
  available_stock: string | null
}

export const salesApi = {
  searchProducts: async (search: string) =>
    (
      await unwrap<PaginatedResponse<SellableProduct>>(
        apiClient.GET('/api/v1/products', { params: { query: { search, status: 'active' } } }),
      )
    ).data,

  issue: async (body: NewTicketPayload) => {
    const response = await unwrap<{ data: Ticket }>(apiClient.POST('/api/v1/tickets', { body }))

    return response.data
  },

  list: (filters: TicketFilters) =>
    unwrap<PaginatedResponse<Ticket> & { totals: TicketTotals }>(
      apiClient.GET('/api/v1/tickets', {
        params: {
          query: {
            ...(filters.from && { from: filters.from }),
            ...(filters.to && { to: filters.to }),
            ...(filters.status && { status: filters.status }),
            ...(filters.payment_method && { payment_method: filters.payment_method }),
            page: filters.page,
          },
        },
      }),
    ),

  get: (id: number) => unwrapData<Ticket>(apiClient.GET('/api/v1/tickets/{ticket}', { params: { path: { ticket: id } } })),

  void: (id: number, reason: string) =>
    unwrapData<Ticket>(apiClient.POST('/api/v1/tickets/{ticket}/void', { params: { path: { ticket: id } }, body: { reason } })),
}
