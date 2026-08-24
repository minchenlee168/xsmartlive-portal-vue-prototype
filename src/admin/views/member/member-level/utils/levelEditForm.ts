/**
 * 編輯等級表單的值換算與驗證：畫面單位 → 級距內容。
 *
 * 折扣畫面收 0.01～1 的倍率、儲存收 1~100 的整數百分比；金額在 prototype 一律整數。
 * 換算與擋送集中在此，元件只負責收值與顯示。
 */
import type {
  MemberLevel,
  MemberLevelBirthdayCouponTiming,
  MemberLevelUpgradePointsTiming,
} from '../types';
import type { TranslateFn } from './formatDiscount';

/** 折扣倍率輸入下限（＝ 1% 百分比） */
export const DISCOUNT_RATE_MIN = 0.01;
/** 折扣倍率輸入上限（＝ 無折扣） */
export const DISCOUNT_RATE_MAX = 1;

/** 折扣百分比值域 */
export const DISCOUNT_PERCENT_MIN = 1;
export const DISCOUNT_PERCENT_MAX = 100;

/** 升等禮點數值域 */
export const UPGRADE_POINTS_MIN = 1;
export const UPGRADE_POINTS_MAX = 4294967295;

/** 逐欄的值域錯誤內容；`key` 進 i18n、`params` 為插值。 */
export interface FieldError {
  key: string;
  params?: Record<string, unknown>;
}

/** 把欄位錯誤翻成顯示字串；無錯時回空字串（FormField 不顯示 hint）。 */
export function formatFieldError(error: FieldError | undefined, translate: TranslateFn): string {
  return error ? translate(error.key, error.params) : '';
}

/** 編輯等級表單的當下輸入值；金額與點數未填時為 null（InputNumber 清空即 null）。 */
export interface LevelEditFormValues {
  name: string;
  threshold: number | null;
  /** 購物折扣倍率 0.01~1 */
  discountRate: number | null;
  birthdayCouponEnabled: boolean;
  birthdayCouponAmount: number | null;
  birthdayCouponTiming: MemberLevelBirthdayCouponTiming;
  upgradePointsEnabled: boolean;
  upgradePoints: number | null;
  upgradePointsTiming: MemberLevelUpgradePointsTiming;
}

/**
 * 倍率 → 百分比整數。
 *
 * `Math.round` 收掉 `rate * 100` 的浮點尾數（`0.85 * 100` 在 JS 是 85.00000000000001），
 * 再夾回 1~100 保證落在值域內。
 */
export function toDiscountPercent(rate: number): number {
  return Math.min(DISCOUNT_PERCENT_MAX, Math.max(DISCOUNT_PERCENT_MIN, Math.round(rate * 100)));
}

/**
 * 把表單值寫回級距，交回可直接落庫的級距內容。
 *
 * 權益關閉時面額／點數交回 null（對齊欄位語意），但發放時機仍交回目前選取值（timing 欄位不可為
 * null）。
 */
export function buildEditedLevel(source: MemberLevel, values: LevelEditFormValues): MemberLevel {
  return {
    ...source,
    name: values.name.trim(),
    // base 級距門檻固定 0，其餘級距的門檻已由表單擋掉空值
    threshold: source.isBase ? 0 : values.threshold ?? 0,
    discountPercent: toDiscountPercent(values.discountRate ?? DISCOUNT_RATE_MAX),
    birthdayCouponEnabled: values.birthdayCouponEnabled,
    birthdayCouponAmount: values.birthdayCouponEnabled ? values.birthdayCouponAmount ?? 0 : null,
    birthdayCouponTiming: values.birthdayCouponTiming,
    upgradePointsEnabled: values.upgradePointsEnabled,
    upgradePoints: values.upgradePointsEnabled ? values.upgradePoints ?? 0 : null,
    upgradePointsTiming: values.upgradePointsTiming,
  };
}

/** 編輯中級距的門檻可用範圍，兩側皆為**排他**界線；null＝該側沒有相鄰級距。 */
export interface ThresholdBounds {
  lower: number | null;
  upper: number | null;
}

type LevelEditErrorField =
  | 'name'
  | 'threshold'
  | 'discountRate'
  | 'birthdayCouponAmount'
  | 'upgradePoints';

/** 有錯的欄位 → 錯誤內容；空物件代表這一級可以送出。 */
export type LevelEditFormErrors = Partial<Record<LevelEditErrorField, FieldError>>;

/**
 * 取編輯中級距的門檻可用範圍。
 *
 * 四個級距的門檻須嚴格遞增（相等也拒）：界線取相鄰 `sortOrder` 的級距、不跳過停用者。
 */
export function resolveThresholdBounds(levels: MemberLevel[], sortOrder: number): ThresholdBounds {
  const thresholdAt = (target: number): number | null => {
    const neighbor = levels.find((level) => level.sortOrder === target);

    return neighbor ? neighbor.threshold : null;
  };

  return { lower: thresholdAt(sortOrder - 1), upper: thresholdAt(sortOrder + 1) };
}

/**
 * 逐欄指出哪裡不合值域；空物件代表可以送出。
 *
 * @param values - 表單當下的輸入值
 * @param context - 級距身分與門檻界線
 */
export function validateLevelEditForm(
  values: LevelEditFormValues,
  context: { isBase: boolean; thresholdBounds: ThresholdBounds },
): LevelEditFormErrors {
  const errors: LevelEditFormErrors = {};

  if (values.name.trim() === '') {
    errors.name = { key: 'member_level.edit_dialog.validation.name.required' };
  }

  // base 級距門檻固定 0，表單不給改，無需檢查
  if (!context.isBase) {
    const lower = context.thresholdBounds.lower ?? 0;
    const upper = context.thresholdBounds.upper;
    const threshold = values.threshold;

    if (threshold === null || threshold <= lower || (upper !== null && threshold >= upper)) {
      errors.threshold =
        upper === null
          ? { key: 'member_level.edit_dialog.validation.threshold.greater_than', params: { lower } }
          : { key: 'member_level.edit_dialog.validation.threshold.between', params: { lower, upper } };
    }
  }

  const rate = values.discountRate;
  if (rate === null || rate < DISCOUNT_RATE_MIN || rate > DISCOUNT_RATE_MAX) {
    errors.discountRate = {
      key: 'member_level.edit_dialog.validation.discount_rate.range',
      params: { minimum: DISCOUNT_RATE_MIN, maximum: DISCOUNT_RATE_MAX },
    };
  }

  // 0 / 0.00 這類發了等於沒發的面額不是合法面額
  if (
    values.birthdayCouponEnabled &&
    (values.birthdayCouponAmount === null || values.birthdayCouponAmount <= 0)
  ) {
    errors.birthdayCouponAmount = {
      key: 'member_level.edit_dialog.validation.birthday_coupon_amount.positive',
    };
  }

  const points = values.upgradePoints;
  if (
    values.upgradePointsEnabled &&
    (points === null || !Number.isInteger(points) || points < UPGRADE_POINTS_MIN || points > UPGRADE_POINTS_MAX)
  ) {
    errors.upgradePoints = {
      key: 'member_level.edit_dialog.validation.upgrade_points.range',
      params: { minimum: UPGRADE_POINTS_MIN, maximum: UPGRADE_POINTS_MAX },
    };
  }

  return errors;
}
