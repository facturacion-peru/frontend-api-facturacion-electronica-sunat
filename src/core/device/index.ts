import { Capacitor } from '@capacitor/core'

import type { Device } from './types'
import { webDevice } from './web'

export type { Device } from './types'

let current: Device = webDevice

/** Dispositivo actual. Hasta `initDevice()`, el de la web. */
export function device(): Device {
  return current
}

/**
 * Elige la implementación al arrancar (`main.ts`, antes de montar). La de
 * Android se carga aparte: la web no descarga sus plugins.
 */
export async function initDevice(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    current = await (await import('./native')).createNativeDevice()
  }
}
