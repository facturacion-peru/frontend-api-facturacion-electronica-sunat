import { ref } from 'vue'

/**
 * Versión mínima que exige la API cuando la app Android quedó desactualizada
 * (426, spec 013, A-67); null mientras la versión sirva. La interfaz la
 * observa para pedir actualizar. La sesión y la venta en curso no se tocan.
 */
export const updateRequired = ref<string | null>(null)
