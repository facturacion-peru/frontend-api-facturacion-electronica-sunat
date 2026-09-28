import type { PaginationMeta } from '@/core/api/types'

/** Refleja App\Http\Resources\AuditLogResource. */
export interface AuditEntry {
  id: number
  action: string
  actor: { id: number; name: string } | null
  auditable_type: string | null
  auditable_id: number | null
  changes: Record<string, unknown> | null
  ip: string | null
  user_agent: string | null
  created_at: string
}

export interface AuditFilters {
  action: string
  actor_id: string
  from: string
  to: string
  page: number
}

export interface AuditPage {
  data: AuditEntry[]
  meta: PaginationMeta
}

/** Nombres legibles de las acciones de RF-040. */
export const actionLabels: Record<string, string> = {
  'company.created': 'Empresa creada',
  'company.updated': 'Datos de la empresa modificados',
  'company.logo_updated': 'Logo actualizado',
  'company.activated': 'Empresa reactivada',
  'company.deactivated': 'Empresa desactivada',
  'invitation.created': 'Invitación enviada',
  'invitation.resent': 'Invitación reenviada',
  'invitation.cancelled': 'Invitación cancelada',
  'invitation.accepted': 'Invitación aceptada',
  'user.role_changed': 'Rol cambiado',
  'user.activated': 'Usuario reactivado',
  'user.deactivated': 'Usuario desactivado',
  'auth.login_failed': 'Inicio de sesión fallido',
  'auth.password_reset': 'Contraseña restablecida',
}
