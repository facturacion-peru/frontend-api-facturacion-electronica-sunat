import { apiClient } from '@/core/api/client'
import { unwrap, unwrapData } from '@/core/api/errors'
import type { Ubigeo } from '@/shared/ui/ubigeo'
import type { Establishment, EstablishmentForm } from './types'

/** Locales de la empresa (spec 017). */
export const establishmentsApi = {
  /** Los activos permitidos; con `includeInactive`, el administrador recibe también los inactivos. */
  list: async (includeInactive = false) =>
    (
      await unwrap<{ data: Establishment[] }>(
        apiClient.GET('/api/v1/establishments', {
          // El generador lo tipa como booleano, pero la regla `boolean` de Laravel no acepta «true»: va como 1.
          params: { query: includeInactive ? { include_inactive: 1 as unknown as boolean } : {} },
        }),
      )
    ).data,

  create: (body: EstablishmentForm) => unwrapData<Establishment>(apiClient.POST('/api/v1/establishments', { body })),

  update: (id: number, body: Partial<EstablishmentForm> & { active?: boolean }) =>
    unwrapData<Establishment>(apiClient.PATCH('/api/v1/establishments/{establishment}', { params: { path: { establishment: id } }, body })),

  /** Buscador de distritos de la empresa, para `UbigeoPicker`. */
  searchUbigeos: async (q: string) =>
    (await unwrap<{ data: Ubigeo[] }>(apiClient.GET('/api/v1/ubigeos/search', { params: { query: { q } } }))).data,
}
