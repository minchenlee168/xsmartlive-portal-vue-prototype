/** 得標禮抽獎獎項類型（對應後端契約值） */
export const PrizeType = {
  Product: 'product',
  Points: 'points',
} as const;

export type PrizeType = (typeof PrizeType)[keyof typeof PrizeType];

/** 得標禮抽獎狀態 */
export const LotteryStatus = {
  InProgress: 'in_progress',
  Ended: 'ended',
} as const;

export type LotteryStatus = (typeof LotteryStatus)[keyof typeof LotteryStatus];

/** 列表 row 形狀 */
export interface BidGiftLotteryRow {
  id: string;
  createdAt: string;
  sessionName: string;
  searchStartAt: string;
  searchEndAt: string;
  prizeType: PrizeType;
  prizeContent: string;
  /** 金額須滿足，null 代表不限 */
  requiredAmount: number | null;
  /** 星等過濾，null 代表不限 */
  starFilter: number | null;
  /** 指定中獎人數；開獎頁用來預設「連抽數量」 */
  winnerCount: number;
  status: LotteryStatus;
}
