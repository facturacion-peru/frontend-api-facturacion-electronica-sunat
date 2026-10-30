import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

import { useSessionStore } from '@/core/auth/session-store'
import type { Establishment } from './types'

/**
 * Local donde se trabaja (spec 017, HU-2 y A-87). Lo usan «Vender», las
 * entradas y los filtros, así que no es de ninguna feature.
 *
 * - `allowed`: los locales activos donde puede trabajar el usuario (la API los
 *   manda en la sesión y se refrescan con `setAllowed`).
 * - `multi`: la empresa tiene más de un local activo. Sin eso no se pinta
 *   ningún selector, filtro ni nombre de local (RF-010).
 * - `current`: el elegido, recordado en el dispositivo por empresa y usuario
 *   (solo el id). Con un solo permitido es ese; si el recordado ya no está
 *   permitido, queda `null` y hay que elegir (HU-2, esc. 5). No se borra al
 *   cerrar sesión: es del dispositivo, como la impresora.
 * - `filterOptions` y `defaultFilter`: los locales que se pueden leer en las
 *   listas (el administrador también ve los inactivos, por su historial) y con
 *   cuál empieza el filtro: «Todos» (`null`) para el administrador y el local
 *   actual para el vendedor, que trabaja en uno a la vez (A-87).
 */
const VERSION = 1

function read(key: string): number | null {
  try {
    const stored = JSON.parse(localStorage.getItem(key) ?? 'null') as { v?: number; id?: unknown } | null
    if (stored?.v === VERSION && typeof stored.id === 'number') return stored.id
  } catch {
    // Dañado o sin almacenamiento: se elige de nuevo.
  }
  return null
}

export const useEstablishmentStore = defineStore('establishments', () => {
  const session = useSessionStore()

  const storageKey = computed(() => {
    const companyId = session.session?.company?.id
    const userId = session.session?.user.id

    return companyId && userId ? `sunat.establishment.${companyId}.${userId}` : null
  })

  const allowed = computed<Establishment[]>(() => session.session?.establishments.filter((e) => e.active) ?? [])
  const multi = computed(() => (session.session?.company?.active_establishments_count ?? 0) > 1)
  const noneAllowed = computed(() => session.session?.company != null && allowed.value.length === 0)

  const chosenId = ref<number | null>(null)
  watch(storageKey, (key) => (chosenId.value = key ? read(key) : null), { immediate: true })

  const current = computed<Establishment | null>(() => {
    if (allowed.value.length === 1) return allowed.value[0]!
    return allowed.value.find((e) => e.id === chosenId.value) ?? null
  })

  /** Lista completa para los filtros, con inactivos (`GET /establishments?include_inactive=1`). */
  const readable = ref<Establishment[] | null>(null)
  const filterOptions = computed(() => readable.value ?? session.session?.establishments ?? [])
  const defaultFilter = computed(() => (session.isCompanyAdmin ? null : (current.value?.id ?? null)))

  /** Hay varios permitidos y ninguno elegido (o el recordado ya no vale). */
  const needsChoice = computed(() => allowed.value.length > 1 && current.value === null)

  function choose(id: number) {
    if (!allowed.value.some((e) => e.id === id)) return
    chosenId.value = id
    try {
      if (storageKey.value) localStorage.setItem(storageKey.value, JSON.stringify({ v: VERSION, id }))
    } catch {
      // Sin almacenamiento: vale mientras la app esté abierta.
    }
  }

  /** Locales recién pedidos a la API (uno creado o desactivado durante la sesión). */
  function setAllowed(establishments: Establishment[]) {
    if (session.session) session.session.establishments = establishments
  }

  function setReadable(establishments: Establishment[]) {
    readable.value = establishments
  }

  watch(storageKey, () => (readable.value = null))

  return { allowed, multi, noneAllowed, current, needsChoice, filterOptions, defaultFilter, choose, setAllowed, setReadable }
})
