import { env } from '@/core/config/env'
import { device } from '@/core/device'
import { ApiError, NETWORK_MESSAGE } from './errors'
import { sessionHeaders } from './session'

/** Pide un archivo de la API con la sesión; lanza ApiError si falla. También lo usa la impresión (spec 015). */
export async function fetchFile(path: string): Promise<Blob> {
  let response: Response

  try {
    response = await fetch(`${env.apiBaseUrl}${path}`, {
      headers: sessionHeaders('*/*'),
    })
  } catch {
    throw new ApiError(0, NETWORK_MESSAGE)
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: string }
    throw new ApiError(response.status, body.message ?? 'No se pudo descargar el archivo.')
  }

  return response.blob()
}

/**
 * Descarga un archivo de la API (PDF, XML, CDR). Un enlace directo no lleva
 * la cabecera Authorization, así que se pide con fetch y se entrega como Blob:
 * descarga en la web, «Compartir» en la app Android (spec 013, A-63).
 */
export async function downloadFile(path: string, filename: string, { open = false } = {}): Promise<void> {
  await device().deliverFile(await fetchFile(path), filename, { open })
}
