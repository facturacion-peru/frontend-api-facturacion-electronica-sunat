import { ref } from 'vue'

import { ApiError } from '@/core/api/errors'

/**
 * Estado de envío de un formulario contra la API: errores 422 por campo,
 * mensaje general (429, red, 5xx) y bandera de envío en curso.
 */
export function useApiForm() {
  const submitting = ref(false)
  const fieldErrors = ref<Record<string, string[]>>({})
  const generalError = ref<string | null>(null)

  function fieldError(name: string): string | null {
    return fieldErrors.value[name]?.[0] ?? null
  }

  function reset(): void {
    fieldErrors.value = {}
    generalError.value = null
  }

  /** Ejecuta la acción; devuelve true si terminó sin error. */
  async function submit(action: () => Promise<unknown>): Promise<boolean> {
    reset()
    submitting.value = true

    try {
      await action()
      return true
    } catch (error) {
      if (!(error instanceof ApiError)) throw error

      if (error.status === 422 && Object.keys(error.fieldErrors).length > 0) {
        fieldErrors.value = error.fieldErrors
      } else {
        generalError.value = error.message
      }

      return false
    } finally {
      submitting.value = false
    }
  }

  return { submitting, fieldErrors, generalError, fieldError, reset, submit }
}
