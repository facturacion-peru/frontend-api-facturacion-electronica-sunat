/**
 * Tipos de la sesión. Escritos a mano mientras el OpenAPI no documente las
 * respuestas; reflejan App\Http\Resources\SessionResource y UserResource,
 * cuya forma protege tests/Feature/Contract/SessionResourceTest.php.
 */

import type { Establishment } from '@/shared/establishments/types'

export type CompanyRole = 'company_admin' | 'seller'

export interface SessionUser {
  id: number
  name: string
  email: string
}

export interface SessionCompany {
  id: number
  ruc: string
  razon_social: string
  nombre_comercial: string | null
  /** Logo que subió la empresa, o null: la barra lateral usa entonces el del sistema. */
  logo_url: string | null
  /** Locales activos de la empresa, aunque el usuario no los tenga todos (spec 017, RF-010). */
  active_establishments_count: number
}

export interface Session {
  user: SessionUser
  platform_admin: boolean
  company: SessionCompany | null
  role: CompanyRole | null
  /** Locales donde el usuario puede trabajar (A-87): todos los activos para el administrador. */
  establishments: Establishment[]
}

export interface SessionWithToken extends Session {
  token: string
  expires_at: string
}

export interface AcceptInvitationPayload {
  name: string
  password: string
  password_confirmation: string
}
