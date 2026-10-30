import { env } from '@/core/config/env'
import { ApiError, NETWORK_MESSAGE } from './errors'
import { handleSessionStatus, sessionHeaders } from './session'
import type { ErrorResponse } from './types'

/** La subida se canceló a pedido del usuario: no es un error que mostrar. */
export class UploadCancelled extends Error {
  constructor() {
    super('Subida cancelada')
    this.name = 'UploadCancelled'
  }
}

export interface UploadOptions {
  /** Fracción enviada, de 0 a 1. */
  onProgress?: (fraction: number) => void
  signal?: AbortSignal
}

/**
 * Sube un FormData (multipart) y devuelve el cuerpo de la respuesta.
 *
 * Va con XHR porque fetch no informa el avance de lo enviado (spec 016,
 * HU-1 esc. 8). Por lo demás se comporta como `apiClient` + `unwrap`: mismas
 * cabeceras, ApiError con los errores por campo y reacción a 401 y 426.
 */
export function uploadForm<T>(path: string, form: FormData, { onProgress, signal }: UploadOptions = {}): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new UploadCancelled())
      return
    }

    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${env.apiBaseUrl}${path}`)

    // Sin Content-Type: el navegador lo pone con el boundary del multipart.
    for (const [name, value] of Object.entries(sessionHeaders())) {
      xhr.setRequestHeader(name, value)
    }

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) onProgress?.(event.loaded / event.total)
    }

    const onAbort = () => xhr.abort()
    signal?.addEventListener('abort', onAbort, { once: true })
    const done = () => signal?.removeEventListener('abort', onAbort)

    xhr.onabort = () => {
      done()
      reject(new UploadCancelled())
    }

    xhr.onerror = () => {
      done()
      reject(new ApiError(0, NETWORK_MESSAGE))
    }

    xhr.onload = () => {
      done()
      let body: unknown = null
      try {
        body = JSON.parse(xhr.responseText)
      } catch {
        // Sin cuerpo JSON (p. ej. un proxy caído): queda el mensaje genérico.
      }

      handleSessionStatus(xhr.status, body)

      if (xhr.status < 200 || xhr.status >= 300) {
        const error = (body ?? {}) as Partial<ErrorResponse> & { meta?: Record<string, unknown> }
        reject(new ApiError(xhr.status, error.message ?? 'Ocurrió un error inesperado.', error.errors ?? {}, error.meta ?? {}))
        return
      }

      onProgress?.(1)
      resolve(body as T)
    }

    xhr.send(form)
  })
}
