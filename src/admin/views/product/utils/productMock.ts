/**
 * 商品管理 → 商品列表頁的 mock 資料。
 *
 * 跟直播收單那邊的 productCatalog 共用：商品管理 = master，
 * `addManagedProduct` / `updateManagedProduct` / `removeManagedProducts` 都會同步寫進
 * `productCatalog`，這樣在管理頁建立商品後，收單頁的「選擇商品」picker 立刻看得到。
 */
import { reactive } from 'vue'
import {
  productCatalog,
  addToCatalog,
  bundleCatalog,
  addToBundleCatalog,
  type CatalogProduct,
  type CatalogBundle,
} from '@/admin/views/live-order/utils/productCatalog'

export type ProductStatus = 'on_shelf' | 'off_shelf' | 'draft'
export type ProductKind = 'normal' | 'bundle'

export interface ManagedProductSpec {
  id: number
  /** 規格顯示名，例如 「S / 白」 */
  name: string
  /** 規格獨立庫存 */
  stock: number
  /** 規格獨立售價 */
  price: number
}

export interface ProductPromote {
  /** 達到件數 */
  quantity: number
  /** 折扣類型：金額折抵或百分比折扣 */
  discountType: 'amount' | 'percent'
  /** 折扣值 */
  discountValue: number
}

export interface ProductImage {
  id: number | string
  url: string
  filename?: string
  size?: number
}

/** kind='bundle' 時，組合內含的子商品 */
export interface ManagedBundleItem {
  /** 子商品的 catalog id（指 productCatalog） */
  productId: number
  /** 子商品多規格時，指定的規格 id */
  specId?: number
  /** 一組內含幾件 */
  qty: number
  /** 單次購買上限；null = 不限 */
  maxPerPurchase?: number | null
}

export interface ManagedProduct {
  id: number
  name: string
  /** 商品分類（賣場分頁名稱） */
  category: string
  status: ProductStatus
  kind: ProductKind
  /** 規格陣列；單一規格的商品也至少帶一筆「單一規格」便於統一渲染 */
  specs: ManagedProductSpec[]
  /** 總銷量（mock 用，所有規格相加或單純帶大致數字） */
  totalSold: number
  /** 直播 / 貼文留言比對用關鍵字 */
  keyword?: string
  /** 商品標籤（mock：純字串陣列) */
  tags?: string[]
  /** 啟用優惠券折抵 */
  enableCoupon?: boolean
  /** 商品重量（公克） */
  weight?: number
  /** 商品介紹（HTML 或純文字） */
  description?: string
  /** 商品備註（內部用） */
  remark?: string
  /** 多件優惠階梯 */
  promotes?: ProductPromote[]
  /** 商品圖片，依序，首張為主圖 */
  images?: ProductImage[]
  /** 規格群組名稱（依設定順序）；商品列表展開規格表頭 / 編輯頁回填用 */
  specGroupNames?: string[]
  /** kind='bundle' 時的子商品清單 */
  bundleItems?: ManagedBundleItem[]
  /** 組合商品的售價（單一價，不走規格）；給 kind='bundle' 用 */
  bundlePrice?: number
  /** 組合商品的庫存（單一值）；給 kind='bundle' 用 */
  bundleStock?: number
  /** 組合類型：fixed = 固定套組（每項依 quantity 必含），pick = 任選（買家從清單挑） */
  bundleMode?: 'fixed' | 'pick'
  /** 任選模式：買家總共可挑選的件數 */
  bundleTotalPick?: number
}

/** 共用分類選項（賣場分頁 mock） */
export const PRODUCT_CATEGORIES = [
  '健康與美容',
  '居家生活',
  '玩具與遊戲',
  '服飾配件',
  '3C 電子',
  '食品飲料',
]

/** 共用商品標籤 mock（之後可由商品標籤頁產生） */
export const PRODUCT_TAGS = ['熱銷', '新品', '優惠', '限量', '預購', 'VIP 專屬']

