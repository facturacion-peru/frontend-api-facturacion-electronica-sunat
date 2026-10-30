import createClient, { type Middleware } from 'openapi-fetch'

import { env } from '@/core/config/env'
import type { paths } from './schema'
import { handleSessionStatus, sessionHeaders } from './session'

/**
 * Cliente HTTP tipado contra la API de facturación.
 *
 * Los tipos salen de `schema.d.ts`, generado desde el `openapi.json` que publica
 * Laravel (`pnpm api:types`). Eso obliga a que las rutas, los parámetros y
 * los cuerpos de petición se comprueben en tiempo de compilación: si la API
 * cambia un campo, el build falla aquí antes que en producción.
 */

/** Adjunta el token de Sanctum (y en la app, su versión) a cada petición saliente. */
const authMiddleware: Middleware = {
  async onRequest({ request }) {
    for (const [name, value] of Object.entries(sessionHeaders())) {
      request.headers.set(name, value)
    }

    return request
  },

  async onResponse({ response }) {
    if (response.status === 401 || response.status === 426) {
      handleSessionStatus(response.status, await response.clone().json().catch(() => ({})))
    }

    return response
  },
}

export const apiClient = createClient<paths>({
  baseUrl: env.apiBaseUrl,
})

apiClient.use(authMiddleware)
