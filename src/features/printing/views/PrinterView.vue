<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import { device, type PairedPrinter, PrinterError } from '@/core/device'
import BaseAlert from '@/shared/ui/BaseAlert.vue'
import BaseButton from '@/shared/ui/BaseButton.vue'
import BaseSelect from '@/shared/ui/BaseSelect.vue'
import PrintFailedAlert from '../components/PrintFailedAlert.vue'
import { usePrinting } from '../composables/usePrinting'
import { usePrinterSettingsStore } from '../stores/printer-settings'

/**
 * «Impresora» (spec 015, HU-1): elegir entre los equipos emparejados en
 * Android, el ancho del papel y las opciones, y probar con una hoja. Solo en
 * la app; la elección es de este teléfono (A-78).
 */
const settings = usePrinterSettingsStore()
const printing = usePrinting()

const bluetooth = ref<{ supported: boolean; enabled: boolean } | null>(null)
const devices = ref<PairedPrinter[] | null>(null)
const loading = ref(false)
const problem = ref<'permission_denied' | 'bluetooth_off' | 'other' | null>(null)
const testSent = ref(false)

const width = computed({
  get: () => String(settings.width),
  set: (value: string) => (settings.width = value === '80' ? 80 : 58),
})
const qrAsImage = computed({
  get: () => settings.qr === 'image',
  set: (value: boolean) => (settings.qr = value ? 'image' : 'native'),
})

async function refreshStatus() {
  try {
    bluetooth.value = await device().printer.status()
  } catch {
    bluetooth.value = { supported: false, enabled: false }
  }
}

/** Lista los emparejados; la primera vez Android pide el permiso (RF-006). */
async function loadDevices() {
  loading.value = true
  problem.value = null
  try {
    devices.value = await device().printer.listPaired()
  } catch (e) {
    devices.value = null
    const code = e instanceof PrinterError ? e.code : 'unknown'
    problem.value = code === 'permission_denied' || code === 'bluetooth_off' ? code : 'other'
    if (code === 'bluetooth_off') await refreshStatus()
  } finally {
    loading.value = false
  }
}

async function enableBluetooth() {
  try {
    await device().printer.requestEnable()
  } catch {
    // Sigue el aviso con el acceso a los ajustes.
  }
  await refreshStatus()
  if (bluetooth.value?.enabled && devices.value === null && problem.value === 'bluetooth_off') await loadDevices()
}

function choose(printer: PairedPrinter) {
  settings.choose(printer)
  devices.value = null
  testSent.value = false
}

function forget() {
  settings.forget()
  printing.dismiss()
  testSent.value = false
}

async function testPage() {
  testSent.value = false
  await printing.printTestPage()
  testSent.value = printing.failure.value === null
}

onMounted(refreshStatus)
</script>

