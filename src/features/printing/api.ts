import { fetchFile } from '@/core/api/download'
import type { PaperWidth, QrMode } from './stores/printer-settings'

/** Ancho y modo de QR de la impresora del teléfono (spec 015). */
export interface PrintOptions {
  width: PaperWidth
  qr: QrMode
}

/** Bytes ESC/POS que arma la API (principio II): la app solo los envía a la impresora. */
async function bytes(path: string, options: PrintOptions): Promise<Uint8Array> {
  const blob = await fetchFile(`${path}?width=${options.width}&qr=${options.qr}`)
  return new Uint8Array(await blob.arrayBuffer())
}

export const printingApi = {
  ticket: (id: number, options: PrintOptions) => bytes(`/api/v1/tickets/${id}/print`, options),
  document: (id: number, options: PrintOptions) => bytes(`/api/v1/sales-documents/${id}/print`, options),
  testPage: (options: PrintOptions) => bytes('/api/v1/printing/test-page', options),
}
