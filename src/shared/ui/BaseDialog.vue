<script setup lang="ts">
/**
 * Diálogo modal accesible: atrapa el foco, se cierra con Escape y devuelve
 * el foco al elemento que lo abrió.
 */
import { nextTick, ref, useId, watch } from 'vue'

defineProps<{ title: string }>()

const open = defineModel<boolean>('open', { default: false })
const panel = ref<HTMLElement | null>(null)
const titleId = useId()
let opener: HTMLElement | null = null

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function focusables(): HTMLElement[] {
  return panel.value ? Array.from(panel.value.querySelectorAll<HTMLElement>(FOCUSABLE)) : []
}

watch(open, async (isOpen) => {
  if (isOpen) {
    opener = document.activeElement as HTMLElement | null
    await nextTick()
    ;(focusables()[0] ?? panel.value)?.focus()
  } else {
    opener?.focus()
  }
})

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    open.value = false
    return
  }

  if (event.key !== 'Tab') return

  const items = focusables()
  if (items.length === 0) return

  const first = items[0]!
  const last = items[items.length - 1]!

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div class="absolute inset-0 bg-black/60" aria-hidden="true" @click="open = false" />
      <div
        ref="panel"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
        tabindex="-1"
        class="relative w-full max-w-lg rounded-t-2xl bg-surface p-5 shadow-xl sm:rounded-2xl"
        @keydown="onKeydown"
      >
        <h2 :id="titleId" class="text-lg font-semibold text-ink">{{ title }}</h2>
        <div class="mt-4"><slot /></div>
        <div v-if="$slots.actions" class="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <slot name="actions" />
        </div>
      </div>
    </div>
  </Teleport>
</template>
