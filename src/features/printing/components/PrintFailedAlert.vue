<script setup lang="ts">
import { ref } from 'vue'

import { device } from '@/core/device'
import BaseAlert from '@/shared/ui/BaseAlert.vue'
import BaseButton from '@/shared/ui/BaseButton.vue'
import type { PrintFailure } from '../composables/usePrinting'

/**
 * Por qué no imprimió y qué hacer (spec 015, HU-4, RF-005): «Reintentar» y
 * «Compartir PDF», más la salida que corresponde al motivo. La venta ya está
 * registrada; imprimir no la cambia.
 */
const props = withDefaults(defineProps<{ failure: PrintFailure; busy?: boolean; canShare?: boolean }>(), { busy: false, canShare: true })
const emit = defineEmits<{ retry: []; share: [] }>()

const enabling = ref(false)

async function enableBluetooth() {
  enabling.value = true
  try {
    if (await device().printer.requestEnable()) emit('retry')
  } catch {
    // Si no se pudo encender, el aviso sigue a la vista.
  } finally {
    enabling.value = false
  }
}

const choosePrinter = ['not_paired', 'permission_denied'].includes(props.failure.code)
</script>

<template>
  <BaseAlert variant="error" title="No se imprimió" data-test="print-failed">
    <p>{{ failure.message }}</p>
    <div class="mt-3 flex flex-wrap gap-2">
      <BaseButton v-if="failure.code === 'bluetooth_off'" :loading="enabling" @click="enableBluetooth">Encender Bluetooth</BaseButton>
      <BaseButton :variant="failure.code === 'bluetooth_off' ? 'secondary' : 'primary'" :loading="busy" @click="emit('retry')">Reintentar</BaseButton>
      <BaseButton v-if="canShare" variant="secondary" :disabled="busy" @click="emit('share')">Compartir PDF</BaseButton>
      <RouterLink
        v-if="choosePrinter"
        :to="{ name: 'printer' }"
        class="inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-medium text-brand-700 hover:bg-brand-50"
      >
        Elegir otra impresora
      </RouterLink>
    </div>
  </BaseAlert>
</template>
