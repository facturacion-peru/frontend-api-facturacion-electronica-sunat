/**
 * Vista previa de importes con la misma regla que el servidor
 * (TicketService + Decimal): bruto = cantidad × precio redondeado a 2
 * decimales, mitad hacia arriba; importe = bruto − descuento.
 *
 * Solo para mostrar mientras se arma la venta: el valor que vale es el que
 * devuelve la API (principio II). Se calcula con enteros, sin coma flotante.
 */

function toUnits(value: string, scale: number): bigint {
  const negative = value.trim().startsWith('-')
  const [integer = '0', decimals = ''] = value.trim().replace('-', '').split('.')
  const units = BigInt(integer || '0') * 10n ** BigInt(scale) + BigInt((decimals + '0'.repeat(scale)).slice(0, scale) || '0')

  return negative ? -units : units
}

function fromCents(cents: bigint): string {
  const negative = cents < 0n
  const abs = negative ? -cents : cents
  const text = `${abs / 100n}.${String(abs % 100n).padStart(2, '0')}`

  return negative ? `-${text}` : text
}

/** Cantidad (3 decimales) × precio (2 decimales), redondeado a céntimos. */
export function grossAmount(quantity: string, unitPrice: string): string {
  const product = toUnits(quantity, 3) * toUnits(unitPrice, 2) // en 1e-5
  const cents = product >= 0n ? (product + 500n) / 1000n : -((-product + 500n) / 1000n)

  return fromCents(cents)
}

export function lineAmount(quantity: string, unitPrice: string, discount = '0'): string {
  return fromCents(toUnits(grossAmount(quantity, unitPrice), 2) - toUnits(discount || '0', 2))
}

export function sumAmounts(amounts: string[]): string {
  return fromCents(amounts.reduce((total, amount) => total + toUnits(amount, 2), 0n))
}
