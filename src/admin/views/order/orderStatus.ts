/**
 * 訂單狀態(異常處理 / 待處理 / 處理中 / 已完成 / 已取消)推導。
 *
 * 依 UAT「訂單狀態」對照表(https://uat-pm.xsmartlive.com/Testing/)實作:
 * 1. 特定物流貨態 / 旗標「直接判異常處理」(不看付款) —— prototype 以 delivery_abnormal 代表
 *    (對應「備貨中→異常(物流回報配送異常)」;即將逾期 / 轉宅配 / 退門市異常 / 發票開立失敗等旗標未建模)。
 * 2. 其餘依「付款方式(線上 / 貨到)× 貨態 × 付款狀態」兩張主表查表決定。
 *    表格中打叉「不該發生」的組合一律判異常處理。
 *
 * prototype 的付款狀態只有 待付款 / 已付款 / 待退款 / 已退款(無 付款中 / 付款失敗)。
 */

export type OrderStatusKey = 'pending' | 'processing' | 'abnormal' | 'completed' | 'cancelled'

interface OrderLike {
  shippingStatus: string
  paymentStatus: string
  /** 有「貨到付款」字樣走表二,其餘(含未填)走表一線上付款 */
  paymentMethodLabel?: string
  /** 配送異常時物流商回報的原因 */
  abnormalReason?: string
}

/** 出貨狀態 → 對照表左欄「六大貨態」 */
const HUOTAI: Record<string, string> = {
  pending: '待出貨',
  preparing: '備貨中',
  shipping: '已出貨',
  awaiting_receipt: '已送達',
  arrived: '已送達',
  completed: '已完成',
  returning: '退貨中',
  returned: '退貨中',
  return_done: '已退貨',
  exchanged: '已換貨',
  cancelled: '已取消',
}

/** 付款狀態 → 對照表欄位 */
const PAY: Record<string, string> = {
  unpaid: '待付款',
  paying: '付款中',
  paid: '已付款',
  payment_failed: '付款失敗',
  pending_refund: '待退款',
  refunded: '已退款',
}

type Row = Partial<Record<'待付款' | '付款中' | '已付款' | '付款失敗' | '待退款' | '已退款', OrderStatusKey>>

/** 表一 線上付款(信用卡 / LINE Pay / ATM / 超商代碼 / 轉帳匯款);未列出的組合＝不該發生＝異常 */
const ONLINE: Record<string, Row> = {
  待出貨: { 待付款: 'pending', 付款中: 'processing', 已付款: 'pending' },
  備貨中: { 已付款: 'processing' },
  已出貨: { 已付款: 'processing' },
  已送達: { 已付款: 'processing' },
  已完成: { 已付款: 'completed' },
  退貨中: { 待退款: 'pending' },
  已退貨: { 已退款: 'completed' },
  已換貨: { 已付款: 'completed' },
  已取消: { 待付款: 'cancelled', 待退款: 'cancelled', 已退款: 'cancelled' },
}

/** 表二 貨到付款(含自取現場付款);未列出的組合＝不該發生＝異常 */
const COD: Record<string, Row> = {
  待出貨: { 待付款: 'pending' },
  備貨中: { 待付款: 'processing' },
  已出貨: { 待付款: 'processing' },
  已送達: { 待付款: 'processing', 已付款: 'processing' },
  已完成: { 已付款: 'completed' },
  退貨中: { 待付款: 'pending', 待退款: 'pending' },
  已退貨: { 待付款: 'completed', 已退款: 'completed' },
  已換貨: { 已付款: 'completed' },
  已取消: { 待付款: 'cancelled', 待退款: 'cancelled', 已退款: 'cancelled' },
}

/** 依貨態 × 付款狀態 × 付款方式,查出訂單狀態 key。 */
export function orderStatusOf(o: OrderLike): OrderStatusKey {
  // 1. 直接判異常的物流貨態 / 旗標
  if (o.shippingStatus === 'delivery_abnormal') return 'abnormal'
  // 2. 查表
  const huotai = HUOTAI[o.shippingStatus]
  const pay = PAY[o.paymentStatus] as keyof Row | undefined
  if (!huotai || !pay) return 'abnormal'
  const table = o.paymentMethodLabel === '貨到付款' ? COD : ONLINE
  return table[huotai]?.[pay] ?? 'abnormal'
}

/**
 * 若訂單狀態為異常處理,回傳原因說明(供 tooltip);非異常則回傳 null。
 * - 配送異常:物流商回報的原因。
 * - 其餘:貨態 × 付款狀態「不該發生」的組合。
 */
export function orderAbnormalReason(o: OrderLike): string | null {
  if (orderStatusOf(o) !== 'abnormal') return null
  if (o.shippingStatus === 'delivery_abnormal') {
    return o.abnormalReason ?? '物流回報配送異常,直接判為異常處理。'
  }
  const huotai = HUOTAI[o.shippingStatus] ?? o.shippingStatus
  const pay = PAY[o.paymentStatus] ?? o.paymentStatus
  const method = o.paymentMethodLabel === '貨到付款' ? '貨到付款' : '線上付款'
  return `${method}訂單出現「貨態=${huotai}、付款狀態=${pay}」,系統判為異常處理。`
}

/** 訂單狀態 key → tag 文字與 severity */
export function orderStatusMeta(key: OrderStatusKey): { label: string; severity: 'success' | 'info' | 'warn' | 'danger' | 'secondary' } {
  const map: Record<OrderStatusKey, { label: string; severity: 'success' | 'info' | 'warn' | 'danger' | 'secondary' }> = {
    abnormal: { label: '異常處理', severity: 'danger' },
    pending: { label: '待處理', severity: 'warn' },
    processing: { label: '處理中', severity: 'info' },
    completed: { label: '已完成', severity: 'success' },
    cancelled: { label: '已取消', severity: 'secondary' },
  }
  return map[key]
}

/** 進階篩選「訂單狀態」下拉選項 */
export const ORDER_STATUS_OPTIONS: Array<{ label: string; value: OrderStatusKey }> = [
  { label: '異常處理', value: 'abnormal' },
  { label: '待處理', value: 'pending' },
  { label: '處理中', value: 'processing' },
  { label: '已完成', value: 'completed' },
  { label: '已取消', value: 'cancelled' },
]
