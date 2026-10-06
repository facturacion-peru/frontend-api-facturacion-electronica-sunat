/**
 * Capacidades del dispositivo que cambian entre la web y la app Android
 * (constitución, principio VII; spec 013). El resto del código usa solo esta
 * interfaz y no sabe dónde corre.
 */
export interface Device {
  /** true dentro de la app Android. */
  readonly isNative: boolean
  /** Versión instalada de la app (x.y.z); null en la web. */
  readonly appVersion: string | null
  /** Almacén de secretos: Keystore en Android, localStorage en la web. */
  readonly secureStore: {
    get(key: string): Promise<string | null>
    set(key: string, value: string): Promise<void>
    remove(key: string): Promise<void>
  }
  /** Entrega un archivo al usuario: descarga en la web, «Compartir» en Android (A-63). */
  deliverFile(blob: Blob, filename: string, options?: { open?: boolean }): Promise<void>
  /**
   * Informa ya el estado de conexión y luego cada cambio; devuelve cómo dejar
   * de escuchar. En Android el WebView no actualiza `navigator.onLine`.
   */
  onConnectionChange(handler: (online: boolean) => void): () => void
  /** Escucha el botón «Atrás» de Android; devuelve cómo dejar de escuchar. */
  onBackButton(handler: () => void): () => void
  /** Manda la app al fondo sin cerrarla (Android). */
  minimize(): Promise<void>
}
