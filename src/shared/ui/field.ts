/**
 * Estilo único de los campos (spec 010, HU-4): BaseInput, BaseSelect y
 * SearchInput lo comparten. Cambiarlo aquí cambia todos los formularios.
 */
export const fieldClass =
  'block min-h-11 rounded-lg border bg-surface text-base text-ink shadow-xs transition placeholder:text-ink-muted/70 focus:border-brand-600 focus:ring-4 focus:ring-brand-600/15 focus:outline-none disabled:cursor-not-allowed disabled:bg-subtle disabled:text-ink-muted sm:text-sm'

/**
 * El ancho y el relleno van aparte para que no choquen con los de cada
 * componente (Tailwind no garantiza qué clase gana entre dos del mismo tipo).
 */
export const fieldWidthClass = 'w-full px-3'

/** Borde según el estado de validación. */
export function fieldStateClass(invalid: boolean | undefined): string {
  return invalid ? 'border-danger-600 focus:border-danger-600 focus:ring-danger-600/15' : 'border-line'
}
