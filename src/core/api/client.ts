import createClient, { type Middleware } from 'openapi-fetch'

import { env } from '@/core/config/env'
import { device } from '@/core/device'
import { updateRequired } from './app-update'
import type { paths } from './schema'
import { getToken, clearToken } from './token-storage'

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
    const token = getToken()

    if (token) {
      request.headers.set('Authorization', `Bearer ${token}`)
    }

    request.headers.set('Accept', 'application/json')

    // La app Android se identifica para el control de versión mínima (spec 013).
    const version = device().appVersion
    if (version) request.headers.set('X-App-Version', version)

    return request
  },

  async onResponse({ response }) {
    // El token de Sanctum caduca (24 h por defecto). Al recibir un 401 se
    // descarta el token local; de la redirección al login se encarga el guard
    // del router, que sí conoce la ruta actual.
    if (response.status === 401) {
      clearToken()
    }

    // App desactualizada: se pide actualizar, sin cerrar la sesión (spec 013, HU-5).
    if (response.status === 426) {
      const body = (await response.clone().json().catch(() => ({}))) as { min_version?: string }
      updateRequired.value = body.min_version ?? '?'
    }

    return response
  },
}

export const apiClient = createClient<paths>({
  baseUrl: env.apiBaseUrl,
})

apiClient.use(authMiddleware)
