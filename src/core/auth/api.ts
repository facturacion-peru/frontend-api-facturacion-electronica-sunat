import { apiClient } from '@/core/api/client'
import { unwrapData } from '@/core/api/errors'
import type { AcceptInvitationPayload, Session, SessionWithToken } from './types'

/** Llamadas de sesión. El store las usa y las pruebas las sustituyen. */
export const authApi = {
  login: (email: string, password: string) =>
    unwrapData<SessionWithToken>(apiClient.POST('/api/v1/auth/login', { body: { email, password } })),

  me: () => unwrapData<Session>(apiClient.GET('/api/v1/auth/me')),

  logout: () => apiClient.POST('/api/v1/auth/logout'),

  acceptInvitation: (token: string, payload: AcceptInvitationPayload) =>
    unwrapData<SessionWithToken>(
      apiClient.POST('/api/v1/invitations/{token}/accept', { params: { path: { token } }, body: payload }),
    ),
}
