import type { CompanyRole } from '@/core/auth/types'
import { useSessionStore } from '@/core/auth/session-store'
import type { Establishment } from '@/shared/establishments/types'

/** Locales de prueba (spec 017). Utilidad solo para pruebas. */
export const principal: Establishment = {
  id: 1, code: '0000', name: 'Principal', address: 'Av. Lima 123', ubigeo: '150101', district: null, is_main: true, active: true, code_locked: true,
}
export const sucursal: Establishment = { ...principal, id: 2, code: '0001', name: 'Sucursal Centro', address: 'Jr. Unión 45', is_main: false }

/** Sesión de empresa con esos locales; `activeCount` por defecto, los activos que se pasan. */
export function sessionWith(establishments: Establishment[], role: CompanyRole = 'company_admin', activeCount?: number) {
  useSessionStore().session = {
    user: { id: 1, name: 'Ana', email: 'ana@demo.test' }, platform_admin: false, role, establishments,
    company: {
      id: 1, ruc: '20600000011', razon_social: 'Demo', nombre_comercial: null,
      logo_url: null, active_establishments_count: activeCount ?? establishments.filter((e) => e.active).length,
    },
  }
}
