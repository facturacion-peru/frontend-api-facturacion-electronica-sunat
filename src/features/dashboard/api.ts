import { apiClient } from '@/core/api/client'
import { unwrapData } from '@/core/api/errors'
import type { DashboardSummary } from './types'

export const dashboardApi = {
  summary: () => unwrapData<DashboardSummary>(apiClient.GET('/api/v1/dashboard')),
}
