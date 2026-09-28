/**
 * Persistencia del token de Sanctum.
 *
 * Se aísla en su propio módulo porque el almacenamiento cambia según el
 * destino: en web es `localStorage`, pero al empaquetar con Capacitor conviene
 * usar el almacenamiento seguro del dispositivo. Sustituir esa pieza no debería
 * obligar a tocar el cliente HTTP ni los stores.
 *
 * No se usa un store de Pinia porque el cliente HTTP necesita leer el token
 * fuera de un contexto de componente.
 */

const TOKEN_KEY = 'sunat.auth.token'

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
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    // Modo privado o almacenamiento bloqueado: se trabaja sin sesión persistida.
    return null
  }
}

export function setToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token)
  } catch {
    // Sin persistencia la sesión dura lo que dure la pestaña; no es un error fatal.
  }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY)
  } catch {
    // Nada que limpiar si el almacenamiento no está disponible.
  }

  clearedListeners.forEach((listener) => listener())
}
