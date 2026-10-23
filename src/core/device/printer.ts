/** Impresora térmica Bluetooth emparejada en Android (spec 015). */
export interface PairedPrinter {
  name: string
  address: string
}

/** Motivos de fallo que informa el plugin (android/…/printer/BluetoothPrinterPlugin.java). */
export type PrinterErrorCode =
  | 'permission_denied'
  | 'bluetooth_off'
  | 'not_paired'
  | 'connect_failed'
  | 'write_failed'
  | 'unsupported'
  | 'invalid'
  | 'unknown'

const CODES: readonly PrinterErrorCode[] = ['permission_denied', 'bluetooth_off', 'not_paired', 'connect_failed', 'write_failed', 'unsupported', 'invalid']

export class PrinterError extends Error {
  constructor(
    readonly code: PrinterErrorCode,
    message = 'No se pudo imprimir.',
  ) {
    super(message)
    this.name = 'PrinterError'
  }

  /** Traduce el rechazo de un plugin de Capacitor (lleva `code`). */
  static from(error: unknown): PrinterError {
    if (error instanceof PrinterError) return error
    const code = (error as { code?: unknown } | null)?.code
    const message = error instanceof Error ? error.message : undefined
    return new PrinterError(CODES.includes(code as PrinterErrorCode) ? (code as PrinterErrorCode) : 'unknown', message)
  }
}

export interface DevicePrinter {
  /** false en la web: ahí se imprime como siempre. */
  readonly available: boolean
  status(): Promise<{ supported: boolean; enabled: boolean }>
  /** Pide el permiso si hace falta; lanza PrinterError('permission_denied') si se niega. */
  listPaired(): Promise<PairedPrinter[]>
  print(address: string, bytes: Uint8Array): Promise<void>
  openSettings(): Promise<void>
  /** Pide encender el Bluetooth; devuelve si quedó encendido. */
  requestEnable(): Promise<boolean>
}