export const managedProducts: ManagedProduct[] = reactive([
  {
    id: 1001,
    name: '韓系上衣',
    category: '健康與美容',
    status: 'on_shelf',
    kind: 'normal',
    totalSold: 500,
    keyword: 'TOP',
    tags: ['熱銷', '新品'],
    enableCoupon: true,
    weight: 250,
    description: '輕薄透氣材質，適合日常與直播鏡頭呈現。',
    remark: '6/22 補貨 200 件',
    promotes: [
      { quantity: 2, discountType: 'percent', discountValue: 10 },
      { quantity: 5, discountType: 'amount',  discountValue: 100 },
    ],
    specs: [
      { id: 100101, name: 'S',  stock: 60, price: 30 },
      { id: 100102, name: 'M',  stock: 60, price: 30 },
      { id: 100103, name: 'L',  stock: 60, price: 30 },
      { id: 100104, name: 'XL', stock: 60, price: 60 },
    ],
  },
  {
    id: 1002,
    name: '極簡保溫瓶',
    category: '居家生活',
    status: 'on_shelf',
    kind: 'normal',
    totalSold: 500,
    specs: [
      { id: 100201, name: '單一規格', stock: 60, price: 500 },
    ],
  },
  {
    id: 1003,
    name: '日系木質餐具組',
    category: '居家生活',
    status: 'on_shelf',
    kind: 'bundle',
    totalSold: 220,
    keyword: 'WOOD',
    bundlePrice: 980,
    bundleStock: 30,
    specs: [
      { id: 100301, name: '單一規格', stock: 30, price: 980 },
    ],
    bundleItems: [
      { productId: 1002, qty: 1, maxPerPurchase: null },
      { productId: 1005, qty: 1, maxPerPurchase: 2 },
    ],
  },
  {
    id: 1004,
    name: '手作肥皂禮盒',
    category: '健康與美容',
    status: 'off_shelf',
    kind: 'normal',
    totalSold: 132,
    specs: [
      { id: 100401, name: '薰衣草', stock: 0, price: 280 },
      { id: 100402, name: '茶樹',  stock: 12, price: 280 },
    ],
  },
  {
    id: 1005,
    name: '兒童學習積木',
    category: '玩具與遊戲',
    status: 'on_shelf',
    kind: 'normal',
    totalSold: 45,
    specs: [
      { id: 100501, name: '60 片', stock: 25, price: 590 },
      { id: 100502, name: '120 片', stock: 8, price: 990 },
    ],
  },
])

/** 計算總庫存：規格 stock 加總。 */
export function totalStockOf(p: ManagedProduct): number {
  return p.specs.reduce((sum, s) => sum + (s.stock ?? 0), 0)
}

/** 顯示價格：單一規格 → 「$xxx」；多規格 → 「$min ~ $max」；同值收合成單一。 */
export function priceRangeOf(p: ManagedProduct): string {
  if (p.specs.length === 0) return '—'
  const prices = p.specs.map((s) => s.price)
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  if (min === max) return `$${min.toLocaleString()}`
  return `$${min.toLocaleString()} ~ $${max.toLocaleString()}`
}

// ── 與收單那邊 productCatalog / bundleCatalog 同步 ──────────────────
/** 把一般 ManagedProduct 投影成收單 picker 用的精簡 CatalogProduct */
function toCatalogProduct(p: ManagedProduct): CatalogProduct {
  const prices = p.specs.map((s) => s.price)
  const minPrice = prices.length ? Math.min(...prices) : 0
  return {
    id: p.id,
    name: p.name,
    sku: `MP-${p.id}`,
    category: p.category,
    price: minPrice,
    stock: totalStockOf(p),
    status: p.status === 'on_shelf' ? '上架中' : '已下架',
    keyword: p.keyword ?? '',
  }
}

/** 把組合 ManagedProduct 投影成收單 picker 用的 CatalogBundle */
function toCatalogBundle(p: ManagedProduct): CatalogBundle {
  // 售價/庫存：優先用 bundlePrice/bundleStock；無 → 取規格最小 / 加總
  const prices = p.specs.map((s) => s.price)
  const price = p.bundlePrice ?? (prices.length ? Math.min(...prices) : 0)
  const stock = p.bundleStock ?? totalStockOf(p)
  return {
    id: p.id,
    name: p.name,
    sku: `MP-${p.id}`,
    keyword: p.keyword ?? '',
    price,
    stock,
    status: p.status === 'on_shelf' ? '上架中' : '已下架',
    bundleItems: (p.bundleItems ?? []).map((it) => ({
      catalogProductId: it.productId,
      qty: it.qty,
    })),
  }
}

