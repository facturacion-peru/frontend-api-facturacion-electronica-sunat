import { computed, ref } from 'vue'

import { inventoryApi } from '../api'
import type { InventoryCatalogs } from '../types'

// Datos de referencia: se cargan una vez por sesión de la aplicación.
const catalogs = ref<InventoryCatalogs | null>(null)
let loading: Promise<void> | null = null

export function useInventoryCatalogs() {
  function load(): Promise<void> {
    loading ??= inventoryApi
      .catalogs()
      .then((data) => {
        catalogs.value = data
      })
      .catch(() => {
        loading = null
      })

    return loading
  }

  const unitLabel = (code: string) => catalogs.value?.units.find((u) => u.code === code)?.label ?? code
  const allowsDecimals = (code: string) => catalogs.value?.units.find((u) => u.code === code)?.allows_decimals ?? false
  const igvLabel = (code: string) => catalogs.value?.igv_affectations.find((a) => a.code === code)?.label ?? code
  const reasonLabel = (code: string | null) =>
    code ? (catalogs.value?.adjustment_reasons.find((r) => r.code === code)?.label ?? code) : ''

  return {
    catalogs: computed(() => catalogs.value),
    load,
    unitLabel,
    allowsDecimals,
    igvLabel,
    reasonLabel,
  }
}

/** Solo para pruebas: olvida la caché entre casos. */
export function resetInventoryCatalogs(): void {
  catalogs.value = null
  loading = null
}
