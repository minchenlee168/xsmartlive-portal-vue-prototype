/**
 * 訂單顯示用標籤 / badge 對照（訂單明細各卡片共用）。
 * 對齊正式專案 order/shared/statusMeta：把跨元件共用的顯示對照集中一處。
 */

export type OrderSource = 'post' | 'live' | 'group' | 'shop'
export type PaymentStatus = 'paid' | 'unpaid' | 'refunded' | 'pending_refund' | 'paying' | 'payment_failed'
export type SocialPlatform = 'facebook' | 'line' | 'instagram' | 'tiktok' | 'other'
export type SessionName = 'session_0620' | 'session_0622' | 'session_0624' | 'session_0625'
export type TagSeverity = 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast'

/** 訂單來源 → 短 / 完整顯示文字。 */
export const ORDER_SOURCE_LABEL: Record<OrderSource, { short: string; full: string }> = {
  post: { short: '貼文', full: '貼文收單' },
  live: { short: '直播', full: '直播收單' },
  group: { short: '社團', full: '社團收單' },
  shop: { short: '商城', full: '商城訂單' },
}

/** 社群平台 → 顯示文字。 */
export const SOCIAL_LABEL: Record<SocialPlatform, string> = {
  facebook: 'Facebook',
  line: 'LINE',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  other: '其他',
}

/** 場次代碼 → 顯示文字。 */
export const SESSION_LABEL: Record<SessionName, string> = {
  session_0620: '6-20 開箱直播',
  session_0622: '6-22 美妝直播',
  session_0624: '6-24 晚間生鮮直播',
  session_0625: '6-25 服飾團',
}

/** 訂單來源 → 完整文字（查無回「—」）。 */
export function sourceFullLabel(s: OrderSource): string {
  return ORDER_SOURCE_LABEL[s]?.full ?? '—'
}

/** 合併紀錄面板「出貨方式」顯示：常溫宅配 → 宅配（與合併編輯頁一致）。 */
export function shortShipping(method: string): string {
  return method === '常溫宅配' ? '宅配' : method
}

/** 付款狀態 → badge（label + 語意色）。 */
export function paymentBadgeOf(s: PaymentStatus): { label: string; severity: TagSeverity } {
  if (s === 'paid') return { label: '已付款', severity: 'success' }
  if (s === 'paying') return { label: '付款中', severity: 'info' }
  if (s === 'payment_failed') return { label: '付款失敗', severity: 'danger' }
  if (s === 'pending_refund') return { label: '待退款', severity: 'warn' }
  if (s === 'refunded') return { label: '已退款', severity: 'secondary' }
  return { label: '待付款', severity: 'warn' }
}
