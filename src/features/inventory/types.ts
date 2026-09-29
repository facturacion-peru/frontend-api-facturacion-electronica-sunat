/**
 * Tipos del inventario. Reflejan ProductResource, LotResource y
 * MovementResource de la API (protegidos por tests/Feature/Contract).
 */

export type ProductType = 'good' | 'service'
export type IgvAffectation = '10' | '20' | '30'
export type MovementType = 'entry' | 'sale' | 'adjustment' | 'return' | 'reversal'
export type AdjustmentReason = 'count' | 'shrinkage' | 'damage' | 'expiry' | 'error' | 'other'

export interface Product {
  id: number
  code: string
  name: string
  type: ProductType
  unit: string
  sale_price: string
  igv_affectation: IgvAffectation
  min_stock: string | null
  tracks_expiry: boolean
  active: boolean
  stock: string | null
  available_stock: string | null
  /** Solo para el administrador (RF-022). */
  last_unit_cost?: string | null
  created_at: string | null
}

export interface ProductPayload {
  code: string
  name: string
  type: ProductType
  unit: string
  sale_price: string
  igv_affectation: IgvAffectation
  min_stock: string | null
  tracks_expiry: boolean
  active?: boolean
}

export interface ProductFilters {
  search: string
  type: '' | ProductType
  status: 'active' | 'inactive' | 'all'
  page: number
}

export interface Lot {
  id: number
  lot_number: string
  received_at: string
  expires_at: string | null
  expired: boolean
  initial_quantity: string
  remaining_quantity: string
  /** Solo para el administrador (RF-022). */
  unit_cost?: string | null
  reference: string | null
  created_by: { id: number; name: string } | null
  created_at: string | null
}

export interface Movement {
  id: number
  type: MovementType
  quantity: string
  lot: { id: number; lot_number: string | null }
  lot_balance_after: string
  product_balance_after: string
  reason: AdjustmentReason | null
  note: string | null
  source: { type: string; id: number } | null
  reverses_id: number | null
  reversed: boolean
  created_by: { id: number; name: string } | null
  created_at: string
}

export interface StockEntryPayload {
  quantity: string
  received_at?: string
  lot_number?: string
  expires_at?: string
  unit_cost?: string
  reference?: string
}

export interface CatalogItem {
  code: string
  label: string
}

export interface InventoryCatalogs {
  units: (CatalogItem & { allows_decimals: boolean })[]
  igv_affectations: CatalogItem[]
  adjustment_reasons: CatalogItem[]
}

export interface LotAlert {
  id: number
  lot_number: string
  product: { id: number; code: string; name: string }
  expires_at: string
  days_left: number
  remaining_quantity: string
}

export interface InventoryAlerts {
  low_stock: { id: number; code: string; name: string; available_stock: string; min_stock: string }[]
  expiring: LotAlert[]
  expired: LotAlert[]
}

export const movementLabels: Record<MovementType, string> = {
  entry: 'Entrada',
  sale: 'Venta',
  adjustment: 'Ajuste',
  return: 'Devolución',
  reversal: 'Reversión',
}
