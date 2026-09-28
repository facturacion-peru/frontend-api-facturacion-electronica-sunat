/**
 * Tipos de la sesión. Escritos a mano mientras el OpenAPI no documente las
 * respuestas; reflejan App\Http\Resources\SessionResource y UserResource,
 * cuya forma protege tests/Feature/Contract/SessionResourceTest.php.
 */

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
}

export interface Session {
  user: SessionUser
  platform_admin: boolean
  company: SessionCompany | null
  role: CompanyRole | null
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
