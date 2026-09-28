import type { ErrorResponse, ResourceResponse } from './types'

/**
 * Error de la API con el sobre `{ success: false, message, errors? }`.
 * `fieldErrors` trae los errores 422 por campo, listos para cada FormField.
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly fieldErrors: Record<string, string[]> = {},
  ) {
    super(message)
    this.name = 'ApiError'
  }

  /** Primer error de un campo, o null. */
  field(name: string): string | null {
    return this.fieldErrors[name]?.[0] ?? null
  }
}

const NETWORK_MESSAGE = 'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.'

interface FetchResult {
  data?: unknown
  error?: unknown
  response: Response
}

/**
 * Convierte el resultado de openapi-fetch en datos o en ApiError.
 *
 * El spec OpenAPI aún no documenta las respuestas (principio III), así que el
 * cuerpo se tipa aquí con las interfaces de `types.ts` y de cada feature.
 */
export async function unwrap<T>(request: Promise<FetchResult>): Promise<T> {
  let result: FetchResult

  try {
    result = await request
  } catch {
    throw new ApiError(0, NETWORK_MESSAGE)
  }

  if (!result.response.ok) {
    const body = (result.error ?? {}) as Partial<ErrorResponse>
    throw new ApiError(result.response.status, body.message ?? 'Ocurrió un error inesperado.', body.errors ?? {})
  }

  return result.data as T
}

/** Atajo para respuestas `{ success, data }`: devuelve `data`. */
export async function unwrapData<T>(request: Promise<FetchResult>): Promise<T> {
  return (await unwrap<ResourceResponse<T>>(request)).data
}