function findCatalogIndex(id: number): number {
  return productCatalog.findIndex((c) => c.id === id)
}
function findBundleCatalogIndex(id: number): number {
  return bundleCatalog.findIndex((c) => c.id === id)
}

/** 新增 ManagedProduct → 依 kind 同步進 productCatalog 或 bundleCatalog */
export function addManagedProduct(p: ManagedProduct): void {
  managedProducts.unshift(p)
  if (p.kind === 'bundle') {
    if (findBundleCatalogIndex(p.id) === -1) addToBundleCatalog(toCatalogBundle(p))
  } else {
    if (findCatalogIndex(p.id) === -1) addToCatalog(toCatalogProduct(p))
  }
}

/** 更新 ManagedProduct 後重算它在收單 catalog 內的條目 */
export function syncManagedProduct(id: number): void {
  const p = managedProducts.find((x) => x.id === id)
  if (!p) return
  if (p.kind === 'bundle') {
    const idx = findBundleCatalogIndex(id)
    const next = toCatalogBundle(p)
    if (idx === -1) addToBundleCatalog(next)
    else bundleCatalog.splice(idx, 1, next)
  } else {
    const idx = findCatalogIndex(id)
    const next = toCatalogProduct(p)
    if (idx === -1) addToCatalog(next)
    else productCatalog.splice(idx, 1, next)
  }
}

/** 批次刪除 ManagedProduct + 對應的收單 catalog 條目（兩個 catalog 都掃過一次） */
export function removeManagedProducts(ids: Iterable<number>): void {
  const idSet = new Set<number>(Array.from(ids))
  for (let i = managedProducts.length - 1; i >= 0; i--) {
    if (idSet.has(managedProducts[i].id)) managedProducts.splice(i, 1)
  }
  for (let i = productCatalog.length - 1; i >= 0; i--) {
    if (idSet.has(productCatalog[i].id)) productCatalog.splice(i, 1)
  }
  for (let i = bundleCatalog.length - 1; i >= 0; i--) {
    if (idSet.has(bundleCatalog[i].id)) bundleCatalog.splice(i, 1)
  }
}

/** 模組載入時：把現有 managedProducts 一次性 seed 進對應 catalog（id 已存在的略過） */
managedProducts.forEach((p) => {
  if (p.kind === 'bundle') {
    if (findBundleCatalogIndex(p.id) === -1) addToBundleCatalog(toCatalogBundle(p))
  } else {
    if (findCatalogIndex(p.id) === -1) addToCatalog(toCatalogProduct(p))
  }
})

/**
 * 反向 seed：把收單那邊原本就存在於 productCatalog / bundleCatalog 的舊 mock 商品
 * 補進 managedProducts，讓收單 picker 看得到的商品 = 商品列表看得到的商品。
 *
 * 補上的條目用單一規格佔位（stock/price 沿用 catalog 值；多規格保留在 AddProductDialog
 * 的 pickerSpecsMap fallback，picker 內仍能展開）。
 */
productCatalog.forEach((c) => {
  if (managedProducts.some((p) => p.id === c.id)) return
  managedProducts.push({
    id: c.id,
    name: c.name,
    category: c.category,
    status: c.status === '上架中' ? 'on_shelf' : 'off_shelf',
    kind: 'normal',
    totalSold: 0,
    keyword: c.keyword ?? '',
    specs: [{ id: c.id * 100, name: '單一規格', stock: c.stock, price: c.price }],
  })
})

bundleCatalog.forEach((b) => {
  if (managedProducts.some((p) => p.id === b.id)) return
  managedProducts.push({
    id: b.id,
    name: b.name,
    category: '組合商品',
    status: b.status === '上架中' ? 'on_shelf' : 'off_shelf',
    kind: 'bundle',
    totalSold: 0,
    keyword: b.keyword ?? '',
    bundlePrice: b.price,
    bundleStock: b.stock,
    bundleItems: b.bundleItems.map((it) => ({
      productId: it.catalogProductId,
      qty: it.qty,
    })),
    specs: [{ id: b.id * 100, name: '單一規格', stock: b.stock, price: b.price }],
  })
})
