/** Refleja App\Http\Resources\TicketResource (tests/Feature/Contract/TicketResourceTest). */

export type PaymentMethod = 'cash' | 'card' | 'yape_plin' | 'transfer'
export type TicketStatus = 'issued' | 'voided'

export interface TicketLine {
  product_id: number | null
  product_code: string
  product_name: string
  unit: string
  quantity: string
  unit_price: string
  gross_amount: string
  discount: string
  amount: string
}

export interface Ticket {
  id: number
  number: number
  display_number: string
  status: TicketStatus
  legal_notice: string
  seller: { id: number; name: string } | null
  customer_name: string | null
  customer_label: string
  customer_document: string | null
  payment_method: PaymentMethod
  subtotal: string
  discount_total: string
  total: string
  issued_at: string
  voided_at: string | null
  void_reason: string | null
  lines?: TicketLine[]
}

export interface TicketTotals {
  count: number
  total: string
  by_payment_method: Record<PaymentMethod, string>
}

export interface TicketFilters {
  from: string
  to: string
  status: '' | TicketStatus
  payment_method: '' | PaymentMethod
  page: number
}

export interface NewTicketPayload {
  idempotency_key: string
  payment_method: PaymentMethod
  customer_name?: string
  customer_document?: string
  lines: { product_id: number; quantity: string; discount?: string }[]
}

export const paymentLabels: Record<PaymentMethod, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  yape_plin: 'Yape / Plin',
  transfer: 'Transferencia',
}

/* ── Comprobantes electrónicos (spec 005) ─────────────────────────────── */

export type DocumentType = '01' | '03'
export type SalesDocumentStatus = 'pending' | 'sent' | 'accepted' | 'observed' | 'rejected'
export type CustomerDocumentType = '1' | '4' | '6'
/** Qué se emite desde «Vender» (A-33). */
export type SaleKind = 'ticket' | DocumentType

/** Refleja App\Http\Resources\CustomerResource. */
export interface Customer {
  id: number
  document_type: CustomerDocumentType
  document_type_label: string
  document_number: string
  name: string
  address: string | null
}

export interface CustomerForm {
  document_type: CustomerDocumentType
  document_number: string
  name: string
  address: string | null
}

export interface SalesDocumentLine {
  position: number
  product_code: string
  product_name: string
  unit: string
  igv_affectation: '10' | '20' | '30'
  quantity: string
  unit_price: string
  discount: string
  base_amount: string
  igv: string
  amount: string
}

export interface SunatSubmission {
  trigger: 'issue' | 'scheduled' | 'manual'
  started_at: string
  duration_ms: number
  result: 'accepted' | 'observed' | 'rejected' | 'unreachable' | 'error'
  code: string | null
  message: string | null
}

/** Refleja App\Http\Resources\SalesDocumentResource (tests/Feature/Contract/SalesDocumentResourcesTest). */
export interface SalesDocument {
  id: number
  document_type: DocumentType
  document_type_label: string
  series_code: string
  number: number
  display_number: string
  environment: 'beta'
  environment_notice: string
  issued_at: string
  seller: { id: number; name: string } | null
  payment_method: PaymentMethod
  currency: 'PEN'
  customer: { id: number | null; document_type: string; document_number: string; name: string; address: string | null }
  op_gravadas: string
  op_exoneradas: string
  op_inafectas: string
  igv: string
  discount_total: string
  total: string
  status: SalesDocumentStatus
  status_label: string
  sunat_code: string | null
  sunat_message: string | null
  sunat_notes: string[]
  hash: string
  has_cdr: boolean
  attempts: number
  next_attempt_at: string | null
  can_retry: boolean
  lines?: SalesDocumentLine[]
  submissions?: SunatSubmission[]
}

export interface SalesDocumentFilters {
  from: string
  to: string
  document_type: '' | DocumentType
  status: '' | SalesDocumentStatus
  customer: string
  page: number
}

export interface NewSalesDocumentPayload {
  idempotency_key: string
  document_type: DocumentType
  series_id?: number | null
  customer_id?: number | null
  payment_method: PaymentMethod
  lines: { product_id: number; quantity: string; discount?: string }[]
}

/** Lo mínimo del estado SUNAT y de las series que necesita «Vender» (endpoints de la 004). */
export interface IssuingAvailability {
  can_issue: boolean
  status_label: string
  series: { id: number; document_type: DocumentType; code: string; active: boolean }[]
}

export const documentStatusVariant: Record<SalesDocumentStatus, 'neutral' | 'success' | 'warning' | 'danger' | 'info'> = {
  pending: 'warning',
  sent: 'info',
  accepted: 'success',
  observed: 'success',
  rejected: 'danger',
}

export const customerDocumentLabels: Record<string, string> = { '0': 'Sin documento', '1': 'DNI', '4': 'Carné de extranjería', '6': 'RUC' }

/** Tope para una boleta sin identificar al comprador (A-22 ⚖️); lo hace cumplir la API. */
export const ANONYMOUS_RECEIPT_LIMIT = '700.00'
