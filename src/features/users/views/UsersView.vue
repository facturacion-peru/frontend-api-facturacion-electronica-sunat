<script setup lang="ts">
import { onMounted, ref } from 'vue'

import { ApiError } from '@/core/api/errors'
import { useSessionStore } from '@/core/auth/session-store'
import type { CompanyRole } from '@/core/auth/types'
import BaseAlert from '@/shared/ui/BaseAlert.vue'
import BaseBadge from '@/shared/ui/BaseBadge.vue'
import BaseButton from '@/shared/ui/BaseButton.vue'
import EmptyState from '@/shared/ui/EmptyState.vue'
import { usersApi } from '../api'
import InviteUserDialog from '../components/InviteUserDialog.vue'
import { roleLabels, type CompanyUser, type PendingInvitation } from '../types'

const session = useSessionStore()

const users = ref<CompanyUser[]>([])
const invitations = ref<PendingInvitation[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const notice = ref<string | null>(null)
const busyId = ref<string | null>(null)
const inviteOpen = ref(false)

const dateFormat = new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short' })

async function load() {
  loading.value = true
  try {
    ;[users.value, invitations.value] = await Promise.all([usersApi.listUsers(), usersApi.listInvitations()])
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : 'No se pudo cargar la lista de usuarios.'
  } finally {
    loading.value = false
  }
}

/** Ejecuta una acción de fila y muestra el mensaje de la API si falla. */
async function run(key: string, action: () => Promise<unknown>, success: string) {
  busyId.value = key
  error.value = null
  notice.value = null
  try {
    await action()
    notice.value = success
    await load()
  } catch (e) {
    if (!(e instanceof ApiError)) throw e
    error.value = Object.values(e.fieldErrors)[0]?.[0] ?? e.message
  } finally {
    busyId.value = null
  }
}

function changeRole(user: CompanyUser, role: CompanyRole) {
  return run(`role-${user.id}`, () => usersApi.updateUser(user.id, { role }), `Rol de ${user.name} actualizado.`)
}

function toggleActive(user: CompanyUser) {
  return run(
    `active-${user.id}`,
    () => usersApi.updateUser(user.id, { active: !user.active }),
    user.active ? `${user.name} ya no puede entrar.` : `${user.name} puede volver a entrar.`,
  )
}

function onInvited() {
  notice.value = 'Invitación enviada.'
  load()
}

onMounted(load)
</script>

<template>
  <div class="flex flex-wrap items-center justify-between gap-3">
    <h1 class="text-xl font-semibold">Usuarios</h1>
    <BaseButton @click="inviteOpen = true">Invitar usuario</BaseButton>
  </div>

  <div class="mt-4 space-y-3">
    <BaseAlert v-if="error" variant="error">{{ error }}</BaseAlert>
    <BaseAlert v-if="notice" variant="success">{{ notice }}</BaseAlert>
  </div>

  <p v-if="loading && users.length === 0" class="mt-6 text-sm text-ink-muted">Cargando…</p>

  <template v-else>
    <ul class="mt-4 divide-y divide-line rounded-xl border border-line bg-surface">
      <li v-for="user in users" :key="user.id" class="flex flex-col gap-3 p-4 sm:flex-row sm:items-center" data-test="user-row">
        <div class="min-w-0 flex-1">
          <p class="flex items-center gap-2 font-medium">
            <span class="truncate">{{ user.name }}</span>
            <BaseBadge v-if="!user.active" variant="danger">Desactivado</BaseBadge>
            <BaseBadge v-if="user.id === session.session?.user.id" variant="info">Tú</BaseBadge>
          </p>
          <p class="truncate text-sm text-ink-muted">{{ user.email }}</p>
          <p class="text-xs text-ink-muted">
            Último acceso: {{ user.last_login_at ? dateFormat.format(new Date(user.last_login_at)) : 'nunca' }}
          </p>
        </div>
        <div class="flex items-center gap-2">
          <label :for="`role-${user.id}`" class="sr-only">Rol de {{ user.name }}</label>
          <select
            :id="`role-${user.id}`"
            class="min-h-11 rounded-lg border border-line bg-surface px-3 text-sm"
            :value="user.role"
            :disabled="busyId !== null"
            @change="changeRole(user, ($event.target as HTMLSelectElement).value as CompanyRole)"
          >
            <option v-for="(label, value) in roleLabels" :key="value" :value="value">{{ label }}</option>
          </select>
          <BaseButton
            :variant="user.active ? 'secondary' : 'primary'"
            :loading="busyId === `active-${user.id}`"
            :disabled="busyId !== null"
            @click="toggleActive(user)"
          >
            {{ user.active ? 'Desactivar' : 'Reactivar' }}
          </BaseButton>
        </div>
      </li>
    </ul>

    <h2 class="mt-8 text-lg font-semibold">Invitaciones pendientes</h2>
    <EmptyState v-if="invitations.length === 0" class="mt-3" title="No hay invitaciones pendientes" />
    <ul v-else class="mt-3 divide-y divide-line rounded-xl border border-line bg-surface">
      <li v-for="invitation in invitations" :key="invitation.id" class="flex flex-col gap-3 p-4 sm:flex-row sm:items-center" data-test="invitation-row">
        <div class="min-w-0 flex-1">
          <p class="flex items-center gap-2">
            <span class="truncate font-medium">{{ invitation.email }}</span>
            <BaseBadge :variant="invitation.expired ? 'warning' : 'neutral'">
              {{ invitation.expired ? 'Vencida' : roleLabels[invitation.role] }}
            </BaseBadge>
          </p>
          <p class="text-xs text-ink-muted">Vence: {{ dateFormat.format(new Date(invitation.expires_at)) }}</p>
        </div>
        <div class="flex gap-2">
          <BaseButton
            variant="secondary"
            :loading="busyId === `resend-${invitation.id}`"
            :disabled="busyId !== null"
            @click="run(`resend-${invitation.id}`, () => usersApi.resendInvitation(invitation.id), `Invitación reenviada a ${invitation.email}.`)"
          >
            Reenviar
          </BaseButton>
          <BaseButton
            variant="ghost"
            :loading="busyId === `cancel-${invitation.id}`"
            :disabled="busyId !== null"
            @click="run(`cancel-${invitation.id}`, () => usersApi.cancelInvitation(invitation.id), 'Invitación cancelada.')"
          >
            Cancelar
          </BaseButton>
        </div>
      </li>
    </ul>
  </template>

  <InviteUserDialog v-model:open="inviteOpen" @invited="onInvited" />
</template>
