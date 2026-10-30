/**
 * Locales de la empresa (spec 017). Escritos a mano mientras el OpenAPI no
 * documente las respuestas; reflejan App\Http\Resources\EstablishmentResource.
 */

/** Un local registrado en SUNAT con su código de anexo (A-89). */
export interface Establishment {
  id: number
  /** Código de anexo de 4 dígitos; el principal es «0000». */
  code: string
  name: string
  address: string
  ubigeo: string
  /** Distrito del ubigeo para mostrar («Lima / Lima / Lima»). */
  district: string | null
  is_main: boolean
  active: boolean
  /** Ya tiene comprobantes: el código no se puede cambiar. */
  code_locked: boolean
}

/** Lo que traen las filas de tickets, comprobantes, lotes, movimientos y alertas. */
export type EstablishmentRef = Pick<Establishment, 'id' | 'code' | 'name'>

/** Lo que se envía al crear o editar un local. */
export interface EstablishmentForm {
  code: string
  name: string
  address: string
  ubigeo: string
}
