import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { ApiError } from '@/core/api/errors'
import { clearToken, getToken, onTokenCleared, setToken } from '@/core/api/token-storage'
import { authApi } from './api'
import type { AcceptInvitationPayload, Session, SessionWithToken } from './types'

/**
 * Sesión del usuario: quién es, su empresa y su rol.
 *
 * El token vive en token-storage (lo necesita el cliente HTTP fuera de
 * componentes); aquí solo se guarda lo que la interfaz muestra. La
 * autorización real la hace siempre la API.
 */
export const useSessionStore = defineStore('session', () => {
  const session = ref<Session | null>(null)

  const isAuthenticated = computed(() => session.value !== null && getToken() !== null)
  const role = computed(() => session.value?.role ?? null)
  const isCompanyAdmin = computed(() => role.value === 'company_admin')

  // Un 401 en cualquier petición borra el token: la sesión se va con él.
  onTokenCleared(() => {
    session.value = null
  })

  function start(result: SessionWithToken): void {
    setToken(result.token)
    const { token: _token, expires_at: _expiresAt, ...rest } = result
    session.value = rest
  }

  async function login(email: string, password: string): Promise<void> {
    start(await authApi.login(email, password))
  }

  async function acceptInvitation(token: string, payload: AcceptInvitationPayload): Promise<void> {
    start(await authApi.acceptInvitation(token, payload))
  }

  /** Al recargar la página: recupera la sesión si hay un token guardado. */
  async function restore(): Promise<boolean> {
    if (session.value) return true
    if (!getToken()) return false

    try {
      session.value = await authApi.me()
      return true
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        clearToken()
      }
      session.value = null
      return false
    }
  }

  async function logout(): Promise<void> {
    try {
      await authApi.logout()
    } catch {
      // Sin red o token ya inválido: la sesión local se cierra igual.
    } finally {
      clearToken()
      session.value = null
    }
  }

  return { session, isAuthenticated, role, isCompanyAdmin, login, acceptInvitation, restore, logout }
})
