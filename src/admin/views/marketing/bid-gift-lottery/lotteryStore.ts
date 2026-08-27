/**
 * 得標禮抽獎「資料層」（原型版）
 *
 * 為什麼要用 localStorage：
 * — 列表頁「開始抽獎」是用 window.open 另開分頁，新分頁是獨立 JS context，
 *   記憶體裡的 mockLotteryList 不共用；改了列表頁的記憶體資料，開獎頁分頁讀不到。
 * — 用 localStorage 當單一資料來源，列表頁（新增/編輯）寫入後，開獎頁分頁即可讀到最新場次設定。
 * — 首次載入（無 localStorage）時 fallback 回 mockLotteryList 當種子資料。
 */
import { mockLotteryList } from './mockData';
import type { BidGiftLotteryRow } from './types';

const STORAGE_KEY = 'prototype.bid_gift_lottery.rows';

/** 讀取全部場次；無儲存值時回種子 mock（深拷貝，避免誤改 mock 常數） */
export function loadLotteryRows(): BidGiftLotteryRow[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as BidGiftLotteryRow[];
  } catch {
    // localStorage 讀取/解析失敗（如隱私模式）→ 退回 mock
  }
  return mockLotteryList.map((row) => ({ ...row }));
}

/** 寫回全部場次 */
export function saveLotteryRows(rows: BidGiftLotteryRow[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
  } catch {
    // 寫入失敗（如容量/隱私模式）→ 原型階段靜默略過
  }
}

/** 依 id 取單一場次（開獎頁用；讀最新 localStorage 值） */
export function findLotteryRow(id: string): BidGiftLotteryRow | undefined {
  return loadLotteryRows().find((row) => row.id === id);
}
