import { computed, ref } from 'vue'

import { ApiError } from '@/core/api/errors'
import { device, PrinterError, type PrinterErrorCode } from '@/core/device'
import { printingApi, type PrintOptions } from '../api'
import { usePrinterSettingsStore } from '../stores/printer-settings'

/**
 * «Imprimir» de la spec 015. Con una impresora elegida en la app Android, pide
 * los bytes a la API y los envía por Bluetooth. Sin ella, hace lo de siempre:
 * el navegador imprime el ticket en la web (spec 003) y el PDF de 80 mm se
 * comparte en la app o se abre en la web (spec 013). Imprimir nunca cambia la
 * venta (RF-004), así que se puede reintentar sin riesgo.
 */
export interface PrintFailure {
  /** `api`: no se pudieron pedir los bytes (sin internet, sesión vencida…). */
  code: PrinterErrorCode | 'api'
  message: string
}

/** Lo que hay que hacer si no hay impresora Bluetooth. */
export interface PrintFallback {
  /** PDF de 80 mm: «Compartir» en la app, otra pestaña en la web. */
  pdf: () => Promise<void>
  /** Impresión del navegador (solo el ticket, solo en la web). */
  web?: () => void | Promise<void>
}

const MESSAGES: Record<PrinterErrorCode, string> = {
  connect_failed: 'No se pudo conectar con la impresora. Revisa que esté encendida y cerca del teléfono.',
  bluetooth_off: 'El Bluetooth del teléfono está apagado.',
  not_paired: 'La impresora ya no está emparejada con este teléfono.',
  permission_denied: 'La app no tiene permiso para usar el Bluetooth («Dispositivos cercanos»).',
  write_failed: 'Se cortó la impresión. Revisa el papel y la batería de la impresora, y vuelve a intentarlo.',
  unsupported: 'Este teléfono no tiene Bluetooth.',
  invalid: 'No se pudo imprimir.',
  unknown: 'No se pudo imprimir.',
}

function toFailure(error: unknown): PrintFailure {
  if (error instanceof PrinterError) return { code: error.code, message: MESSAGES[error.code] }
  return { code: 'api', message: error instanceof ApiError ? error.message : 'No se pudo obtener el documento para imprimir.' }
}

export function usePrinting() {
  const settings = usePrinterSettingsStore()

  const busy = ref(false)
  const failure = ref<PrintFailure | null>(null)
  /** El PDF no se pudo abrir o compartir. */
  const error = ref<string | null>(null)

  /** true si «Imprimir» va directo a la impresora Bluetooth. */
  const direct = computed(() => device().printer.available && settings.configured)

  let last: { load: (options: PrintOptions) => Promise<Uint8Array>; pdf: (() => Promise<void>) | null } | null = null

  async function send(load: (options: PrintOptions) => Promise<Uint8Array>, pdf: (() => Promise<void>) | null) {
    if (busy.value || !settings.printer) return
    last = { load, pdf }
    busy.value = true
    failure.value = null
    error.value = null
    try {
      const bytes = await load({ width: settings.width, qr: settings.qr })
      await device().printer.print(settings.printer.address, bytes)
    } catch (e) {
      failure.value = toFailure(e)
    } finally {
      busy.value = false
    }
  }

  async function openPdf(pdf: () => Promise<void>) {
    if (busy.value) return
    busy.value = true
    error.value = null
    try {
      await pdf()
    } catch (e) {
      error.value = e instanceof ApiError ? e.message : 'No se pudo abrir el PDF.'
    } finally {
      busy.value = false
    }
  }

  async function printTicket(id: number, fallback: PrintFallback) {
    if (direct.value) return send((options) => printingApi.ticket(id, options), fallback.pdf)
    if (!device().isNative && fallback.web) return fallback.web()
    return openPdf(fallback.pdf)
  }

  async function printDocument(id: number, fallback: Pick<PrintFallback, 'pdf'>) {
    if (direct.value) return send((options) => printingApi.document(id, options), fallback.pdf)
    return openPdf(fallback.pdf)
  }

  function printTestPage() {
    return send((options) => printingApi.testPage(options), null)
  }

  async function retry() {
    if (last) await send(last.load, last.pdf)
  }

  async function sharePdf() {
    const pdf = last?.pdf
    failure.value = null
    if (pdf) await openPdf(pdf)
  }

  function dismiss() {
    failure.value = null
    error.value = null
  }

  return { direct, busy, failure, error, printTicket, printDocument, printTestPage, retry, sharePdf, dismiss }
}
