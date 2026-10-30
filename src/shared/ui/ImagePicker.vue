<script setup lang="ts">
/**
 * Elegir la foto de un producto (spec 016, HU-1 y HU-3). No sube nada: deja
 * en `v-model` la foto ya reducida (`prepareProductPhoto`) y muestra su vista
 * previa; quien la usa decide cuándo subirla. «Descartar» vuelve a la foto
 * guardada sin que el producto cambie. En la app, «Agregar foto» ofrece
 * cámara o galería; en la computadora abre directo el selector de archivos.
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import { device } from '@/core/device'
import type { ImageSource } from '@/core/device/pick-image'
import { ImageRejected, prepareProductPhoto } from '@/shared/images/prepare'
import BaseButton from './BaseButton.vue'
import BaseDialog from './BaseDialog.vue'
import ProductThumb from './ProductThumb.vue'

const props = withDefaults(
  defineProps<{
    /** Foto guardada del producto. */
    image: { url: string; thumb_url: string } | null
    name: string
    /** Ofrece «Quitar foto» si hay una guardada (emite `remove`). */
    removable?: boolean
    disabled?: boolean
  }>(),
  { removable: false, disabled: false },
)

const emit = defineEmits<{ remove: [] }>()

/** Foto elegida y reducida, aún sin subir. */
const pending = defineModel<File | null>({ default: null })

const preparing = ref(false)
const error = ref<string | null>(null)
const choosing = ref(false)
const previewUrl = ref<string | null>(null)

watch(
  pending,
  (file) => {
    if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
    previewUrl.value = file ? URL.createObjectURL(file) : null
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
})

const hasPhoto = computed(() => pending.value !== null || props.image !== null)

function start() {
  if (device().isNative) choosing.value = true
  else void pick('gallery')
}

async function pick(source: ImageSource) {
  choosing.value = false
  error.value = null

  const file = await device().pickImage(source)
  if (!file) return

  preparing.value = true
  try {
    pending.value = await prepareProductPhoto(file)
  } catch (e) {
    if (!(e instanceof ImageRejected)) throw e
    error.value = e.message
  } finally {
    preparing.value = false
  }
}

function discard() {
  pending.value = null
  error.value = null
}
</script>

<template>
  <div class="flex flex-col gap-3 sm:flex-row sm:items-start">
    <div class="w-full max-w-48">
      <div v-if="previewUrl" class="aspect-square w-full overflow-hidden rounded-xl border border-line bg-subtle">
        <img :src="previewUrl" :alt="`Vista previa de la foto de ${name}`" class="size-full object-cover" data-test="preview" />
      </div>
      <ProductThumb v-else :image="image" :name="name" size="lg" />
    </div>

    <div class="flex flex-col gap-2">
      <div class="flex flex-wrap gap-2">
        <BaseButton variant="secondary" :disabled="disabled" :loading="preparing" data-test="choose-photo" @click="start">
          {{ hasPhoto ? 'Cambiar foto' : 'Agregar foto' }}
        </BaseButton>
        <BaseButton v-if="pending" variant="ghost" :disabled="disabled" data-test="discard-photo" @click="discard">Descartar</BaseButton>
        <BaseButton v-else-if="removable && image" variant="ghost" :disabled="disabled" data-test="remove-photo" @click="emit('remove')">
          Quitar foto
        </BaseButton>
      </div>
      <p v-if="preparing" class="text-xs text-ink-muted" role="status">Preparando la foto…</p>
      <p v-if="error" class="text-xs text-danger-700" role="alert" data-test="photo-error">{{ error }}</p>
      <p v-else class="text-xs text-ink-muted">JPG, PNG o WebP de hasta 10 MB. La foto se reduce antes de subirla.</p>
    </div>

    <BaseDialog v-model:open="choosing" title="Foto del producto">
      <div class="grid grid-cols-1 gap-2">
        <BaseButton variant="secondary" block data-autofocus data-test="pick-camera" @click="pick('camera')">Tomar foto</BaseButton>
        <BaseButton variant="secondary" block data-test="pick-gallery" @click="pick('gallery')">Elegir de la galería</BaseButton>
      </div>
      <template #actions>
        <BaseButton variant="ghost" @click="choosing = false">Cancelar</BaseButton>
      </template>
    </BaseDialog>
  </div>
</template>
