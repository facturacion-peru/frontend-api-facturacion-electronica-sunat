import { formatDateTime } from '@/shared/utils/format'
import type { SalesDocument } from './types'

/**
 * Resultado de SUNAT de un comprobante, en palabras del usuario. Lo usan el
 * detalle del comprobante y la confirmación de «Vender» (spec 012 v1.4).
 */
export function documentResult(d: Pick<SalesDocument, 'status' | 'next_attempt_at' | 'discard_reason'>): {
  variant: 'success' | 'warning' | 'error' | 'info'
  text: string
} {
  switch (d.status) {
    case 'accepted':
      return { variant: 'success', text: 'SUNAT aceptó el comprobante.' }
    case 'observed':
      return { variant: 'success', text: 'SUNAT aceptó el comprobante con observaciones.' }
    case 'rejected':
      return { variant: 'error', text: 'SUNAT rechazó el comprobante. Revisa el motivo; no se reintenta.' }
    case 'discarded':
      return { variant: 'info', text: `Descartado: ${d.discard_reason}. Su stock se repuso y su número quedó usado.` }
    default:
      return {
        variant: 'warning',
        text: d.next_attempt_at
          ? `SUNAT no respondió. La venta y el número quedaron guardados; se reenviará automáticamente (próximo intento: ${formatDateTime(d.next_attempt_at)}).`
          : 'SUNAT no respondió y se agotaron los reintentos automáticos. Usa «Reintentar».',
      }
  }
}
