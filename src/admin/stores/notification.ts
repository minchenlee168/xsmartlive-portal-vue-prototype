import { defineStore } from 'pinia'

/** 通知類別的視覺語意（對應 PrimeVue Tag 的 severity）。 */
export type NotificationSeverity = 'info' | 'success' | 'warn' | 'danger' | 'secondary'

/** 通知類別（與 tab 分類、Tag 顏色共用同一份來源）。 */
export interface NotificationCategory {
  id: string
  /** 顯示名稱（mock 資料，等同商店名稱這類「資料」而非 UI 文案）。 */
  name: string
  severity: NotificationSeverity
}

/** 單筆通知。 */
export interface AppNotification {
  id: number
  categoryId: string
  title: string
  body: string
  /** 顯示時間，格式 `YYYY/MM/DD HH:mm`。 */
  time: string
  read: boolean
  /** 置頂（由平台端發送時決定），固定排在最前。 */
  pinned?: boolean
  /** 導引動作（純展示，點擊只跳 toast）。 */
  action?: { label: string } | null
}

/**
 * 通知類別清單。與公司後台共用同一份分類概念；prototype 版採靜態 mock。
 */
const CATEGORIES: NotificationCategory[] = [
  { id: 'system', name: '系統公告', severity: 'info' },
  { id: 'maintenance', name: '維護通知', severity: 'info' },
  { id: 'notice', name: '系統通知', severity: 'success' },
  { id: 'order', name: '訂單營運異常', severity: 'danger' },
  { id: 'customer', name: '客戶動態', severity: 'secondary' },
]

/**
 * 通知種子資料（mock-only）。
 *
 * portal-vue 正式版會由 API / 公司後台推播；prototype 版改為靜態假資料，
 * 內容沿用 `document/通知中心.html` 的規劃文案，供畫面演示用。
 */
const SEED: AppNotification[] = [
  { id: 1, categoryId: 'notice', title: '物流商「黑貓宅急便」開通成功', read: false, time: '2026/07/16 09:12',
    body: '您申請的物流商「黑貓宅急便」已審核通過並完成開通，即日起可於「物流管理」建立出貨單並使用該物流商寄件服務。',
    action: { label: '前往物流管理' } },
  { id: 2, categoryId: 'notice', title: '金流「綠界科技」開通審核未通過', read: false, time: '2026/07/15 17:40',
    body: '您申請的金流「綠界科技」因「營業登記文件不清晰」審核未通過。請重新上傳清晰的證明文件後再次送審。',
    action: { label: '重新送審' } },
  { id: 3, categoryId: 'maintenance', title: '系統維護公告：7/20 02:00–04:00', read: true, time: '2026/07/14 10:00', pinned: true,
    body: '為提供更穩定的服務，系統將於 2026/07/20 02:00–04:00 進行例行維護，期間後台將暫停服務，造成不便敬請見諒。',
    action: null },
  { id: 4, categoryId: 'notice', title: '商家資格審核通過', read: true, time: '2026/07/12 14:26',
    body: '恭喜！您的商家資格審核已通過，帳號功能已全數開通，歡迎開始使用直播管家的完整功能。',
    action: null },
  { id: 5, categoryId: 'notice', title: '合約將於 2026/08/31 到期', read: false, time: '2026/07/11 08:00',
    body: '您的服務合約將於 2026/08/31 到期。為避免服務中斷，請於到期前完成續約手續。',
    action: { label: '前往續約' } },
  { id: 6, categoryId: 'order', title: '訂單 #20260715-008 付款異常', read: false, time: '2026/07/15 21:03',
    body: '訂單 #20260715-008 的付款發生異常（授權失敗），目前訂單狀態為「待處理」，請確認後聯繫買家或取消訂單。',
    action: { label: '查看訂單' } },
  { id: 7, categoryId: 'system', title: '新功能上線：AI 商品文案建議', read: true, time: '2026/07/09 11:20',
    body: '「AI 商品文案建議」功能正式上線，於商品編輯頁點擊「AI 建議」即可自動產生商品標題與賣點文案。',
    action: null },
  { id: 8, categoryId: 'system', title: '付款服務條款更新公告', read: true, time: '2026/07/06 09:00',
    body: '金流服務條款將於 2026/08/01 起更新，主要調整撥款週期與手續費計算方式，詳情請參閱條款全文。',
    action: { label: '查看條款全文' } },
  { id: 9, categoryId: 'customer', title: '新訂單 #20260716-014 已成立', read: false, time: '2026/07/16 10:05',
    body: '客戶「陳美如」剛完成一筆訂單 #20260716-014，金額 NT$ 2,480。此為單向提醒，如需回覆客戶請至既有的「客服中心」。',
    action: { label: '查看訂單' } },
  { id: 10, categoryId: 'customer', title: '商品收到新評價（4 星）', read: true, time: '2026/07/15 19:30',
    body: '商品「無線藍牙耳機」收到一則新評價（4 星）：「音質不錯，出貨也快。」',
    action: { label: '查看評價' } },
]

/**
 * 通知 store（mock-only）。
 *
 * 作為 TopBar 鈴鐺與「通知中心」收件匣頁的單一資料源：兩者共用同一份 items 與已讀狀態，
 * 任一處標示已讀，紅點數與列表即時同步。
 */
export const useNotificationStore = defineStore('admin-notification', {
  state: () => ({
    categories: CATEGORIES,
    items: SEED.map((n) => ({ ...n })) as AppNotification[],
  }),
  getters: {
    /** 未讀筆數（鈴鐺紅點用）。 */
    unreadCount(state): number {
      return state.items.filter((n) => !n.read).length
    },
    /** categoryId → 類別物件，方便查名稱與 severity。 */
    categoryMap(state): Record<string, NotificationCategory> {
      return Object.fromEntries(state.categories.map((c) => [c.id, c]))
    },
    /** 置頂優先、其餘時間新到舊。 */
    sortedItems(state): AppNotification[] {
      return [...state.items].sort((a, b) => {
        if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1
        return b.time.localeCompare(a.time)
      })
    },
  },
  actions: {
    /** 取得某類別（找不到回傳一個灰底 fallback）。 */
    categoryById(id: string): NotificationCategory {
      return this.categoryMap[id] ?? { id, name: '—', severity: 'secondary' }
    },
    /** 某類別的通知筆數（tab 徽章用）。 */
    countByCategory(id: string): number {
      return this.items.filter((n) => n.categoryId === id).length
    },
    markRead(id: number) {
      const target = this.items.find((n) => n.id === id)
      if (target) target.read = true
    },
    toggleRead(id: number) {
      const target = this.items.find((n) => n.id === id)
      if (target) target.read = !target.read
    },
    markAllRead() {
      this.items.forEach((n) => { n.read = true })
    },
  },
})
