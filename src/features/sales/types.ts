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
