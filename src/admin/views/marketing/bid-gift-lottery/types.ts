/** 得標禮抽獎獎項類型（對應後端契約值） */
export const PrizeType = {
  Product: 'product',
  Points: 'points',
} as const;

export type PrizeType = (typeof PrizeType)[keyof typeof PrizeType];

/** 抽獎來源：依直播場次 / 依活動區間 */
export const DrawSource = {
  LiveSession: 'live_session',
  DateRange: 'date_range',
} as const;

export type DrawSource = (typeof DrawSource)[keyof typeof DrawSource];

/** 得標禮抽獎狀態（預約中 / 活動中 / 已結束 / 已抽獎） */
export const LotteryStatus = {
  NotStarted: 'not_started',
  InProgress: 'in_progress',
  Ended: 'ended',
  Drawn: 'drawn',
} as const;

export type LotteryStatus = (typeof LotteryStatus)[keyof typeof LotteryStatus];

/** 列表 row 形狀 */
export interface BidGiftLotteryRow {
  id: string;
  createdAt: string;
  /** 抽獎來源 */
  drawSource: DrawSource;
  /** 直播場次名稱（drawSource=live_session 時適用；否則空字串） */
  liveSession: string;
  /** 活動名稱（選填，留空由系統自動命名） */
  sessionName: string;
  searchStartAt: string;
  searchEndAt: string;
  prizeType: PrizeType;
  /** 贈送內容：商品=商品名稱；點數=點數額度字串 */
  prizeContent: string;
  /** 結帳購物車名稱（贈送類型=商品時適用） */
  cart: string;
  /** 得標門檻金額，null 代表不限 */
  requiredAmount: number | null;
  /** 星等過濾，null 代表不限 */
  starFilter: number | null;
  /** 自動抽獎（活動結束時自動執行） */
  autoDraw: boolean;
  /** 指定中獎人數；開獎頁用來預設「連抽數量」 */
  winnerCount: number;
  status: LotteryStatus;
}
