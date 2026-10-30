/**
 * DNI y RUC (spec 018): se revisan antes de consultar, para no pedir nada
 * inválido (RF-005). Es el mismo cálculo que `App\Rules\Ruc` de la API, que
 * valida igual.
 */
const RUC_WEIGHTS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]

export function isDni(value: string): boolean {
  return /^\d{8}$/.test(value)
}

/** 11 dígitos, de persona natural (10) o jurídica (20), con su dígito verificador. */
export function isRuc(value: string): boolean {
  if (!/^\d{11}$/.test(value) || !['10', '20'].includes(value.slice(0, 2))) return false

  const sum = RUC_WEIGHTS.reduce((total, weight, i) => total + Number(value[i]) * weight, 0)
  const check = 11 - (sum % 11)

  return Number(value[10]) === (check === 10 ? 0 : check === 11 ? 1 : check)
}

/**
 * Qué parece lo escrito: un DNI (8 dígitos), un RUC (11) o nada que consultar.
 * Solo mira la cantidad de dígitos; `isRuc` dice si el RUC es válido.
 */
export function documentKind(text: string): 'dni' | 'ruc' | null {
  const value = text.trim()
  if (/^\d{8}$/.test(value)) return 'dni'
  if (/^\d{11}$/.test(value)) return 'ruc'

  return null
}
