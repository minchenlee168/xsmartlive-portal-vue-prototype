/** 紅利點數取得來源 */
export const BonusSource = {
  /** 手動新增 */
  Manual: 'manual',
  /** 註冊 */
  Register: 'register',
  /** 消費 */
  Consumption: 'consumption',
} as const;

export type BonusSource = (typeof BonusSource)[keyof typeof BonusSource];

/** 贈送類型 */
export const BonusGiftType = {
  /** 百分比：依消費金額比例贈點，可設單筆贈送上限 */
  Percentage: 'percentage',
  /** 現金：固定贈送指定點數 */
  Cash: 'cash',
} as const;

export type BonusGiftType = (typeof BonusGiftType)[keyof typeof BonusGiftType];

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
  /** 取得來源（手動新增 / 註冊 / 消費） */
  source: BonusSource;
  /** 發送人數限制；null = 無限制 */
  sendLimit: number | null;
  /** 取得門檻（消費滿 NT$）；0 = 無門檻 */
  minSpend: number;
  /** 贈送類型（百分比 / 現金） */
  giftType: BonusGiftType;
  /** 贈送值：百分比為 %，現金為點數 */
  giftValue: number;
  /** 單筆贈送上限（點）；僅百分比制有意義，null = 不設上限 */
  giftCap: number | null;
  /** 已發送人數 */
  sentCount: number;
  /** 描述（富文本 HTML，會員端可見） */
  description: string;
  /** 紅利點數備註（內部備註） */
  note: string;
  /** 活動開始 'YYYY-MM-DD HH:mm:ss' */
  startAt: string;
  /** 活動結束 'YYYY-MM-DD HH:mm:ss' */
  endAt: string;
  /** 啟用 / 停用（手動開關，獨立於生命週期） */
  enabled: boolean;
}

/** 發送明細單筆狀態 */
export const BonusSendStatus = {
  /** 已發送 */
  Sent: 'sent',
  /** 未發送（已發行但尚無人領取） */
  Unsent: 'unsent',
} as const;

export type BonusSendStatus = (typeof BonusSendStatus)[keyof typeof BonusSendStatus];

/** 訂單商品項目（查看商品項目彈窗用） */
export interface BonusOrderItem {
  /** 商品名稱 */
  name: string;
  /** 單價（NTD） */
  unitPrice: number;
  /** 購買數量 */
  quantity: number;
  /** 成本價；null = 不顯示（以「-」呈現） */
  cost: number | null;
  /** 價格（小計＝單價 × 數量） */
  price: number;
}

/** 訂單購物車（一張訂單可能含多個購物車 / 賣場） */
export interface BonusOrderCart {
  /** 購物車 / 賣場名稱 */
  cartName: string;
  /** 商品項目 */
  items: BonusOrderItem[];
  /** 購物車總金額 */
  subtotal: number;
}

/** 訂單金額明細（比照商城前台結帳計算） */
export interface BonusOrderDetail {
  /** 各購物車 */
  carts: BonusOrderCart[];
  /** 商品金額（所有購物車小計加總） */
  productTotal: number;
  /** 運費 */
  shippingFee: number;
  /** 運費折抵 */
  shippingDiscount: number;
  /** 優惠券折抵；null = 未使用（顯示「—」） */
  couponDiscount: number | null;
  /** 紅利點數折抵 */
  pointsDeduction: number;
  /** 訂單金額小計 */
  total: number;
}

/** 發送明細 row（以「使用此活動的訂單」呈現） */
export interface BonusSendRecord {
  /** 會員名稱 */
  memberName: string;
  /** 會員識別（FBID / ID / 會員編號） */
  memberRef: string;
  /** 訂單編號 */
  orderNo: string;
  /** 下單時間 'YYYY-MM-DD HH:mm:ss' */
  orderedAt: string;
  /** 折抵點數 */
  pointsUsed: number;
  /** 消費金額（已抵扣） */
  amountAfterDeduction: number;
  /** 狀態（保留供上方篩選，此列表一律 Sent） */
  status: BonusSendStatus;
}
