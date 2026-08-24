/**
 * 會員等級設定（mock 版面預覽）的型別與契約值常數。
 *
 * ⚠️ 本模組為對齊 portal-vue（uat8）「會員等級設定」畫面的版面預覽，資料來自前端假資料
 * （`./mock/mockMemberLevel.ts`），非後端 API：切總開關、停用級距、編輯級距皆只改本地狀態並出
 * toast。金額在 prototype 一律以整數（TWD，minorUnit 0）處理，不做面值字串換算。
 */

/** 生日禮券發放時機。 */
export const MEMBER_LEVEL_BIRTHDAY_COUPON_TIMING = {
  /** 生日當月 1 日 */
  BIRTH_MONTH: 1,
  /** 生日當天 */
  BIRTH_DAY: 2,
} as const;

export type MemberLevelBirthdayCouponTiming =
  (typeof MEMBER_LEVEL_BIRTHDAY_COUPON_TIMING)[keyof typeof MEMBER_LEVEL_BIRTHDAY_COUPON_TIMING];

/** 升等禮點數發放時機。 */
export const MEMBER_LEVEL_UPGRADE_POINTS_TIMING = {
  /** 升等當下 */
  ON_UPGRADE: 1,
  /** 升等次月 */
  NEXT_MONTH: 2,
} as const;

export type MemberLevelUpgradePointsTiming =
  (typeof MEMBER_LEVEL_UPGRADE_POINTS_TIMING)[keyof typeof MEMBER_LEVEL_UPGRADE_POINTS_TIMING];

/** 等級重算週期；執行時刻固定商店時區 04:00，不由本值決定。 */
export const MEMBER_LEVEL_RECALCULATE_CYCLE = {
  /** 每月 1 日 */
  MONTHLY: 1,
  /** 每週一 */
  WEEKLY: 2,
} as const;

/** 會員等級的消費金額計算範圍（月數）；`UNLIMITED`（0）例外，代表不限期間。 */
export const MEMBER_LEVEL_STATS_PERIOD = {
  UNLIMITED: 0,
  THREE_MONTHS: 3,
  SIX_MONTHS: 6,
  TWELVE_MONTHS: 12,
  TWENTY_FOUR_MONTHS: 24,
} as const;

/**
 * 會員等級的單一級距。
 *
 * 會員等級依統計區間內的消費自動分級，與星等（後台手動指派）是兩個獨立概念。
 * 生日禮／升等禮兩組欄位各自由 `birthdayCouponEnabled` / `upgradePointsEnabled` 控制。
 */
export interface MemberLevel {
  /** 級距順序 0~3，0 為基礎級距（與 `isBase` 同義），同時是列的識別鍵 */
  sortOrder: number;
  /** 是否為基礎級距（所有會員的起始級距） */
  isBase: boolean;
  name: string;
  /** 升等門檻的累積消費金額；base 級距固定 0 */
  threshold: number;
  /** 折扣百分比，值域 1~100 整數（100＝原價、90＝付九成） */
  discountPercent: number;
  isEnabled: boolean;
  /** 該級距的會員數；該店還沒算過等級時為 null（不可當 0 顯示） */
  memberCount: number | null;
  birthdayCouponEnabled: boolean;
  /** 生日禮券面額；從未設定過該權益時為 null */
  birthdayCouponAmount: number | null;
  birthdayCouponTiming: MemberLevelBirthdayCouponTiming;
  upgradePointsEnabled: boolean;
  /** 升等禮點數；從未設定過該權益時為 null */
  upgradePoints: number | null;
  upgradePointsTiming: MemberLevelUpgradePointsTiming;
}

/**
 * 商店會員等級設定。店層級設定，`levels` 固定 4 個級距，依 `sortOrder` 0~3 排列。
 */
export interface MemberLevelSetting {
  /** 會員等級功能總開關 */
  isEnabled: boolean;
  /** 消費金額計算範圍的月數（見 `MEMBER_LEVEL_STATS_PERIOD`） */
  statsPeriodMonths: number;
  /** 消費統計區間起日（`YYYY-MM-DD`）；不限期間為 null */
  statsPeriodStart: string | null;
  /** 消費統計區間迄日（`YYYY-MM-DD`） */
  statsPeriodEnd: string;
  /** 等級更新週期（見 `MEMBER_LEVEL_RECALCULATE_CYCLE`） */
  recalculateCycle: number;
  /** 固定 4 個級距，依 `sortOrder` 0~3 排列 */
  levels: MemberLevel[];
}

/**
 * 某一等級的會員名單列。
 *
 * `windowSpent` 是判定等級當下的區間消費（回答「憑什麼是這一級」），非會員列表的全期累積消費。
 */
export interface MemberLevelMember {
  id: number;
  memberCode: string;
  name: string;
  /** 判定等級當下的區間消費金額，可為負（退款會讓加總變負） */
  windowSpent: number;
  /** 全期已付款訂單數；與 `windowSpent` 不同源，範圍不同不可相除 */
  paidOrderCount: number;
}
