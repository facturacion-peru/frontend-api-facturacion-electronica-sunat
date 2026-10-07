import { env } from '@/core/config/env'
import { device } from '@/core/device'
import { ApiError } from './errors'
import { getToken } from './token-storage'

/**
 * Descarga un archivo de la API (PDF, XML, CDR). Un enlace directo no lleva
 * la cabecera Authorization, así que se pide con fetch y se entrega como Blob:
 * descarga en la web, «Compartir» en la app Android (spec 013, A-63).
 */
/** La app Android se identifica para el control de versión mínima (spec 013, A-67). */
function appVersionHeader(): Record<string, string> {
  const version = device().appVersion
  return version ? { 'X-App-Version': version } : {}
}

export async function downloadFile(path: string, filename: string, { open = false } = {}): Promise<void> {
  let response: Response

  try {
    response = await fetch(`${env.apiBaseUrl}${path}`, {
      headers: {
        Authorization: `Bearer ${getToken() ?? ''}`,
        Accept: '*/*',
        ...appVersionHeader(),
      },
    })
  } catch {
    throw new ApiError(0, 'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.')
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: string }
    throw new ApiError(response.status, body.message ?? 'No se pudo descargar el archivo.')
  }

  await device().deliverFile(await response.blob(), filename, { open })
}
