import { apiClient } from '@/core/api/client'
import { unwrapData } from '@/core/api/errors'
import type { DashboardSummary } from './types'

export const dashboardApi = {
  /** `establishmentId` null: los locales que el usuario puede leer (spec 017). */
  summary: (establishmentId: number | null = null) =>
    unwrapData<DashboardSummary>(
      apiClient.GET('/api/v1/dashboard', {
        // El generador no documenta el FormRequest de un controlador invocable: el parámetro existe (IndexDashboardRequest).
        params: { query: (establishmentId ? { establishment_id: establishmentId } : {}) as never },
      }),
    ),
}
