/**
 * Exportar e importar datos (spec 014). Las respuestas se tipan a mano: el
 * OpenAPI solo documenta las peticiones (las protege ImportPreviewResourceTest).
 */

export type ExportFormat = 'xlsx' | 'csv'
export type ImportKind = 'products' | 'customers'
export type ImportMode = 'create' | 'upsert'

export type SaleKind = 'ticket' | 'receipt' | 'invoice' | 'credit_note'

export interface SalesExportFilters {
  from: string
  to: string
  types: SaleKind[]
  statuses: string[]
  format: ExportFormat
}

export interface ImportIssue {
  /** Fila como en Excel (el encabezado es la 1); null si es de todo el archivo. */
  row: number | null
  column: string
  message: string
}

export type ImportValue = string | boolean | null

export interface ImportCreate {
  row: number
  action: 'create'
  key: string
  name: string
  /** Stock inicial (solo productos). */
  stock?: string | null
}

export interface ImportUpdate {
  row: number
  action: 'update'
  key: string
  name: string
  fields: Record<string, { from: ImportValue; to: ImportValue }>
}

export type ImportChange = ImportCreate | ImportUpdate

export interface ImportPreview {
  id: string
  kind: ImportKind
  mode: ImportMode
  expires_at: string
  can_confirm: boolean
  summary: { rows: number; create: number; update: number; unchanged: number; errors: number }
  errors: ImportIssue[]
  warnings: ImportIssue[]
  changes: ImportChange[]
}

export interface ImportResult {
  created: number
  updated: number
  entries: number
}
