/**
 * 免運活動（prototype）型別與枚舉。資料為前端 mock，不對接後端。
 */

/** 免運方式（對應正式站 FreeTypeEnum 1–6）。 */
export const FreeShippingFreeType = {
  FirstPurchase: 1,
  SingleItem: 2,
  MinAmount: 3,
  MinQuantity: 4,
  LimitedTime: 5,
  PromoFirst: 6,
} as const
export type FreeShippingFreeTypeValue = (typeof FreeShippingFreeType)[keyof typeof FreeShippingFreeType]

/** 免運來源。 */
export const FreeShippingTargetType = {
  All: 1,
  CheckoutSetting: 2,
} as const
export type FreeShippingTargetTypeValue = (typeof FreeShippingTargetType)[keyof typeof FreeShippingTargetType]

/** 免運金額計算方式。 */
export const FreeShippingIncludeCoupon = {
  Included: 1,
  Excluded: 2,
} as const
export type FreeShippingIncludeCouponValue = (typeof FreeShippingIncludeCoupon)[keyof typeof FreeShippingIncludeCoupon]

/** 活動期間狀態（篩選 Tab 用；由起訖時間與現在比對推導）。 */
export const FreeShippingLifecycle = {
  Upcoming: 'upcoming',
  Ongoing: 'ongoing',
  Ended: 'ended',
} as const
export type FreeShippingLifecycleValue = (typeof FreeShippingLifecycle)[keyof typeof FreeShippingLifecycle]

/** 免運活動列。`id`、`enabled`、`startAt`/`endAt` 字串為 PaginationTable／顯示所需。 */
export interface FreeShippingRow {
  id: string
  name: string
  freeType: FreeShippingFreeTypeValue
  targetType: FreeShippingTargetTypeValue
  /** CheckoutSetting 時的多購物車名稱；其餘為空字串。 */
  targetName: string
  /** 滿額免運門檻金額；其餘為 null。 */
  minAmount: number | null
  /** 滿件免運門檻件數；其餘為 null。 */
  minQuantity: number | null
  /** 免運上限金額；null＝不設上限。 */
  maxEligibleAmount: number | null
  includeCouponAmount: FreeShippingIncludeCouponValue
  /** 免運次數上限；null＝不限次數。 */
  usageLimit: number | null
  /** 單品免運的指定商品名稱；其餘為空字串。 */
  productName: string
  /** 不可免運地區。 */
  excludedRegions: string[]
  description: string
  remark: string
  /** 'YYYY-MM-DD HH:mm:ss'。 */
  startAt: string
  endAt: string
  purchaseCount: number
  enabled: boolean
}

/** 免運方式 → 名稱 i18n key。 */
export const FREE_TYPE_LABEL_KEY: Record<FreeShippingFreeTypeValue, string> = {
  [FreeShippingFreeType.FirstPurchase]: 'free_shipping.option.free_type.first_purchase',
  [FreeShippingFreeType.SingleItem]: 'free_shipping.option.free_type.single_item',
  [FreeShippingFreeType.MinAmount]: 'free_shipping.option.free_type.min_amount',
  [FreeShippingFreeType.MinQuantity]: 'free_shipping.option.free_type.min_quantity',
  [FreeShippingFreeType.LimitedTime]: 'free_shipping.option.free_type.limited_time',
  [FreeShippingFreeType.PromoFirst]: 'free_shipping.option.free_type.promo_first',
}

/** 免運來源 → 名稱 i18n key。 */
export const TARGET_TYPE_LABEL_KEY: Record<FreeShippingTargetTypeValue, string> = {
  [FreeShippingTargetType.All]: 'free_shipping.option.target_type.all',
  [FreeShippingTargetType.CheckoutSetting]: 'free_shipping.option.target_type.checkout_setting',
}

/** 免運金額計算方式 → 名稱 i18n key。 */
export const INCLUDE_COUPON_LABEL_KEY: Record<FreeShippingIncludeCouponValue, string> = {
  [FreeShippingIncludeCoupon.Included]: 'free_shipping.option.include_coupon_amount.included',
  [FreeShippingIncludeCoupon.Excluded]: 'free_shipping.option.include_coupon_amount.excluded',
}
