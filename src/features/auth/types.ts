import type { CompanyRole } from '@/core/auth/types'

/** Refleja App\Http\Resources\PublicInvitationResource. */
export interface PublicInvitation {
  email: string
  role: CompanyRole
  role_label: string
  company: { razon_social: string; nombre_comercial: string | null }
  expires_at: string
}
