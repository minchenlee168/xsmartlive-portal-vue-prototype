/**
 * 多購物車設定相關型別。
 * 對齊正式專案 checkout-setting/types：型別集中一處供彈窗、設定頁與運費矩陣模組共用。
 */

/** 結帳模式（4 種直播模式 + 商城結帳）。 */
export type CheckoutMode = '標單必結' | '自選結帳' | '棄標結帳' | '暫停結帳' | '商城結帳'

/** 配送溫層。 */
export type TempLayer = '常溫' | '冷藏' | '冷凍'

/** 一台多購物車的完整設定。 */
export interface MultiCartRecord {
  date: string
  name: string
  id: string
  desc: string
  locked?: boolean
  /** 釘選置頂（資料排序用，與 locked／預設購物車無關） */
  pinned?: boolean
  /** 轉帳匯款金流備註（HTML） */
  note?: string
  mode: CheckoutMode
  temp: TempLayer
  coupon: boolean
  reward: boolean
  on: boolean
  payList: string[]
  logiList: string[]
  /** 運費矩陣：使用者調整過的格子（key = scope|物流|sub|付款|格index） */
  feeVals?: Record<string, number>
  /** 運費矩陣：關閉的「物流 × 付款」組合（key = scope|物流|sub|付款） */
  feeOff?: Record<string, boolean>
  deleted?: boolean
}

/** 彈窗送出的 payload（編輯帶原 ID；新增為 undefined）。 */
export interface MultiCartFormPayload {
  /** 編輯模式帶原 ID；新增模式 undefined */
  editingId?: string
  record: MultiCartRecord
}
