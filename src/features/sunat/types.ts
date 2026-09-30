/** Estados de la configuración SUNAT (App\Enums\SunatStatus). */
export type SunatStatus = 'not_configured' | 'pending' | 'validated' | 'error' | 'inactive'

/** Refleja el `data` de GET /sunat/status (visible para todos los roles). */
export interface SunatStatusInfo {
  environment: 'beta'
  environment_label: string
  status: SunatStatus
  status_label: string
  reason: string | null
  can_issue: boolean
  missing: string[]
  sol_verified: boolean
  certificate_days_to_expire: number | null
}

/** Metadatos de un certificado: nunca el PEM ni la contraseña. */
export interface CertificateInfo {
  subject: string
  ruc: string
  valid_from: string
  valid_to: string
  days_to_expire: number
  uploaded_by: string | null
}

export interface CertificateHistoryItem extends CertificateInfo {
  status: 'current' | 'replaced'
  replaced_at: string | null
}

/** Refleja App\Http\Resources\SunatSettingsResource (solo administrador). */
export interface SunatSettings {
  company_id: number
  environment: 'beta'
  environment_label: string
  status: SunatStatus
  status_label: string
  sol_user_masked: string | null
  has_sol_password: boolean
  sol_verified: boolean
  certificate: CertificateInfo | null
  certificates_history: CertificateHistoryItem[]
  last_validated_at: string | null
  last_validation_error: string | null
}

export type DocumentType = '01' | '03' | '07'

/** Refleja App\Http\Resources\SeriesResource. */
export interface Series {
  id: number
  document_type: DocumentType
  document_type_label: string
  code: string
  last_number: number
  next_number: number
  active: boolean
  establishment_code: string | null
}

export interface SeriesForm {
  document_type: DocumentType
  code: string
  last_number: number
}

export const documentTypePrefix: Record<DocumentType, string> = { '01': 'F', '03': 'B', '07': 'F o B' }

/** Serie que se propone al elegir el tipo (spec 007: las notas llevan la letra del comprobante). */
export const suggestedSeries: Record<DocumentType, string> = { '01': 'F001', '03': 'B001', '07': 'BC01' }

export const statusVariant: Record<SunatStatus, 'neutral' | 'success' | 'warning' | 'danger'> = {
  not_configured: 'neutral',
  pending: 'warning',
  validated: 'success',
  error: 'danger',
  inactive: 'neutral',
}

/** Días de anticipación para avisar que el certificado vence (HU-4.3). */
export const CERTIFICATE_WARNING_DAYS = 30
