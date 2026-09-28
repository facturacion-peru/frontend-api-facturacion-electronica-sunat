import { apiClient } from '@/core/api/client'
import { unwrap } from '@/core/api/errors'
import type { CollectionResponse } from '@/core/api/types'
import type { AuditFilters, AuditPage } from './types'

export const auditApi = {
  list: (filters: AuditFilters) =>
    unwrap<AuditPage>(
      apiClient.GET('/api/v1/audit-logs', {
        params: {
          query: {
            ...(filters.action && { action: filters.action }),
            ...(filters.actor_id && { actor_id: Number(filters.actor_id) }),
            ...(filters.from && { from: filters.from }),
            ...(filters.to && { to: filters.to }),
            page: filters.page,
          } as never,
        },
      }),
    ),

  /** Para el filtro por usuario. Llamada propia: una feature no importa de otra. */
  users: async () =>
    (await unwrap<CollectionResponse<{ id: number; name: string }>>(apiClient.GET('/api/v1/users'))).data,
}
