/**
 * 會員明細 / 訂單 / 點數 / 訊息彈窗的 mock 衍生資料與格式化 —— 純函式。
 *
 * ⚠️ 服務於 mock 版面預覽（見 `../mock/mockMembers.ts`）；綁定帳號 ID、訂單、點數歷程等皆為
 * deterministic 假算式，非真實資料。待後端補齊對應 API 後應移除。
 */
import type { BindingChannelKey, MockMemberRow } from '../mock/mockMembers';
import type { IconProp } from '@fortawesome/fontawesome-svg-core';

/** 貨到付款資格的最低星等門檻（mock 假設值，非真實商家設定）。 */
export const MOCK_COD_MIN_STAR = 3;

const EMPTY_FIELD = '-';

/** 會員編號的數字部分（供 deterministic 假算式）。 */
function memberSeq(no: string): number {
  return parseInt(no.replace(/\D/g, ''), 10) || 0;
}

/**
 * 綁定帳號 ID（deterministic 假算式，格式比照各平台）。
 *
 * @returns 該管道的綁定帳號字串；未綁定由呼叫端自行判斷不顯示
 */
export function deriveBindingAccountId(member: MockMemberRow, key: BindingChannelKey): string {
  const n = memberSeq(member.no);
  const seq = String(n).padStart(6, '0');
  switch (key) {
    case 'phone':
      return member.mobileMasked || EMPTY_FIELD;
    case 'facebook':
      return `1023040${seq}${String((n * 7) % 1000).padStart(4, '0')}`;
    case 'instagram':
      return `@ig_user_${seq}`;
    case 'line':
      return `U${((n * 2654435761) >>> 0).toString(16).padStart(8, '0')}a2c…`;
    case 'google':
      return member.email || `user${seq}@gmail.com`;
    case 'whatsapp':
      return member.phoneFull || '+886 9••-•••-•••';
    case 'tiktok':
      return `@user_${seq}`;
    default:
      return EMPTY_FIELD;
  }
}

/** 貨到付款資格：以會員星等對 mock 門檻判定。 */
export function getCodEligibility(member: MockMemberRow): {
  eligible: boolean;
  memberStars: number;
  minStar: number;
} {
  return {
    eligible: member.stars >= MOCK_COD_MIN_STAR,
    memberStars: member.stars,
    minStar: MOCK_COD_MIN_STAR,
  };
}

/** 日期時間格式化為 `YYYY/MM/DD HH:mm`；null／無法解析回 `-`。 */
export function formatDateTime(iso: string | null): string {
  if (!iso) return EMPTY_FIELD;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return EMPTY_FIELD;
  const p = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}/${p(date.getMonth() + 1)}/${p(date.getDate())} ${p(date.getHours())}:${p(date.getMinutes())}`;
}

/** 訂單狀態（mock）。 */
export type MockOrderStatus = 'done' | 'processing' | 'cancelled';

export interface MockOrderRecord {
  /** 供 DataTable dataKey 用 */
  id: number;
  /** 訂單編號（A + YYYYMMDD + 3 碼，比照訂單管理） */
  no: string;
  date: string;
  amount: number;
  status: MockOrderStatus;
}

const ORDER_STATUS_CYCLE: MockOrderStatus[] = ['done', 'done', 'done', 'processing', 'cancelled'];

/** 訂單狀態 → `<Tag>` severity。 */
export const ORDER_STATUS_SEVERITY: Record<MockOrderStatus, 'success' | 'warn' | 'secondary'> = {
  done: 'success',
  processing: 'warn',
  cancelled: 'secondary',
};

/** 依會員訂單數 deterministic 產生訂單紀錄。 */
export function genMemberOrders(member: MockMemberRow): MockOrderRecord[] {
  const base = new Date(member.lastOrderAt ?? member.createdAt).getTime();
  const p2 = (n: number) => String(n).padStart(2, '0');
  const list: MockOrderRecord[] = [];
  for (let i = 0; i < member.orders; i += 1) {
    const d = new Date(base - i * 7 * 86400000);
    const ymd = `${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}`;
    list.push({
      id: i + 1,
      no: `A${ymd}${String((i % 9) + 1).padStart(3, '0')}`,
      date: d.toISOString(),
      amount: 800 + ((i * 1234) % 9000),
      status: i < member.completedOrders ? 'done' : ORDER_STATUS_CYCLE[i % ORDER_STATUS_CYCLE.length],
    });
  }
  return list;
}

/** 點數異動歷程（mock）。 */
export interface MockPointHistory {
  id: number;
  date: string;
  /** 類型 i18n key 後綴（member.points.type.*） */
  typeKey: string;
  amount: number;
  balance: number;
  note: string;
}

/** 點數歷程 seed（相對異動；起始餘額由現有點數反推，最新在上）。 */
const POINT_HISTORY_SEED = [
  { typeKey: 'earn', amount: 120, note: '' },
  { typeKey: 'manual_add', amount: 500, note: '出貨延誤補償' },
  { typeKey: 'redeem', amount: -300, note: '' },
  { typeKey: 'earn', amount: 80, note: '' },
];

/** 依會員現有點數 deterministic 產生歷程（點數為 0 者回空陣列）。 */
export function genMemberPointHistory(member: MockMemberRow): MockPointHistory[] {
  if (member.points <= 0) return [];
  const base = new Date(member.lastOrderAt ?? member.createdAt).getTime();
  const sum = POINT_HISTORY_SEED.reduce((total, entry) => total + entry.amount, 0);
  let balance = member.points - sum;
  const chrono = POINT_HISTORY_SEED.map((entry, index) => {
    balance += entry.amount;
    return {
      id: index + 1,
      date: new Date(base - (POINT_HISTORY_SEED.length - 1 - index) * 18 * 86400000).toISOString(),
      typeKey: entry.typeKey,
      amount: entry.amount,
      balance,
      note: entry.note,
    };
  });
  return chrono.reverse();
}

/** 發送訊息管道（mock）。 */
export interface MessageChannel {
  key: string;
  /** 名稱 i18n key 後綴（member.message.channel.*） */
  labelKey: string;
  icon: IconProp;
  /** 圖示色 class */
  colorClass: string;
  /** 該會員是否可用此管道（未綁定 / 無資料者不可選） */
  available: (member: MockMemberRow) => boolean;
}

export const MESSAGE_CHANNELS: MessageChannel[] = [
  { key: 'inapp', labelKey: 'inapp', icon: ['far', 'bell'], colorClass: 'text-primary', available: () => true },
  { key: 'email', labelKey: 'email', icon: ['far', 'envelope'], colorClass: 'text-primary', available: (m) => !!m.email },
  { key: 'sms', labelKey: 'sms', icon: ['far', 'comment'], colorClass: 'text-primary', available: (m) => !!m.phoneFull },
  { key: 'line', labelKey: 'line', icon: ['fab', 'line'], colorClass: 'text-brand-line', available: (m) => m.bindings.line },
  { key: 'messenger', labelKey: 'messenger', icon: ['fab', 'facebook'], colorClass: 'text-brand-facebook', available: (m) => m.bindings.facebook },
  { key: 'whatsapp', labelKey: 'whatsapp', icon: ['fab', 'whatsapp'], colorClass: 'text-brand-whatsapp', available: (m) => m.bindings.whatsapp },
];
