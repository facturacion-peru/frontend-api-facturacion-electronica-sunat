import { apiClient } from '@/core/api/client'
import { downloadFile } from '@/core/api/download'
import { unwrap, unwrapData } from '@/core/api/errors'
import type { CollectionResponse, PaginatedResponse } from '@/core/api/types'
import type {
  Customer,
  CustomerForm,
  IssuingAvailability,
  NewSalesDocumentPayload,
  NewTicketPayload,
  SalesDocument,
  SalesDocumentFilters,
  Ticket,
  TicketFilters,
  TicketTotals,
} from './types'

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

export const salesDocumentsApi = {
  issue: async (body: NewSalesDocumentPayload) =>
    (await unwrap<{ data: SalesDocument }>(apiClient.POST('/api/v1/sales-documents', { body }))).data,

  list: (filters: SalesDocumentFilters) =>
    unwrap<PaginatedResponse<SalesDocument> & { counts: { pending: number; rejected: number } }>(
      apiClient.GET('/api/v1/sales-documents', {
        params: {
          query: {
            ...(filters.from && { from: filters.from }),
            ...(filters.to && { to: filters.to }),
            ...(filters.document_type && { document_type: filters.document_type }),
            ...(filters.status && { status: filters.status }),
            ...(filters.customer && { customer: filters.customer }),
            page: filters.page,
          },
        },
      }),
    ),

  get: (id: number) =>
    unwrapData<SalesDocument>(apiClient.GET('/api/v1/sales-documents/{salesDocument}', { params: { path: { salesDocument: id } } })),

  retry: (id: number) =>
    unwrapData<SalesDocument>(apiClient.POST('/api/v1/sales-documents/{salesDocument}/retry', { params: { path: { salesDocument: id } } })),

  /** PDF en una pestaña nueva; XML y CDR como descarga. */
  download: (document: SalesDocument, file: 'a4' | '80mm' | 'xml' | 'cdr') =>
    file === 'xml' || file === 'cdr'
      ? downloadFile(`/api/v1/sales-documents/${document.id}/${file}`, `${document.display_number}${file === 'cdr' ? '-cdr.zip' : '.xml'}`)
      : downloadFile(`/api/v1/sales-documents/${document.id}/pdf?format=${file}`, `${document.display_number}-${file}.pdf`, { open: true }),

  /** Estado SUNAT y series activas, para habilitar Boleta y Factura en «Vender». */
  availability: async (): Promise<IssuingAvailability> => {
    const [status, series] = await Promise.all([
      unwrapData<{ can_issue: boolean; status_label: string }>(apiClient.GET('/api/v1/sunat/status')),
      unwrap<CollectionResponse<IssuingAvailability['series'][number]>>(apiClient.GET('/api/v1/series')),
    ])

    return { can_issue: status.can_issue, status_label: status.status_label, series: series.data.filter((s) => s.active) }
  },
}

export const customersApi = {
  search: async (search: string) =>
    (await unwrap<PaginatedResponse<Customer>>(apiClient.GET('/api/v1/customers', { params: { query: { search } } }))).data,

  list: (search: string, page: number) =>
    unwrap<PaginatedResponse<Customer>>(apiClient.GET('/api/v1/customers', { params: { query: { search, page } } })),

  create: (body: CustomerForm) => unwrapData<Customer>(apiClient.POST('/api/v1/customers', { body })),

  update: (id: number, body: Partial<CustomerForm>) =>
    unwrapData<Customer>(apiClient.PATCH('/api/v1/customers/{customer}', { params: { path: { customer: id } }, body })),
}
