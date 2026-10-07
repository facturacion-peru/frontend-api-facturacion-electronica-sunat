import type { Router } from 'vue-router'

import { device } from '@/core/device'
import { dismissTop } from '@/shared/ui/dismissable'

/** Pantallas raíz: «Atrás» en ellas manda la app al fondo, como en Android. */
const ROOTS = new Set(['home', 'login'])

/**
 * Botón «Atrás» de Android (spec 013, RF-005): cierra el diálogo u hoja
 * abierta; si no hay, vuelve de pantalla; en una pantalla raíz o sin
 * historial, minimiza la app sin cerrarla (la venta en curso queda guardada).
 * En la web no hace nada. Devuelve cómo desinstalarlo.
 */
export function installBackButton(router: Router): () => void {
  return device().onBackButton(() => {
    if (dismissTop()) return

    const name = router.currentRoute.value.name
    if ((typeof name === 'string' && ROOTS.has(name)) || !router.options.history.state.back) {
      void device().minimize()
      return
    }

    router.back()
  })
}
