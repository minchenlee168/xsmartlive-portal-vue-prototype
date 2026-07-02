import { ref, computed } from 'vue'

/**
 * 直播留言「得標成功」共享資料：
 * - LiveCommentCard 在留言 hasOrdered 變 true 時 push（自動配對 +N、追加訂單成功）
 * - WinnerListDialog 從此讀取，合併進該商品的得標清單
 * - 留言被解除訂單 / 移除黑名單時對應 winner 也會移除
 *
 * 純 module-level reactive 即可；prototype 階段不上 Pinia store。
 */
export interface LiveWinner {
  /** 來源留言 id；用來在解除訂單時找到對應 winner */
  commentId: number | string
  /** 對應的商品 id（與 LiveProduct.id 對齊） */
  productId: number
  /** 商品名稱（給訂單明細彈窗用） */
  productName?: string
  /** 規格名稱；無規格時 undefined */
  specName?: string
  /** 得標人（直接用留言者 user 名稱） */
  member: string
  /** 來源留言文字內容（給訂單明細彈窗用） */
  commentText: string
  /** 數量 */
  qty: number
  /** 結帳狀態（預設未結帳）— prototype 階段隨機帶值方便看視覺 */
  paid: boolean
  /** 顯示時間（沿用留言 time） */
  createdAt: string
  /** 單價（給訂單明細用） */
  unitPrice: number
  /** 是否為禮物（從留言追加訂單的禮物商品） */
  isGift?: boolean
  /** 訂單編號 — 進 list 時生成 */
  orderNo: string
}

const winners = ref<LiveWinner[]>([])

/** 產生標單編號 — 格式:10 位 unix 秒 + 8 碼隨機 hex(共 18 碼),如 `178271794367cfed4b`。 */
export function genOrderNo(): string {
  const ts = Math.floor(Date.now() / 1000)
  const hex = Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0')
  return `${ts}${hex}`
}

/** 留言內所有 winner 用 commentId 對應；先清掉舊的再寫入，避免重複。 */
export function setWinnersForComment(commentId: number | string, items: Omit<LiveWinner, 'commentId' | 'orderNo'>[]): void {
  // 先移除這則留言之前的紀錄
  winners.value = winners.value.filter(w => w.commentId !== commentId)
  // 重新加入
  const next = items.map((it) => ({
    ...it,
    commentId,
    orderNo: genOrderNo(),
  }))
  winners.value = [...winners.value, ...next]
}

/** 留言被解除訂單 / 列入黑名單時呼叫，把該留言的 winner 全部清掉。 */
export function clearWinnersForComment(commentId: number | string): void {
  winners.value = winners.value.filter(w => w.commentId !== commentId)
}

/** 取得指定商品目前累積的 winner 清單。 */
export function getWinnersByProduct(productId: number) {
  return computed(() => winners.value.filter(w => w.productId === productId))
}

/** 標記某筆 winner 為已移除（從 list 拿掉）。 */
export function removeWinnerByOrderNo(orderNo: string): void {
  winners.value = winners.value.filter(w => w.orderNo !== orderNo)
}

