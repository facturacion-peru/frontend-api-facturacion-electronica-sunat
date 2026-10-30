<script setup lang="ts">
/**
 * El local donde se trabaja (spec 017, HU-2). Con un solo local activo en la
 * empresa no se pinta (RF-010). Con uno permitido es solo su nombre (el
 * vendedor de una sucursal); con varios, un botón que abre la lista.
 *
 * Elegir no pierde nada: la venta en curso es de cada local y queda guardada
 * en el anterior (`draftCount` lo avisa). `open()` deja que «Vender» pida
 * elegir cuando aún no hay local.
 */
import { ref } from 'vue'

import BaseButton from '@/shared/ui/BaseButton.vue'
import BaseDialog from '@/shared/ui/BaseDialog.vue'
import { useEstablishmentStore } from './store'

withDefaults(defineProps<{ collapsed?: boolean; draftCount?: number }>(), { collapsed: false, draftCount: 0 })
const emit = defineEmits<{ changed: [id: number] }>()

const store = useEstablishmentStore()
const dialog = ref(false)

function open() {
  if (store.allowed.length > 1) dialog.value = true
}

function pick(id: number) {
  dialog.value = false
  if (id === store.current?.id) return
  store.choose(id)
  emit('changed', id)
}

defineExpose({ open })
</script>

<template>
  <template v-if="store.multi && store.allowed.length > 0">
    <button
      v-if="store.allowed.length > 1"
      type="button"
      data-test="establishment-switcher"
      class="flex min-h-11 w-full min-w-0 items-center gap-2 rounded-lg px-2 text-left text-sm text-ink transition hover:bg-subtle"
      :class="collapsed && 'lg:justify-center lg:px-0'"
      :aria-label="collapsed ? `Local: ${store.current?.name ?? 'sin elegir'}. Cambiar` : undefined"
      :title="collapsed ? (store.current?.name ?? 'Elegir local') : undefined"
      @click="open"
    >
      <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" class="size-5 shrink-0 text-ink-muted">
        <path
          fill-rule="evenodd"
          d="m9.69 18.933.003.001C9.89 19.02 10 19 10 19s.11.02.308-.066l.002-.001.006-.003.018-.008a5.741 5.741 0 0 0 .281-.14c.186-.096.446-.24.757-.433.62-.384 1.445-.966 2.274-1.765C15.302 14.988 17 12.493 17 9A7 7 0 1 0 3 9c0 3.492 1.698 5.988 3.355 7.584a13.731 13.731 0 0 0 2.273 1.765 11.842 11.842 0 0 0 .976.544l.062.029.018.008.006.003ZM10 11.25a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5Z"
          clip-rule="evenodd"
        />
      </svg>
      <span class="min-w-0 flex-1 truncate" :class="collapsed && 'lg:sr-only'">
        <span class="sr-only">Local: </span>{{ store.current?.name ?? 'Elegir local' }}
      </span>
      <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" class="size-4 shrink-0 text-ink-muted" :class="collapsed && 'lg:hidden'">
        <path
          fill-rule="evenodd"
          d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
          clip-rule="evenodd"
        />
      </svg>
    </button>
    <p
      v-else
      data-test="establishment-name"
      class="flex min-h-11 min-w-0 items-center gap-2 px-2 text-sm text-ink"
      :class="collapsed && 'lg:justify-center lg:px-0'"
      :title="collapsed ? store.current?.name : undefined"
    >
      <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" class="size-5 shrink-0 text-ink-muted">
        <path
          fill-rule="evenodd"
          d="m9.69 18.933.003.001C9.89 19.02 10 19 10 19s.11.02.308-.066l.002-.001.006-.003.018-.008a5.741 5.741 0 0 0 .281-.14c.186-.096.446-.24.757-.433.62-.384 1.445-.966 2.274-1.765C15.302 14.988 17 12.493 17 9A7 7 0 1 0 3 9c0 3.492 1.698 5.988 3.355 7.584a13.731 13.731 0 0 0 2.273 1.765 11.842 11.842 0 0 0 .976.544l.062.029.018.008.006.003ZM10 11.25a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5Z"
          clip-rule="evenodd"
        />
      </svg>
      <span class="min-w-0 truncate" :class="collapsed && 'lg:sr-only'"><span class="sr-only">Local: </span>{{ store.current?.name }}</span>
    </p>
  </template>

  <BaseDialog v-model:open="dialog" title="¿En qué local trabajas?">
    <p v-if="draftCount > 0 && store.current" class="mb-3 text-sm text-ink-muted" data-test="draft-kept">
      Tu venta en curso ({{ draftCount }} {{ draftCount === 1 ? 'producto' : 'productos' }}) queda guardada en {{ store.current.name }}.
      La encontrarás al volver a ese local.
    </p>
    <ul class="divide-y divide-line rounded-xl border border-line">
      <li v-for="establishment in store.allowed" :key="establishment.id">
        <button
          type="button"
          class="flex min-h-12 w-full items-center gap-3 px-4 py-2 text-left hover:bg-canvas"
          :aria-current="establishment.id === store.current?.id || undefined"
          :data-autofocus="establishment.id === store.current?.id || undefined"
          :data-test="`pick-establishment-${establishment.id}`"
          @click="pick(establishment.id)"
        >
          <span class="min-w-0 flex-1">
            <span class="block truncate font-medium text-ink">{{ establishment.name }}</span>
            <span class="block truncate text-xs text-ink-muted">{{ establishment.code }} · {{ establishment.address }}</span>
          </span>
          <svg
            v-if="establishment.id === store.current?.id"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
            class="size-5 shrink-0 text-brand-700"
          >
            <path
              fill-rule="evenodd"
              d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
              clip-rule="evenodd"
            />
          </svg>
        </button>
      </li>
    </ul>
    <template #actions>
      <BaseButton variant="secondary" @click="dialog = false">Cancelar</BaseButton>
    </template>
  </BaseDialog>
</template>
