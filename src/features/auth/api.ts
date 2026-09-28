import { apiClient } from '@/core/api/client'
import { unwrap, unwrapData } from '@/core/api/errors'
import type { PublicInvitation } from './types'

interface MessageResponse {
  success: true
  message: string
}

export const authFeatureApi = {
  getInvitation: (token: string) =>
    unwrapData<PublicInvitation>(apiClient.GET('/api/v1/invitations/{token}', { params: { path: { token } } })),

  forgotPassword: (email: string) =>
    unwrap<MessageResponse>(apiClient.POST('/api/v1/auth/forgot-password', { body: { email } })),

  resetPassword: (body: { token: string; email: string; password: string; password_confirmation: string }) =>
    unwrap<MessageResponse>(apiClient.POST('/api/v1/auth/reset-password', { body })),
}
