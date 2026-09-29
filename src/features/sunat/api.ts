import { apiClient } from '@/core/api/client'
import { unwrap, unwrapData } from '@/core/api/errors'
import type { CollectionResponse } from '@/core/api/types'
import type { Series, SeriesForm, SunatSettings, SunatStatusInfo } from './types'

export const sunatApi = {
  status: () => unwrapData<SunatStatusInfo>(apiClient.GET('/api/v1/sunat/status')),

  settings: () => unwrapData<SunatSettings>(apiClient.GET('/api/v1/sunat/settings')),

  updateCredentials: (body: { sol_user: string; sol_password: string }) =>
    unwrapData<SunatSettings>(apiClient.PUT('/api/v1/sunat/credentials', { body })),

  uploadCertificate: (file: File, password: string) => {
    const form = new FormData()
    form.append('certificate', file)
    form.append('password', password)

    return unwrapData<SunatSettings>(
      apiClient.POST('/api/v1/sunat/certificate', {
        // Multipart: se envía el FormData tal cual, sin serializar a JSON.
        body: form as never,
        bodySerializer: (body) => body as unknown as FormData,
      }),
    )
  },

  validate: () => unwrapData<SunatSettings>(apiClient.POST('/api/v1/sunat/validate')),
}

export const seriesApi = {
  list: async () => (await unwrap<CollectionResponse<Series>>(apiClient.GET('/api/v1/series'))).data,

  create: (body: SeriesForm) => unwrapData<Series>(apiClient.POST('/api/v1/series', { body })),

  setActive: (id: number, active: boolean) =>
    unwrapData<Series>(apiClient.PATCH('/api/v1/series/{series}', { params: { path: { series: id } }, body: { active } })),
}
