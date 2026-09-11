/** 紅利點數活動：回饋方式（取得來源） */
export const BonusRewardType = {
  /** 比例回饋：依消費金額百分比贈點（可設單筆上限點數） */
  Percentage: 'percentage',
  /** 固定回饋：固定贈送指定點數 */
  Fixed: 'fixed',
} as const;

export type BonusRewardType = (typeof BonusRewardType)[keyof typeof BonusRewardType];

/**
 * 活動生命週期狀態（供 Tabs 篩選）。
 *
 * 由活動期間（startAt / endAt）與「今天」比對推導，不落庫；與「啟用 / 停用」（enabled）
 * 為兩個獨立維度：停用中的活動仍可能落在進行中的日期區間。
 */
export const BonusLifecycle = {
  /** 接下來的活動：今天 < 開始 */
  Upcoming: 'upcoming',
  /** 進行中：開始 ≤ 今天 ≤ 結束 */
  InProgress: 'in_progress',
  /** 已結束：今天 > 結束 */
  Ended: 'ended',
} as const;

export type BonusLifecycle = (typeof BonusLifecycle)[keyof typeof BonusLifecycle];

/** 紅利點數活動列表 row 形狀 */
export interface BonusPointsRow {
  id: string;
  /** 紅利點數名稱 */
  name: string;
  /** 取得來源 / 回饋方式 */
  rewardType: BonusRewardType;
  /** 回饋值：比例制為百分比（%），固定制為點數 */
  rewardValue: number;
  /** 單筆上限點數；僅比例制有意義，null = 不設上限 */
  pointsCap: number | null;
  /** 消費門檻（NT$）；0 = 無門檻 */
  minSpend: number;
  /** 領取人數上限；null = 無限制 */
  claimLimit: number | null;
  /** 已領取人數 */
  claimedCount: number;
  /** 活動開始 'YYYY-MM-DD HH:mm:ss' */
  startAt: string;
  /** 活動結束 'YYYY-MM-DD HH:mm:ss' */
  endAt: string;
  /** 啟用 / 停用（手動開關，獨立於生命週期） */
  enabled: boolean;
  /** 活動說明（會員端可見） */
  description: string;
}

/** 領取明細單筆狀態 */
export const BonusClaimStatus = {
  /** 已領取 */
  Claimed: 'claimed',
  /** 未領取（已發行但尚無人領） */
  Unclaimed: 'unclaimed',
} as const;

export type BonusClaimStatus = (typeof BonusClaimStatus)[keyof typeof BonusClaimStatus];

/** 領取明細 row：對應某活動已發行的一組領取碼，可能已領或未領 */
export interface BonusClaimRecord {
  /** 領取代碼 */
  claimCode: string;
  /** 會員名稱；未領取為 null */
  memberName: string | null;
  /** 領取時間 'YYYY-MM-DD HH:mm:ss'；未領取為 null */
  claimedAt: string | null;
  /** 實際贈點；未領取為 null */
  points: number | null;
  /** 歸戶會員 ID；未領取為 null */
  memberId: string | null;
  /** 使用人 ID（代領 / 轉贈時可能不同於歸戶會員）；未領取為 null */
  usedById: string | null;
  /** 訂單編號；未觸發消費贈點為 null */
  orderNo: string | null;
  /** 狀態 */
  status: BonusClaimStatus;
}
