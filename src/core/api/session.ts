import { device } from '@/core/device'
import { updateRequired } from './app-update'
import { clearToken, getToken } from './token-storage'

/**
 * Lo que toda petición a la API comparte, salga de openapi-fetch, de una
 * descarga o de una subida con avance (spec 016): las cabeceras de sesión y
 * la reacción a 401 y 426.
 */

/** Token de Sanctum, `Accept` y, en la app Android, su versión (spec 013, A-67). */
export function sessionHeaders(accept = 'application/json'): Record<string, string> {
  const headers: Record<string, string> = { Accept: accept }

  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`

  const version = device().appVersion
  if (version) headers['X-App-Version'] = version

  return headers
}

/**
 * 401: el token caducó y se descarta (al login lleva el guard del router).
 * 426: la app está desactualizada; se pide actualizar sin cerrar la sesión.
 */
export function handleSessionStatus(status: number, body: unknown): void {
  if (status === 401) clearToken()

  if (status === 426) {
    updateRequired.value = (body as { min_version?: string } | null)?.min_version ?? '?'
  }
}
