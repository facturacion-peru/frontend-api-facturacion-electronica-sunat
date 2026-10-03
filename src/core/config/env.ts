/**
 * Acceso tipado a la configuración de entorno.
 *
 * Centralizar la lectura de `import.meta.env` evita que las variables se lean
 * sueltas por el código y permite fallar al arrancar —no a mitad de una
 * petición— cuando falta algo obligatorio.
 */

function required(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`Falta la variable de entorno ${name}. Revisa tu archivo .env`)
  }

  return value
}

export const env = {
  /**
   * Base de la API. En desarrollo se deja vacía a propósito: las peticiones
   * salen como `/api/...` contra el propio origen y Vite las reenvía a Laravel.
   */
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? '',

  appName: required(import.meta.env.VITE_APP_NAME, 'VITE_APP_NAME'),

  /**
   * Piloto sin datos reales de clientes (spec 009, A-43): muestra el aviso de
   * no registrar datos personales reales hasta cerrar la revisión legal.
   */
  pilotMode: import.meta.env.VITE_PILOT_MODE === 'true',

  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,
} as const