<template>
  <h1 class="text-xl font-semibold">Impresora</h1>
  <p class="mt-1 text-sm text-ink-muted">
    Imprime tickets y comprobantes directo en tu impresora térmica Bluetooth. La elección se guarda solo en este teléfono.
  </p>

  <div class="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
    <section aria-labelledby="printer-device-title" class="rounded-xl border border-line bg-surface p-4">
      <h2 id="printer-device-title" class="font-semibold">Equipo</h2>

      <BaseAlert v-if="bluetooth && !bluetooth.supported" variant="warning" class="mt-3">
        Este teléfono no tiene Bluetooth. Puedes seguir imprimiendo con «Compartir».
      </BaseAlert>

      <template v-else>
        <BaseAlert v-if="bluetooth && !bluetooth.enabled" variant="warning" title="El Bluetooth está apagado" class="mt-3">
          <p>Enciéndelo para ver tus impresoras.</p>
          <div class="mt-3 flex flex-wrap gap-2">
            <BaseButton @click="enableBluetooth">Encender Bluetooth</BaseButton>
            <BaseButton variant="secondary" @click="device().printer.openSettings()">Abrir ajustes de Bluetooth</BaseButton>
          </div>
        </BaseAlert>

        <div v-if="settings.printer && devices === null" class="mt-3 flex flex-wrap items-center justify-between gap-3" data-test="chosen-printer">
          <div class="min-w-0">
            <p class="truncate font-medium text-ink">{{ settings.printer.name }}</p>
            <p class="text-sm text-ink-muted">{{ settings.printer.address }}</p>
          </div>
          <div class="flex flex-wrap gap-2">
            <BaseButton variant="secondary" :loading="loading" @click="loadDevices">Cambiar</BaseButton>
            <BaseButton variant="ghost" @click="forget">Olvidar</BaseButton>
          </div>
        </div>

        <div v-else-if="devices === null" class="mt-3 space-y-3">
          <p class="text-sm text-ink-muted">
            Primero empareja la impresora en los ajustes de Bluetooth de Android (el PIN suele ser 0000 o 1234). Luego elígela aquí. Android
            pedirá el permiso «Dispositivos cercanos», que solo se usa para imprimir.
          </p>
          <BaseButton :loading="loading" @click="loadDevices">Ver impresoras emparejadas</BaseButton>
        </div>

        <BaseAlert v-if="problem === 'permission_denied'" variant="warning" title="Sin permiso de Bluetooth" class="mt-3" data-test="permission-denied">
          <p>
            Sin el permiso «Dispositivos cercanos» la app no puede ver tus impresoras. Puedes darlo en Ajustes › Apps › Facturación SUNAT ›
            Permisos. Mientras tanto, «Imprimir» sigue abriendo «Compartir».
          </p>
          <BaseButton variant="secondary" class="mt-3" @click="loadDevices">Volver a intentar</BaseButton>
        </BaseAlert>
        <BaseAlert v-else-if="problem === 'other'" variant="error" class="mt-3">No se pudo leer la lista de equipos. Vuelve a intentarlo.</BaseAlert>

        <div v-if="devices !== null" class="mt-3">
          <template v-if="devices.length > 0">
            <p class="text-sm text-ink-muted">Elige tu impresora:</p>
            <ul class="mt-2 grid grid-cols-1 gap-2" data-test="paired-list">
              <li v-for="item in devices" :key="item.address">
                <button
                  type="button"
                  class="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border border-line px-3 py-2 text-left hover:bg-subtle"
                  :class="item.address === settings.printer?.address && 'border-brand-600 bg-brand-50'"
                  @click="choose(item)"
                >
                  <span class="min-w-0">
                    <span class="block truncate font-medium text-ink">{{ item.name }}</span>
                    <span class="block text-xs text-ink-muted">{{ item.address }}</span>
                  </span>
                  <span v-if="item.address === settings.printer?.address" class="text-sm text-brand-700">Elegida</span>
                </button>
              </li>
            </ul>
          </template>
          <div v-else class="space-y-3" data-test="no-paired">
            <p class="text-sm text-ink-muted">No hay equipos emparejados. Enciende la impresora y emparéjala en los ajustes de Bluetooth de Android.</p>
          </div>
          <div class="mt-3 flex flex-wrap gap-2">
            <BaseButton variant="secondary" @click="device().printer.openSettings()">Abrir ajustes de Bluetooth</BaseButton>
            <BaseButton variant="ghost" :loading="loading" @click="loadDevices">Volver a buscar</BaseButton>
            <BaseButton v-if="settings.printer" variant="ghost" @click="devices = null">Cancelar</BaseButton>
          </div>
        </div>
      </template>
    </section>

    <section v-if="settings.printer" aria-labelledby="printer-options-title" class="rounded-xl border border-line bg-surface p-4">
      <h2 id="printer-options-title" class="font-semibold">Opciones</h2>
      <div class="mt-3 space-y-4">
        <div class="space-y-1.5">
          <label for="printer-width" class="block text-sm font-medium text-ink">Ancho del papel</label>
          <BaseSelect id="printer-width" v-model="width">
            <option value="58">58 mm</option>
            <option value="80">80 mm</option>
          </BaseSelect>
        </div>
        <label class="flex items-start gap-3 text-sm">
          <input v-model="qrAsImage" type="checkbox" class="mt-0.5 size-4" data-test="qr-image" />
          <span>
            <span class="font-medium text-ink">Mi impresora no imprime QR</span>
            <span class="block text-ink-muted">El QR de los comprobantes se envía como imagen. Es algo más lento.</span>
          </span>
        </label>
        <label class="flex items-start gap-3 text-sm">
          <input v-model="settings.autoPrint" type="checkbox" class="mt-0.5 size-4" data-test="auto-print" />
          <span>
            <span class="font-medium text-ink">Imprimir al cobrar</span>
            <span class="block text-ink-muted">Cada venta se imprime sola, sin pulsar «Imprimir».</span>
          </span>
        </label>

        <BaseButton variant="secondary" :loading="printing.busy.value" @click="testPage">Imprimir hoja de prueba</BaseButton>
        <BaseAlert v-if="testSent" variant="success">
          Hoja enviada. Revisa que la línea de números llegue al borde y que las tildes se vean bien.
        </BaseAlert>
        <PrintFailedAlert v-if="printing.failure.value" :failure="printing.failure.value" :busy="printing.busy.value" :can-share="false" @retry="testPage" />
      </div>
    </section>
  </div>
</template>
