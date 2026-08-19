/**
 * 會員列表（mock 版面預覽）的顯示格式化與樣式對照 —— 純函式，無 i18n / 無 store 依賴。
 *
 * ⚠️ 服務於 mock 版面預覽（見 `../mock/mockMembers.ts`）；欄位由後端補齊、改接 API 後應一併檢視去留。
 */
import type { BindingChannelKey, MockMemberLevel, MockMemberStatus } from '../mock/mockMembers';
import type { IconProp } from '@fortawesome/fontawesome-svg-core';

/** 空值佔位符（對齊專案慣例的 `-`）。 */
const EMPTY_FIELD = '-';

/** PrimeVue `<Tag>` 的 severity 取值。 */
type TagSeverity = 'secondary' | 'info' | 'success' | 'warn' | 'danger' | 'contrast';

/** 累積消費金額千分位格式化（純數字，不帶貨幣符號）。 */
export function formatSpend(spend: number): string {
  return spend.toLocaleString('en-US');
}

/**
 * 最後購買日格式化為 `YYYY/MM/DD`（design.md 7.9）。
 *
 * @param iso - ISO 時間字串；`null` 或無法解析回 `EMPTY_FIELD`（`—`）
 */
export function formatLastOrderDate(iso: string | null): string {
  if (!iso) return EMPTY_FIELD;

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return EMPTY_FIELD;

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}/${month}/${day}`;
}

/** 棄標率顯示（百分比字串）＋依高低變色的文字 class。棄標率越低越好。 */
export function getAbandonRate(
  bids: number,
  abandonedBids: number,
): { label: string; toneClass: string } {
  const rate = bids > 0 ? abandonedBids / bids : 0;
  const percent = Math.round(rate * 100);

  let toneClass = '';
  if (rate < 0.1) toneClass = 'text-green-600 dark:text-green-400';
  else if (rate > 0.25) toneClass = 'text-red-600 dark:text-red-400';

  return { label: `${percent}%`, toneClass };
}

/** 會員等級 → `<Tag>` severity（金屬色 Tag 無對應 severity，取語意上可區分的近色）。 */
export const MEMBER_LEVEL_SEVERITY: Record<MockMemberLevel, TagSeverity> = {
  normal: 'secondary',
  bronze: 'contrast',
  silver: 'info',
  gold: 'warn',
};

/** 會員狀態 → `<Tag>` severity。 */
export const MEMBER_STATUS_SEVERITY: Record<MockMemberStatus, TagSeverity> = {
  normal: 'success',
  suspended: 'warn',
  blacklisted: 'danger',
};

/** 第三方綁定管道呈現設定（顯示順序、圖示、品牌色 class）。 */
export interface BindingChannel {
  /** 對應 `MockMemberBindings` 的欄位鍵 */
  key: BindingChannelKey;
  /** 品牌顯示名（專有名詞，不進 i18n） */
  name: string;
  icon: IconProp;
  /** 已綁定時的品牌色 class；TikTok 隨主題翻轉不用固定黑 */
  boundClass: string;
}

export const BINDING_CHANNELS: BindingChannel[] = [
  { key: 'facebook', name: 'Facebook', icon: ['fab', 'facebook'], boundClass: 'text-brand-facebook' },
  { key: 'line', name: 'LINE', icon: ['fab', 'line'], boundClass: 'text-brand-line' },
  { key: 'google', name: 'Google', icon: ['fab', 'google'], boundClass: 'text-brand-google' },
  { key: 'whatsapp', name: 'WhatsApp', icon: ['fab', 'whatsapp'], boundClass: 'text-brand-whatsapp' },
  { key: 'tiktok', name: 'TikTok', icon: ['fab', 'tiktok'], boundClass: 'text-surface-900 dark:text-surface-100' },
];

/** 未綁定管道的淡色 class。 */
export const BINDING_UNBOUND_CLASS = 'text-surface-300 dark:text-surface-600';
