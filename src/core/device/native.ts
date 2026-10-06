import { SecureStorage } from '@aparajita/capacitor-secure-storage'
import { App } from '@capacitor/app'
import { Directory, Filesystem } from '@capacitor/filesystem'
import { Network } from '@capacitor/network'
import { Share } from '@capacitor/share'

import type { Device } from './types'

/** Contenido del Blob en base64, como lo espera Filesystem. */
function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',', 2)[1] ?? '')
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

/** App Android (spec 013): Keystore, «Compartir», botón «Atrás» y versión instalada. */
export async function createNativeDevice(): Promise<Device> {
  const { version } = await App.getInfo()

  return {
    isNative: true,
    appVersion: version,
    secureStore: {
      get: (key) => SecureStorage.getItem(key),
      set: (key, value) => SecureStorage.setItem(key, value),
      remove: (key) => SecureStorage.removeItem(key),
    },
    async deliverFile(blob, filename) {
      // El archivo va a la caché de la app; «Compartir» ofrece imprimir,
      // abrirlo con la app de la impresora, WhatsApp o guardarlo (A-63).
      const { uri } = await Filesystem.writeFile({ path: filename, data: await toBase64(blob), directory: Directory.Cache })
      try {
        await Share.share({ title: filename, files: [uri] })
      } catch {
        // El usuario cerró «Compartir» sin elegir: no es un error.
      }
    },
    onConnectionChange(handler) {
      void Network.getStatus().then((status) => handler(status.connected))
      const listener = Network.addListener('networkStatusChange', (status) => handler(status.connected))
      return () => void listener.then((l) => l.remove())
    },
    onBackButton(handler) {
      const listener = App.addListener('backButton', handler)
      return () => void listener.then((l) => l.remove())
    },
    async minimize() {
      await App.minimizeApp()
    },
  }
}
