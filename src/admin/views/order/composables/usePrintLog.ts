import { reactive } from 'vue'

/**
 * 列印紀錄：以「訂單編號」為 key 的 session 級共享狀態（prototype 用）。
 * 出貨單 / 標籤 / 發票各自累積列印次數與明細（時間、操作者）。
 */
export type PrintKind = 'sheet' | 'label' | 'invoice'
export interface PrintRecord {
  time: string
  operator: string
}
export interface OrderPrintLog {
  sheet: PrintRecord[]
  label: PrintRecord[]
  invoice: PrintRecord[]
}

const store = reactive<Record<string, OrderPrintLog>>({})
const EMPTY: OrderPrintLog = { sheet: [], label: [], invoice: [] }

function ensure(orderNo: string): OrderPrintLog {
  if (!store[orderNo]) store[orderNo] = { sheet: [], label: [], invoice: [] }
  return store[orderNo]
}

export function usePrintLog() {
  return {
    getLog: (orderNo: string): OrderPrintLog => store[orderNo] ?? EMPTY,
    logPrint: (orderNo: string, kind: PrintKind): void => {
      const now = new Date()
      const pad = (n: number) => String(n).padStart(2, '0')
      const time = `${now.getFullYear()}/${pad(now.getMonth() + 1)}/${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`
      ensure(orderNo)[kind].push({ time, operator: 'Test Name' })
    },
  }
}
