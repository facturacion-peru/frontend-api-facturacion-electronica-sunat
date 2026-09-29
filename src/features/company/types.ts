/** Refleja App\Http\Resources\CompanyResource. */
export interface CompanyDetail {
  id: number
  ruc: string
  razon_social: string
  nombre_comercial: string | null
  person_type: 'natural' | 'juridica'
  tax_regime: 'nrus' | 'rer' | 'rmt' | 'general'
  email: string
  phone: string | null
  logo_url: string | null
  active: boolean
  expiry_warning_days: number
  fiscal_address: { address: string; ubigeo: string; district: string | null } | null
  created_at: string | null
}

export interface CompanyContactForm {
  nombre_comercial: string | null
  email: string
  phone: string | null
  expiry_warning_days: number
}

export const personTypeLabels: Record<CompanyDetail['person_type'], string> = {
  natural: 'Persona natural',
  juridica: 'Persona jurídica',
}

export const taxRegimeLabels: Record<CompanyDetail['tax_regime'], string> = {
  nrus: 'Nuevo RUS',
  rer: 'Régimen Especial (RER)',
  rmt: 'Régimen MYPE Tributario',
  general: 'Régimen General',
}
