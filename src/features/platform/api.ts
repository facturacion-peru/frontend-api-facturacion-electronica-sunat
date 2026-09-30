import { apiClient } from '@/core/api/client'
import { unwrap, unwrapData } from '@/core/api/errors'
import type { PaginatedResponse } from '@/core/api/types'
import type {
  CompanyFilters,
  LegalDataForm,
  NewCompanyForm,
  PlatformAuditEntry,
  PlatformCompany,
  PlatformCompanyDetail,
  SupportDocument,
  Ubigeo,
} from './types'

const companyPath = (id: number) => ({ params: { path: { company: id } } })

export const platformApi = {
  companies: (filters: CompanyFilters) =>
    unwrap<PaginatedResponse<PlatformCompany>>(
      apiClient.GET('/api/v1/platform/companies', {
        params: {
          query: {
            ...(filters.search && { search: filters.search }),
            ...(filters.status && { status: filters.status }),
            ...(filters.issues && { issues: true }),
            page: filters.page,
          },
        },
      }),
    ),

  company: (id: number) => unwrapData<PlatformCompanyDetail>(apiClient.GET('/api/v1/platform/companies/{company}', companyPath(id))),

  create: (body: NewCompanyForm) => unwrapData<PlatformCompanyDetail>(apiClient.POST('/api/v1/platform/companies', { body })),

  update: (id: number, body: Partial<LegalDataForm>) =>
    unwrapData<PlatformCompanyDetail>(apiClient.PATCH('/api/v1/platform/companies/{company}', { ...companyPath(id), body })),

  deactivate: (id: number, reason: string) =>
    unwrapData<PlatformCompanyDetail>(apiClient.POST('/api/v1/platform/companies/{company}/deactivate', { ...companyPath(id), body: { reason } })),

  activate: (id: number) => unwrapData<PlatformCompanyDetail>(apiClient.POST('/api/v1/platform/companies/{company}/activate', companyPath(id))),

  resendAdminInvitation: (id: number) =>
    unwrapData<PlatformCompanyDetail>(apiClient.POST('/api/v1/platform/companies/{company}/admin-invitation/resend', companyPath(id))),

  searchUbigeos: async (q: string) =>
    (await unwrap<{ data: Ubigeo[] }>(apiClient.GET('/api/v1/platform/ubigeos/search', { params: { query: { q } } }))).data,

  supportDocuments: (filters: { status: '' | 'pending' | 'rejected'; company_id: number | null; page: number }) =>
    unwrap<PaginatedResponse<SupportDocument>>(
      apiClient.GET('/api/v1/platform/sales-documents', {
        params: {
          query: {
            ...(filters.status && { status: filters.status }),
            ...(filters.company_id && { company_id: filters.company_id }),
            page: filters.page,
          },
        },
      }),
    ),

  retry: (id: number) =>
    unwrapData<SupportDocument>(
      apiClient.POST('/api/v1/platform/sales-documents/{platformDocument}/retry', { params: { path: { platformDocument: id } } }),
    ),

  audit: (filters: { action: string; page: number }) =>
    unwrap<PaginatedResponse<PlatformAuditEntry>>(
      apiClient.GET('/api/v1/platform/audit-logs', { params: { query: { ...(filters.action && { action: filters.action }), page: filters.page } } }),
    ),
}
