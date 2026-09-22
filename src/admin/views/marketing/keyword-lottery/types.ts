/** 關鍵字抽獎贈品類型 */
export const KeywordPrizeType = {
  Product: 'product',
  Points: 'points',
} as const;

export type KeywordPrizeType = (typeof KeywordPrizeType)[keyof typeof KeywordPrizeType];

/** 關鍵字抽獎狀態（預約中 / 活動中 / 已結束 / 已抽獎） */
export const KeywordLotteryStatus = {
  NotStarted: 'not_started',
  InProgress: 'in_progress',
  Ended: 'ended',
  Drawn: 'drawn',
} as const;

export type KeywordLotteryStatus = (typeof KeywordLotteryStatus)[keyof typeof KeywordLotteryStatus];

/** 抽獎來源：依直播場次 / 依活動區間 */
export const KeywordDrawSource = {
  LiveSession: 'live_session',
  DateRange: 'date_range',
} as const;

export type KeywordDrawSource = (typeof KeywordDrawSource)[keyof typeof KeywordDrawSource];

/** 列表 row 形狀 */
export interface KeywordLotteryRow {
  id: string;
  /** 抽獎來源 */
  drawSource: KeywordDrawSource;
  /** 直播場次名稱（drawSource=live_session 時適用；否則空字串） */
  liveSession: string;
  /** 活動名稱（選填，留空由系統自動命名） */
  sessionName: string;
  keyword: string;
  startAt: string;
  endAt: string;
  /** 星等過濾，null 代表不限 */
  starFilter: number | null;
  prizeType: KeywordPrizeType;
  /** 贈送內容：商品=商品名稱；點數=點數額度字串 */
  prizeContent: string;
  /** 結帳購物車名稱（選擇的多購物車；贈送類型=商品時適用） */
  cart: string;
  /** 自動抽獎（活動結束時自動執行） */
  autoDraw: boolean;
  winnerCount: number;
  /** 是否已抽獎（已抽獎為明確狀態；預約中／活動中／已結束改由活動日期推導） */
  drawn: boolean;
  createdAt: string;
}
