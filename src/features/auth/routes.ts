import type { RouteRecordRaw } from 'vue-router'

/** Pantallas sin sesión; se montan dentro de AuthLayout. */
export const authRoutes: RouteRecordRaw[] = [
  {
    path: 'login',
    name: 'login',
    component: () => import('./views/LoginView.vue'),
    meta: { guestOnly: true, title: 'Iniciar sesión' },
  },
  {
    path: 'recuperar',
    name: 'forgot-password',
    component: () => import('./views/ForgotPasswordView.vue'),
    meta: { guestOnly: true, title: 'Recuperar contraseña' },
  },
  {
    path: 'restablecer',
    name: 'reset-password',
    component: () => import('./views/ResetPasswordView.vue'),
    meta: { public: true, title: 'Nueva contraseña' },
  },
  {
    path: 'invitacion/:token',
    name: 'accept-invitation',
    component: () => import('./views/AcceptInvitationView.vue'),
    meta: { public: true, title: 'Activa tu cuenta' },
  },
]
