import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

import type { PairedPrinter } from '@/core/device'

/**
 * Impresora térmica elegida en este teléfono (spec 015, A-76 y A-78): equipo,
 * ancho del papel, modo del QR e «Imprimir al cobrar». Es del teléfono, no de
 * la empresa ni del usuario: no se borra al cerrar sesión (HU-1, esc. 5).
 * Solo guarda el nombre y la dirección Bluetooth, que no son datos sensibles.
 */
export type PaperWidth = 58 | 80
export type QrMode = 'native' | 'image'

const KEY = 'sunat.printer'
const VERSION = 1

interface Stored {
  v: number
  address: string
  name: string
  width: PaperWidth
  qr: QrMode
  autoPrint: boolean
}

/** Lo guardado, si es válido; dañado, de otra versión o sin almacenamiento: nada. */
function read(): Stored | null {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Stored> | null
    if (
      stored?.v === VERSION &&
      typeof stored.address === 'string' &&
      typeof stored.name === 'string' &&
      (stored.width === 58 || stored.width === 80) &&
      (stored.qr === 'native' || stored.qr === 'image')
    ) {
      return { ...(stored as Stored), autoPrint: stored.autoPrint === true }
    }
  } catch {
    // Se empieza sin impresora.
  }
  return null
}

export const usePrinterSettingsStore = defineStore('printer-settings', () => {
  const stored = read()

  const printer = ref<PairedPrinter | null>(stored ? { name: stored.name, address: stored.address } : null)
  // 58 mm: el papel más común en bodegas (A-75).
  const width = ref<PaperWidth>(stored?.width ?? 58)
  const qr = ref<QrMode>(stored?.qr ?? 'native')
  const autoPrint = ref(stored?.autoPrint ?? false)

  const configured = computed(() => printer.value !== null)

  function choose(device: PairedPrinter) {
    printer.value = { name: device.name, address: device.address }
  }

  function forget() {
    printer.value = null
    autoPrint.value = false
  }

  watch([printer, width, qr, autoPrint], () => {
    try {
      if (!printer.value) {
        localStorage.removeItem(KEY)
        return
      }
      const data: Stored = { v: VERSION, ...printer.value, width: width.value, qr: qr.value, autoPrint: autoPrint.value }
      localStorage.setItem(KEY, JSON.stringify(data))
    } catch {
      // Sin almacenamiento: vale hasta cerrar la app.
    }
  })

  return { printer, width, qr, autoPrint, configured, choose, forget }
})
