/**
 * 訂單明細相關型別（列表 row、合併紀錄、商品列）。
 * 對齊正式專案 order/order-list/types：型別集中一處供頁面與各卡片元件共用。
 */
import type { OrderSource, PaymentStatus, SocialPlatform, SessionName } from './orderLabels'

/** 合併訂單「原始訂單」一列的精簡快照。 */
export interface MergeSourceLite {
  createdAt: string
  orderNo: string
  buyerName: string
  /** 原始訂單總額（含運費）。 */
  amount: number
  /** 商品淨額（不含運費）。 */
  productAmount: number
  itemCount: number
  shippingMethod: string
  paymentMethodLabel?: string
  paymentStatus: PaymentStatus
  /** 原始訂單來源；合併紀錄面板逐筆顯示 + 推導合併單「多種訂單來源」用。 */
  orderSource: OrderSource
  /** 商品摘要（如「純棉素色短T(黑) × 2」）；合併單商品明細用。 */
  productSummary?: string
}

/** 合併紀錄：有值代表此單是 M 開頭合併訂單。 */
export interface MergeRecord {
  mergedAt: string
  paymentMethodLabel: string
  sources: MergeSourceLite[]
}

/** 發票狀態（六值）。 */
export type InvoiceStatus = 'not_issued' | 'issued' | 'not_required' | 'voided' | 'issue_failed' | 'void_failed'

export interface OrderRow {
  id: string
  createdAt: string
  cartTag: { label: string; bg: string; color: string }
  orderNo: string
  buyerName: string
  buyerPhone: string
  amount: number
  itemCount: number
  shippingMethod: string
  /** 收件地址；超商配送時存「門市名（地址）」，宅配存一般地址；未帶時沿用 prototype 預設。 */
  receiverAddress?: string
  paymentStatus: PaymentStatus
  /** 付款方式標籤（如「貨到付款」「信用卡一次付清」）；決定配送方式可否變更。 */
  paymentMethodLabel?: string
  shippingStatus: 'pending' | 'preparing' | 'shipping' | 'awaiting_receipt' | 'arrived' | 'completed' | 'cancelled' | 'delivery_abnormal'
  /** 配送異常原因（物流商回報）；delivery_abnormal 時以 tooltip 顯示。 */
  abnormalReason?: string
  carrierStatus: 'unconfigured' | 'configured'
  trackingStatus: string | null
  carrierName?: string
  orderSource: OrderSource
  socialPlatform?: SocialPlatform
  multiCart: 'default' | 'main' | 'ice' | 'ice_grocery'
  sessionName?: SessionName
  channel: string
  couponActivity?: string
  couponDiscount?: number
  pointsDiscount?: number
  dispatchBatchCount?: number
  invoiceNumber?: string
  invoiceIssuedAt?: string
  /** 發票狀態（六值）；未設時依 invoiceNumber 推 issued / not_issued。 */
  invoiceStatus?: InvoiceStatus
  /** 合併紀錄；有值代表此單為 M 開頭合併訂單。 */
  mergeRecord?: MergeRecord
  /** 取消處理方式（退回重新結帳 / 取消不退回購物車）；已取消訂單顯示用。 */
  cancelMethod?: 'return' | 'void'
  /** 取消時間；已取消訂單顯示用。 */
  cancelTime?: string
  /** 取消原因；已取消訂單顯示用。 */
  cancelReason?: string
  /** 是否適用「期間首購後免運」活動；true 則商品明細顯示免運折抵。 */
  promoFirstFreeShipping?: boolean
  /** 是否為此活動的「首購」訂單（首購付運費、不享免運折抵）。 */
  promoFirstPurchase?: boolean
}

/** 商品明細一列（扁平商品表）。 */
export interface ProductRow {
  name: string
  spec: string
  source: string
  price: number
  qty: number
  lineTotal: number
}
