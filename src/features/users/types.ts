import type { CompanyRole } from '@/core/auth/types'

/** Refleja App\Http\Resources\CompanyUserResource. */
export interface CompanyUser {
  id: number
  name: string
  email: string
  role: CompanyRole
  active: boolean
  last_login_at: string | null
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
}

export const roleLabels: Record<CompanyRole, string> = {
  company_admin: 'Administrador',
  seller: 'Vendedor',
}
