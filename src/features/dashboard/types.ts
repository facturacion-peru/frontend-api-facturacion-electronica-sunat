/**
 * Respuesta de GET /api/v1/dashboard (spec 011). El OpenAPI no documenta
 * respuestas: se tipa a mano y la protege DashboardResourceTest en la API.
 * Los montos son cadenas decimales; aquí solo se muestran (principio II).
 */

export interface DashboardDay {
  date: string
  total: string
  count: number
}

export interface RecentSale {
  kind: 'ticket' | 'document'
  id: number
  number: string
  document_type: '01' | '03' | '07' | null
  customer_name: string | null
  total: string
  status: string
  issued_at: string
}

export interface DashboardSummary {
  date: string
  /** `own`: el vendedor ve solo lo suyo (A-53). */
  scope: 'company' | 'own'
  today: { total: string; count: number }
  last_7_days: DashboardDay[]
  attention: {
    pending_documents: number
    rejected_documents: number
    /** `null` para el vendedor. */
    inventory_alerts: number | null
  }
  recent_sales: RecentSale[]
}

type Variant = 'neutral' | 'success' | 'warning' | 'danger' | 'info'

/** Etiquetas propias: una feature no importa de otra (principio V). */
export const saleStatus: Record<string, { label: string; variant: Variant }> = {
  issued: { label: 'Emitido', variant: 'success' },
  voided: { label: 'Anulado', variant: 'neutral' },
  pending: { label: 'Pendiente', variant: 'warning' },
  sent: { label: 'Enviado', variant: 'info' },
  accepted: { label: 'Aceptado', variant: 'success' },
  observed: { label: 'Con observaciones', variant: 'success' },
  rejected: { label: 'Rechazado', variant: 'danger' },
  discarded: { label: 'Descartado', variant: 'neutral' },
}

/** Rótulos cortos: en escritorio la columna de últimas ventas es angosta. */
export const documentTypeLabels: Record<string, string> = { '01': 'Factura', '03': 'Boleta', '07': 'N. crédito' }
