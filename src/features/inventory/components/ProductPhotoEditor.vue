<script setup lang="ts">
/**
 * Poner, cambiar o quitar la foto de un producto ya guardado (spec 016, HU-1).
 * Va aparte de «Guardar»: la foto se sube con su botón, su avance y «Cancelar»,
 * y quitarla pide confirmación. Sin conexión no se ofrece subir (la foto
 * necesita red); los datos del producto no dependen de ella (RF-010).
 */
import { onBeforeUnmount, onMounted, ref } from 'vue'

import { UploadCancelled } from '@/core/api/upload'
import { device } from '@/core/device'
import { useApiForm } from '@/shared/composables/useApiForm'
import BaseButton from '@/shared/ui/BaseButton.vue'
import BaseDialog from '@/shared/ui/BaseDialog.vue'
import ImagePicker from '@/shared/ui/ImagePicker.vue'
import { inventoryApi } from '../api'
import type { Product } from '../types'

const props = defineProps<{ product: Product }>()
const emit = defineEmits<{ updated: [product: Product, message: string] }>()

const { submitting, generalError, fieldError, submit } = useApiForm()
const pending = ref<File | null>(null)
const progress = ref(0)
const confirmRemove = ref(false)
const online = ref(true)
let controller: AbortController | null = null

let stopListening = () => {}
onMounted(() => (stopListening = device().onConnectionChange((value) => (online.value = value))))
onBeforeUnmount(() => {
  stopListening()
  controller?.abort()
})

async function upload() {
  if (!pending.value) return false
  const photo = pending.value
  controller = new AbortController()
  progress.value = 0

  const ok = await submit(async () => {
    try {
      const product = await inventoryApi.uploadImage(props.product.id, photo, {
        onProgress: (fraction) => (progress.value = fraction),
        signal: controller!.signal,
      })
      pending.value = null
      emit('updated', product, 'Foto guardada.')
    } catch (e) {
      // Cancelar no es un error: la foto elegida queda para reintentar.
      if (!(e instanceof UploadCancelled)) throw e
    }
  })
  controller = null
  progress.value = 0
  return ok
}

function cancel() {
  controller?.abort()
}

async function remove() {
  confirmRemove.value = false
  await submit(async () => emit('updated', await inventoryApi.removeImage(props.product.id), 'Foto quitada.'))
}
</script>

<template>
  <section aria-labelledby="photo-title">
    <h2 id="photo-title" class="text-sm font-medium">Foto</h2>
    <div class="mt-2">
      <ImagePicker
        v-model="pending"
        :image="product.image"
        :name="product.name"
        removable
        :disabled="submitting"
        @remove="confirmRemove = true"
      />
    </div>

    <div v-if="pending" class="mt-3 flex flex-wrap items-center gap-2">
      <template v-if="submitting">
        <div
          class="h-2 w-40 overflow-hidden rounded-full bg-subtle"
          role="progressbar"
          aria-label="Subiendo la foto"
          :aria-valuenow="Math.round(progress * 100)"
          aria-valuemin="0"
          aria-valuemax="100"
        >
          <div class="h-full bg-brand-600 transition-[width]" :style="{ width: `${Math.round(progress * 100)}%` }" />
        </div>
        <span class="text-xs text-ink-muted">Subiendo… {{ Math.round(progress * 100) }} %</span>
        <BaseButton variant="ghost" data-test="cancel-upload" @click="cancel">Cancelar</BaseButton>
      </template>
      <BaseButton v-else :disabled="!online" data-test="upload-photo" @click="upload">Subir foto</BaseButton>
    </div>

    <p v-if="pending && !online" class="mt-2 text-xs text-warning-700" role="status">Necesitas conexión para subir la foto.</p>
    <p v-if="fieldError('image') || generalError" class="mt-2 text-xs text-danger-700" role="alert" data-test="upload-error">
      {{ fieldError('image') ?? generalError }}
    </p>

    <BaseDialog v-model:open="confirmRemove" title="¿Quitar la foto?">
      <p class="text-sm text-ink-muted">El producto se mostrará sin foto en «Vender» y en la lista. Puedes subir otra cuando quieras.</p>
      <template #actions>
        <BaseButton variant="secondary" @click="confirmRemove = false">Cancelar</BaseButton>
        <BaseButton variant="danger" data-autofocus data-test="confirm-remove" @click="remove">Quitar foto</BaseButton>
      </template>
    </BaseDialog>
  </section>
</template>
