import { apiClient } from '@/core/api/client'
import { unwrap, unwrapData } from '@/core/api/errors'
import type { CollectionResponse } from '@/core/api/types'
import type { CompanyRole } from '@/core/auth/types'
import type { CompanyUser, PendingInvitation } from './types'

export const usersApi = {
  listUsers: async () => (await unwrap<CollectionResponse<CompanyUser>>(apiClient.GET('/api/v1/users'))).data,

  updateUser: (id: number, body: { role?: CompanyRole; active?: boolean }) =>
    unwrapData<CompanyUser>(apiClient.PATCH('/api/v1/users/{user}', { params: { path: { user: id } }, body })),

  listInvitations: async () =>
    (await unwrap<CollectionResponse<PendingInvitation>>(apiClient.GET('/api/v1/invitations'))).data,

  invite: (email: string, role: CompanyRole) =>
    unwrapData<PendingInvitation>(apiClient.POST('/api/v1/invitations', { body: { email, role } })),

  resendInvitation: (id: number) =>
    unwrapData<PendingInvitation>(
      apiClient.POST('/api/v1/invitations/{invitation}/resend', { params: { path: { invitation: id } } }),
    ),

  cancelInvitation: (id: number) =>
    unwrap(apiClient.DELETE('/api/v1/invitations/{invitation}', { params: { path: { invitation: id } } })),
}
