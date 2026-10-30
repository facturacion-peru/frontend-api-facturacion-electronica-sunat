import { pickWithInput } from './pick-image'
import { PrinterError } from './printer'
import type { Device } from './types'

const unsupported = async (): Promise<never> => {
  throw new PrinterError('unsupported', 'La impresión Bluetooth solo está en la app Android.')
}

/** La web de siempre: localStorage y descargas con un enlace. */
export const webDevice: Device = {
  isNative: false,
  appVersion: null,
  secureStore: {
    async get(key) {
      return localStorage.getItem(key)
    },
    async set(key, value) {
      localStorage.setItem(key, value)
    },
    async remove(key) {
      localStorage.removeItem(key)
    },
  },
  async deliverFile(blob, filename, { open = false } = {}) {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    if (open) {
      link.target = '_blank'
      link.rel = 'noopener'
    } else {
      link.download = filename
    }
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  },
  onConnectionChange(handler) {
    const online = () => handler(true)
    const offline = () => handler(false)
    handler(navigator.onLine)
    window.addEventListener('online', online)
    window.addEventListener('offline', offline)
    return () => {
      window.removeEventListener('online', online)
      window.removeEventListener('offline', offline)
    }
  },
  onBackButton() {
    return () => {}
  },
  async minimize() {},
  pickImage: pickWithInput,
  printer: {
    available: false,
    async status() {
      return { supported: false, enabled: false }
    },
    listPaired: unsupported,
    print: unsupported,
    openSettings: unsupported,
    requestEnable: unsupported,
  },
}
