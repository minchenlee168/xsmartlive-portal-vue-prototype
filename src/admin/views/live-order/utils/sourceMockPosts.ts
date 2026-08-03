/**
 * 「選擇收單來源」彈窗 step 2 顯示的貼文 / 社團 mock 卡。
 *
 * LiveOrderSourceDialog 顯示時用，LiveOrderPage 在「進入收單中的貼文 / 社團」
 * 自動補一筆 source 時也用同一份，確保 source 名稱與彈窗清單一致。
 */
export interface SourceMockPost {
  id: number
  title: string
  date: string
  /** 在直播中的卡片：選擇直播 step 上會顯示紅色 LIVE tag + 脈動點 */
  isLive?: boolean
}

export const sourceMockPosts: SourceMockPost[] = [
  { id: 1, title: '6-22 韓系夏裝補貨團，限時 8 折', date: '2026-06-22', isLive: true },
  { id: 2, title: '【超低價】日本藥妝跨團合購', date: '2026-06-20' },
  { id: 3, title: '夏日防曬大集合，買就送遮陽帽', date: '2026-06-18', isLive: true },
  { id: 4, title: '《團主公告》本週四出貨，請盡速結單', date: '2026-06-17' },
  { id: 5, title: '韓國童裝 6-25 預購開跑！', date: '2026-06-15' },
  { id: 6, title: '【倒數 24H】嬰幼兒副食品禮盒最後機會', date: '2026-06-14' },
  { id: 7, title: '夏天就要喝的氣泡水組合，現貨秒出', date: '2026-06-12', isLive: true },
  { id: 8, title: '日本居家好物清倉，今晚 21:00 結單', date: '2026-06-10' },
  { id: 9, title: '寵物零食 + 玩具特惠組，限量 50 組', date: '2026-06-08' },
  { id: 10, title: '【公告】社團規範更新請看置頂', date: '2026-06-05' },
]

/** 依 collection id 對 mock 取餘，固定回傳同一筆 → 同一個 collection 進入時 label 不會跳。 */
export function pickSourceMockForCollection(collectionId: number): SourceMockPost {
  const idx = Math.abs(collectionId) % sourceMockPosts.length
  return sourceMockPosts[idx]
}
