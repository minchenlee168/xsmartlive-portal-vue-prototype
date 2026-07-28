import { reactive } from 'vue'

/**
 * 分批出貨的批次狀態：以「訂單編號」為 key 的 session 級共享狀態（prototype 用）。
 *
 * 由 SplitShippingDialog「儲存並返回」時寫入，OrderRowDetail 讀取後決定
 * 「出貨管理」是否改渲染分批版。module-level reactive，整個 session 期間留存。
 */

export type BatchShippingStatus = 'pending' | 'preparing' | 'shipping' | 'arrived' | 'completed'

export interface BatchItem {
  name: string
  spec?: string
  qty: number
  unitPrice: number
}

export interface BatchCarrier {
  /** 物流商顯示名（如 黑貓宅急便） */
  name: string
  /** 取號（可為 null＝尚未取號） */
  tracking: string | null
  /** 配送方式（如 常溫宅配 / 超商取貨） */
  method: string
}

export interface OrderBatch {
  status: BatchShippingStatus
  note: string
  items: BatchItem[]
  /** 未設定配送時為 undefined */
  carrier?: BatchCarrier
}

const store = reactive<Record<string, OrderBatch[]>>({})

export function useShippingBatches() {
  return {
    /** 讀取某訂單的批次（回傳 reactive array，可直接 mutate 元素即時反映） */
    getBatches: (orderNo: string): OrderBatch[] => store[orderNo] ?? [],
    /** 寫入某訂單的批次（空陣列＝視為未分批） */
    setBatches: (orderNo: string, batches: OrderBatch[]): void => {
      if (batches.length === 0) delete store[orderNo]
      else store[orderNo] = batches
    },
    clearBatches: (orderNo: string): void => { delete store[orderNo] },
  }
}
