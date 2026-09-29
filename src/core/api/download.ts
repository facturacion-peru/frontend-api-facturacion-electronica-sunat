import { env } from '@/core/config/env'
import { ApiError } from './errors'
import { getToken } from './token-storage'

/**
 * Descarga un archivo de la API (PDF, XML, CDR). Un enlace directo no lleva
 * la cabecera Authorization, así que se pide con fetch y se entrega como Blob.
 */
export async function downloadFile(path: string, filename: string, { open = false } = {}): Promise<void> {
  let response: Response

  try {
    response = await fetch(`${env.apiBaseUrl}${path}`, {
      headers: { Authorization: `Bearer ${getToken() ?? ''}`, Accept: '*/*' },
    })
  } catch {
    throw new ApiError(0, 'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.')
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: string }
    throw new ApiError(response.status, body.message ?? 'No se pudo descargar el archivo.')
  }

  const url = URL.createObjectURL(await response.blob())
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
}
