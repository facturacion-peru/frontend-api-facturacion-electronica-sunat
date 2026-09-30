/** Tipos del panel de la plataforma (spec 006). Propios: una feature no importa de otra. */

export type SunatStatus = 'not_configured' | 'pending' | 'validated' | 'error' | 'inactive'
export type TaxRegime = 'nrus' | 'rer' | 'rmt' | 'general'

/** Refleja App\Http\Resources\PlatformCompanyResource (tests/Feature/Contract/PlatformResourcesTest). */
export interface PlatformCompany {
  id: number
  ruc: string
  razon_social: string
  nombre_comercial: string | null
  active: boolean
  sunat_status: SunatStatus
  sunat_status_label: string
  sunat_reason: string | null
  users_count: number
  pending_documents: number
  rejected_documents: number
  created_at: string | null
}

/** Refleja App\Http\Resources\PlatformCompanyDetailResource. */
export interface PlatformCompanyDetail extends PlatformCompany {
  person_type: 'natural' | 'juridica'
  tax_regime: TaxRegime
  tax_regime_label: string
  email: string
  phone: string | null
  fiscal_address: { address: string; ubigeo: string; district: string | null } | null
  admin: { name: string | null; email: string | null; invitation: 'accepted' | 'pending' | 'expired' | 'none' }
  active_users: number
  last_activity_at: string | null
}

export interface CompanyFilters {
  search: string
  status: '' | 'active' | 'inactive'
  issues: boolean
  page: number
}

export interface NewCompanyForm {
  ruc: string
  razon_social: string
  nombre_comercial: string | null
  tax_regime: TaxRegime
  email: string
  phone: string | null
  address: string
  ubigeo: string
  admin_email: string
}

export interface LegalDataForm {
  ruc: string
  razon_social: string
  nombre_comercial: string | null
  tax_regime: TaxRegime
  fiscal_address: { address: string; ubigeo: string }
}

export interface Ubigeo {
  id: string
  nombre: string
  provincia: string
  region: string
  ubigeo_completo: string
}

/** Refleja App\Http\Resources\PlatformSalesDocumentResource: solo datos de envío (A-37). */
export interface SupportDocument {
  id: number
  company: { id: number; ruc: string; razon_social: string }
  display_number: string
  document_type: '01' | '03'
  document_type_label: string
  status: 'pending' | 'sent' | 'rejected' | 'accepted' | 'observed'
  status_label: string
  sunat_code: string | null
  sunat_message: string | null
  attempts: number
  issued_at: string
  next_attempt_at: string | null
  can_retry: boolean
}

export interface PlatformAuditEntry {
  id: number
  action: string
  actor: { id: number; name: string } | null
  changes: Record<string, unknown> | null
  ip: string | null
  created_at: string
  company: { id: number; razon_social: string | null } | null
}

export const taxRegimeLabels: Record<TaxRegime, string> = {
  nrus: 'Nuevo RUS',
  rer: 'Régimen Especial (RER)',
  rmt: 'Régimen MYPE Tributario',
  general: 'Régimen General',
}

export const sunatVariant: Record<SunatStatus, 'neutral' | 'success' | 'warning' | 'danger'> = {
  not_configured: 'neutral',
  pending: 'warning',
  validated: 'success',
  error: 'danger',
  inactive: 'neutral',
}

export const auditActionLabels: Record<string, string> = {
  'auth.login': 'Inicio de sesión',
  'company.created': 'Alta de empresa',
  'company.updated': 'Corrección de datos',
  'company.deactivated': 'Suspensión',
  'company.activated': 'Reactivación',
  'invitation.resent': 'Invitación reenviada',
  'invitation.created': 'Invitación enviada',
  'sales_document.retry_requested': 'Reintento de envío',
}
