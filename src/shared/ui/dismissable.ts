import { onBeforeUnmount, watch } from 'vue'

/**
 * Pila de diálogos, hojas y paneles abiertos, del más antiguo al más
 * reciente. El botón «Atrás» de Android cierra primero el de arriba
 * (spec 013, RF-005), como Escape en el teclado.
 */
const stack: Array<() => void> = []

/** Registra un elemento que se cierra con «Atrás» mientras esté abierto. */
export function useDismissable(isOpen: () => boolean, close: () => void): void {
  const dismiss = () => close()
  const remove = () => {
    const index = stack.indexOf(dismiss)
    if (index >= 0) stack.splice(index, 1)
  }

  watch(
    isOpen,
    (open) => {
      remove()
      if (open) stack.push(dismiss)
    },
    { immediate: true },
  )
  onBeforeUnmount(remove)
}

/** Cierra el elemento abierto más reciente; false si no había ninguno. */
export function dismissTop(): boolean {
  const dismiss = stack[stack.length - 1]
  dismiss?.()

  return dismiss !== undefined
}
