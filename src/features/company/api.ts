import { apiClient } from '@/core/api/client'
import { unwrapData } from '@/core/api/errors'
import type { ResourceResponse } from '@/core/api/types'
import { uploadForm, type UploadOptions } from '@/core/api/upload'
import type { CompanyContactForm, CompanyDetail } from './types'

export const companyApi = {
  get: () => unwrapData<CompanyDetail>(apiClient.GET('/api/v1/company')),

  update: (body: CompanyContactForm) => unwrapData<CompanyDetail>(apiClient.PATCH('/api/v1/company', { body })),

  /** Con avance (spec 016); el logo va tal cual, sin reducir, para no perder la transparencia. */
  uploadLogo: async (file: File, options?: UploadOptions) => {
    const form = new FormData()
    form.append('logo', file)

    return (await uploadForm<ResourceResponse<CompanyDetail>>('/api/v1/company/logo', form, options)).data
  },
}
