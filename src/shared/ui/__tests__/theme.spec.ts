import { describe, expect, it } from 'vitest'

/*
 * Spec 010 (RF-002, CE-002): los colores se toman del tema de `main.css`
 * (brand-*, success-*, warning-*, danger-*, ink, line…). Esta prueba evita
 * que una pantalla vuelva a escribir colores de la paleta de Tailwind sueltos.
 * El ticket impreso queda fuera: se imprime en blanco y negro.
 */
const sources = import.meta.glob<string>('/src/**/*.vue', { query: '?raw', import: 'default', eager: true })

const allowed = new Set(['/src/features/sales/components/TicketReceipt.vue'])
const rawColor = /\b[a-z-]+-(?:red|green|amber|yellow|orange|emerald|blue|slate|gray|zinc|neutral)-\d{2,3}\b/g

describe('tema', () => {
  it('ninguna pantalla usa colores de la paleta sueltos', () => {
    const offenders = Object.entries(sources)
      .filter(([path]) => !allowed.has(path))
      .flatMap(([path, code]) => (code.match(rawColor) ?? []).map((cls) => `${path}: ${cls}`))

    expect(offenders).toEqual([])
  })

  /*
   * Spec 010 · CE-004: un solo estilo de campo. Las vistas usan BaseInput,
   * BaseSelect o SearchInput; nada de `selectClass` ni <select> sueltos, ni
   * <input> de texto o número con clases propias.
   */
  it('ninguna pantalla define su propio estilo de campo', () => {
    const fieldTypes = /<input\b(?![^>]*type="(?:checkbox|radio|file|hidden)")[^>]*\bclass=/
    const offenders = Object.entries(sources)
      .filter(([path]) => !path.startsWith('/src/shared/ui/'))
      .filter(([, code]) => code.includes('selectClass') || /<select\b/.test(code) || fieldTypes.test(code))
      .map(([path]) => path)

    expect(offenders).toEqual([])
  })
})
