/**
 * Tipos del sobre de respuesta de la API.
 *
 * La API responde siempre con la misma forma para los listados:
 *
 * ```json
 * { "success": true, "data": [...], "meta": { ... } }
 * ```
 *
 * `data` es siempre un array plano y `meta` describe únicamente la paginación.
 * Cualquier dato extra del listado (contadores, contexto) viaja en claves
 * propias de primer nivel, nunca dentro de `meta`.
 *
 * Estos tipos se escriben a mano porque el spec OpenAPI generado desde Laravel
 * documenta los request bodies pero todavía no los response bodies.
 */

/** Paginación de un listado paginado. */
export interface PaginationMeta {
  current_page: number
  per_page: number
  total: number
  last_page: number
  from: number | null
  to: number | null
}

/** `meta` de un listado que no se pagina. */
export interface CollectionMeta {
  total: number
}

/** Respuesta de un listado paginado. */
export interface PaginatedResponse<T> {
  success: true
  data: T[]
  meta: PaginationMeta
  message?: string
}

/** Respuesta de un listado completo, sin paginar. */
export interface CollectionResponse<T> {
  success: true
  data: T[]
  meta: CollectionMeta
  message?: string
}

/** Respuesta de un recurso único. */
export interface ResourceResponse<T> {
  success: true
  data: T
  message?: string
}

/** Respuesta de error de la API. */
export interface ErrorResponse {
  success: false
  message: string
  errors?: Record<string, string[]>
}

/** Contexto de empresa que acompaña a los listados anidados bajo una empresa. */
export interface CompanyContext {
  company: {
    id: number
    razon_social: string
  }
}
