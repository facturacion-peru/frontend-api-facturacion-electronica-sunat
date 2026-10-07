import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { ApiError } from '@/core/api/errors'
import { clearToken, getToken, onTokenCleared, setToken } from '@/core/api/token-storage'
import { device } from '@/core/device'
import { authApi } from './api'
import type { AcceptInvitationPayload, Session, SessionWithToken } from './types'

/** El panel de la plataforma no va en la app Android (spec 013, A-65). */
export const PLATFORM_IN_APP_MESSAGE = 'El panel de la plataforma se usa desde la web, no desde la app.'

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

  async function start(result: SessionWithToken): Promise<void> {
    setToken(result.token)
    if (blockedInApp(result)) {
      // Se revoca el token recién creado: en la app no queda sesión de plataforma.
      await logout()
      throw new ApiError(403, PLATFORM_IN_APP_MESSAGE)
    }
    const { token: _token, expires_at: _expiresAt, ...rest } = result
    session.value = rest
  }

  function blockedInApp(s: Session): boolean {
    return device().isNative && s.platform_admin
  }

  async function login(email: string, password: string): Promise<void> {
    await start(await authApi.login(email, password))
  }

  async function acceptInvitation(token: string, payload: AcceptInvitationPayload): Promise<void> {
    await start(await authApi.acceptInvitation(token, payload))
  }

  /** Al recargar la página: recupera la sesión si hay un token guardado. */
  async function restore(): Promise<boolean> {
    if (session.value) return true
    if (!getToken()) return false

    try {
      const restored = await authApi.me()
      if (blockedInApp(restored)) {
        await logout()
        return false
      }
      session.value = restored
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
