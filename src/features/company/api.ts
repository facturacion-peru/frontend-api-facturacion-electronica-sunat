import { apiClient } from '@/core/api/client'
import { unwrapData } from '@/core/api/errors'
import type { CompanyContactForm, CompanyDetail } from './types'

export const companyApi = {
  get: () => unwrapData<CompanyDetail>(apiClient.GET('/api/v1/company')),

  update: (body: CompanyContactForm) => unwrapData<CompanyDetail>(apiClient.PATCH('/api/v1/company', { body })),

  uploadLogo: (file: File) => {
    const form = new FormData()
    form.append('logo', file)

    return unwrapData<CompanyDetail>(
      apiClient.POST('/api/v1/company/logo', {
        // Multipart: se envía el FormData tal cual, sin serializar a JSON.
        body: form as never,
        bodySerializer: (body) => body as unknown as FormData,
      }),
    )
  },
}
