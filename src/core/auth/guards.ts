import type { RouteLocationNormalized, RouteLocationRaw } from 'vue-router'

import { useSessionStore } from './session-store'
import type { CompanyRole } from './types'

declare module 'vue-router' {
  interface RouteMeta {
    /** Exige sesión iniciada. */
    requiresAuth?: boolean
    /** Solo sin sesión (login, recuperar contraseña). */
    guestOnly?: boolean
    /** Accesible con o sin sesión (aceptar invitación, restablecer). */
    public?: boolean
    /** Roles permitidos; si falta, cualquier usuario de empresa. */
    roles?: CompanyRole[]
    /** Título de la pestaña. */
    title?: string
  }
}

/**
 * Guard global. Es solo experiencia de usuario: la autorización real la
 * aplica siempre la API (principio IV).
 */
export async function authGuard(to: RouteLocationNormalized): Promise<true | RouteLocationRaw> {
  if (to.meta.public) return true

  const session = useSessionStore()
  await session.restore()

  if (to.meta.guestOnly) {
    return session.isAuthenticated ? { name: 'home' } : true
  }

  if (!to.meta.requiresAuth) return true

  if (!session.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  // El administrador de la plataforma usa su propio panel (A-08).
  if (session.session?.platform_admin) {
    return to.name === 'platform-admin' ? true : { name: 'platform-admin' }
  }

  if (to.name === 'platform-admin') return { name: 'home' }

  if (to.meta.roles && !to.meta.roles.includes(session.role!)) {
    return { name: 'home' }
  }

  return true
}

/** Solo rutas internas: evita redirecciones abiertas a otros dominios. */
export function safeRedirect(value: unknown): string {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : '/'
}
