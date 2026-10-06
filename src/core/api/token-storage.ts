/**
 * Persistencia del token de Sanctum.
 *
 * Se aísla en su propio módulo porque el almacenamiento cambia según el
 * destino: en la web es `localStorage`; en la app Android, el almacén seguro
 * del dispositivo (spec 013, A-64), que es asíncrono: el cliente HTTP lee
 * una copia en memoria que `initTokenStorage()` carga al arrancar.
 *
 * No se usa un store de Pinia porque el cliente HTTP necesita leer el token
 * fuera de un contexto de componente.
 */

import { device } from '@/core/device'

const TOKEN_KEY = 'sunat.auth.token'

/** Copia en memoria del token de la app Android; undefined en la web. */
let nativeToken: string | null | undefined

/** Carga el token del almacén seguro (solo en la app). Llamar antes de montar. */
export async function initTokenStorage(): Promise<void> {
  if (!device().isNative) return
  try {
    nativeToken = await device().secureStore.get(TOKEN_KEY)
  } catch {
    // Keystore ilegible (p. ej. tras restaurar el teléfono): se entra de nuevo.
    nativeToken = null
  }
}

type Listener = () => void
const clearedListeners = new Set<Listener>()

/**
 * Avisa cuando se descarta el token (logout o 401 en cualquier petición).
 * Así la sesión reacciona sin que el cliente HTTP conozca los stores.
 * Devuelve la función para dejar de escuchar.
 */
export function onTokenCleared(listener: Listener): () => void {
  clearedListeners.add(listener)

  return () => clearedListeners.delete(listener)
}

export function getToken(): string | null {
  if (nativeToken !== undefined) return nativeToken
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    // Modo privado o almacenamiento bloqueado: se trabaja sin sesión persistida.
    return null
  }
}

export function setToken(token: string): void {
  if (nativeToken !== undefined) {
    nativeToken = token
    device().secureStore.set(TOKEN_KEY, token).catch(() => {})
    return
  }
  try {
    localStorage.setItem(TOKEN_KEY, token)
  } catch {
    // Sin persistencia la sesión dura lo que dure la pestaña; no es un error fatal.
  }
}

export function clearToken(): void {
  if (nativeToken !== undefined) {
    nativeToken = null
    device().secureStore.remove(TOKEN_KEY).catch(() => {})
  } else {
    try {
      localStorage.removeItem(TOKEN_KEY)
    } catch {
      // Nada que limpiar si el almacenamiento no está disponible.
    }
  }

  clearedListeners.forEach((listener) => listener())
}
