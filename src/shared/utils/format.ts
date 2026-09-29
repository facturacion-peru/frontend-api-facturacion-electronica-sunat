/**
 * Formatos de presentación en español del Perú. Los importes y cantidades
 * llegan de la API como cadenas decimales exactas; aquí solo se muestran,
 * nunca se calculan (principio II).
 */

const money = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' })
const date = new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeZone: 'UTC' })
const dateTime = new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short' })

export function formatMoney(value: string | null | undefined): string {
  return value == null ? '—' : money.format(Number(value))
}

/** '36.000' → '36'; '50.500' → '50,5'. */
export function formatQuantity(value: string | null | undefined): string {
  if (value == null) return '—'
  const [integer = '0', decimals = ''] = value.split('.')
  const trimmed = decimals.replace(/0+$/, '')
  const grouped = Number(integer).toLocaleString('es-PE')

  return trimmed ? `${grouped},${trimmed}` : grouped
}

/** Fecha sin hora (AAAA-MM-DD) tal cual, sin desfase de zona horaria. */
export function formatDate(value: string | null | undefined): string {
  return value ? date.format(new Date(`${value.slice(0, 10)}T00:00:00Z`)) : '—'
}

export function formatDateTime(value: string | null | undefined): string {
  return value ? dateTime.format(new Date(value)) : '—'
}

export function today(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')

  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}
