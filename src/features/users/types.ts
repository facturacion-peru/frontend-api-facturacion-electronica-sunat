import type { CompanyRole } from '@/core/auth/types'

/** Refleja App\Http\Resources\CompanyUserResource. */
export interface CompanyUser {
  id: number
  name: string
  email: string
  role: CompanyRole
  active: boolean
  last_login_at: string | null
  /** Locales del vendedor (spec 017, A-87); `null` para el administrador, que trabaja en todos. */
  establishment_ids: number[] | null
}

/** Refleja App\Http\Resources\InvitationResource. */
export interface PendingInvitation {
  id: number
  email: string
  role: CompanyRole
  expires_at: string
  expired: boolean
  invited_by: { id: number; name: string } | null
  created_at: string | null
  /** Locales que tendrá el vendedor al aceptar; `null` para el administrador o con un solo local. */
  establishment_ids: number[] | null
}

export const roleLabels: Record<CompanyRole, string> = {
  company_admin: 'Administrador',
  seller: 'Vendedor',
}
