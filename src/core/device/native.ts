import { SecureStorage } from '@aparajita/capacitor-secure-storage'
import { App } from '@capacitor/app'
import { Directory, Filesystem } from '@capacitor/filesystem'
import { Network } from '@capacitor/network'
import { Share } from '@capacitor/share'
import { registerPlugin, type PermissionState } from '@capacitor/core'

import { pickWithInput } from './pick-image'
import { type PairedPrinter, PrinterError } from './printer'
import type { Device } from './types'

/** Plugin propio de la spec 015: android/app/src/main/java/…/printer/BluetoothPrinterPlugin.java. */
interface BluetoothPrinterPlugin {
  checkPermissions(): Promise<{ bluetooth: PermissionState }>
  requestPermissions(): Promise<{ bluetooth: PermissionState }>
  status(): Promise<{ supported: boolean; enabled: boolean }>
  listPaired(): Promise<{ devices: PairedPrinter[] }>
  print(options: { address: string; data: string }): Promise<void>
  openSettings(): Promise<void>
  requestEnable(): Promise<{ enabled: boolean }>
}

/** Contenido del Blob en base64, como lo espera Filesystem. */
function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',', 2)[1] ?? '')
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

/** Bytes en base64, por partes para no pasar el límite de argumentos de fromCharCode. */
function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(binary)
}

/** Llama al plugin y traduce su rechazo a PrinterError. */
async function bluetooth<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call()
  } catch (error) {
    throw PrinterError.from(error)
  }
}

/** App Android (spec 013): Keystore, «Compartir», botón «Atrás» y versión instalada. */
export async function createNativeDevice(): Promise<Device> {
  const { version } = await App.getInfo()
  const printer = registerPlugin<BluetoothPrinterPlugin>('BluetoothPrinter')

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
    async pickImage(source) {
      const file = await pickWithInput(source)
      if (!file || source !== 'camera') return file

      // Capacitor guarda la foto de la cámara en files/Pictures del almacenamiento
      // externo de la app y no la borra; puede traer GPS (F002). Se copia a memoria
      // y se borra el archivo.
      const copy = new File([await file.arrayBuffer()], file.name, { type: file.type })
      try {
        await Filesystem.deleteFile({ path: `Pictures/${file.name}`, directory: Directory.External })
      } catch {
        // Si no se pudo borrar, la foto igual sirve.
      }
      return copy
    },
    printer: {
      available: true,
      status: () => bluetooth(() => printer.status()),
      async listPaired() {
        let { bluetooth: permission } = await bluetooth(() => printer.checkPermissions())
        if (permission !== 'granted') ({ bluetooth: permission } = await bluetooth(() => printer.requestPermissions()))
        if (permission !== 'granted') throw new PrinterError('permission_denied', 'Sin permiso de Bluetooth.')
        return (await bluetooth(() => printer.listPaired())).devices
      },
      print: (address, bytes) => bluetooth(() => printer.print({ address, data: bytesToBase64(bytes) })),
      openSettings: () => bluetooth(() => printer.openSettings()),
      requestEnable: async () => (await bluetooth(() => printer.requestEnable())).enabled,
    },
  }
}
