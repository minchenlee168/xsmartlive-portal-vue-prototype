import type { MemberLevel } from '../types';
import { formatDiscount, type TranslateFn } from './formatDiscount';
import { formatMoney } from './formatMoney';

/** 級距徽章的樣式 key；顯示層據此挑色，配色不在此決定。 */
export type LevelBadgeVariant = 'base' | 'bronze' | 'silver' | 'gold';

/** 權益種類；兩個權益各有獨立開關，種類即該筆權益的身分（供列表 `:key`）。 */
export type LevelBenefitKind = 'birthday_coupon' | 'upgrade_points';

/** 單筆權益文案。 */
export interface LevelBenefit {
  kind: LevelBenefitKind;
  text: string;
}

/** 非基礎級距的徽章樣式；級距固定四層，`sortOrder` 1~3 依序為銅 / 銀 / 金。 */
const BADGE_VARIANT_BY_SORT_ORDER: Record<number, LevelBadgeVariant | undefined> = {
  1: 'bronze',
  2: 'silver',
  3: 'gold',
};

/** 級距表的 UI 投影列。 */
export interface MemberLevelRow {
  /** 級距順序 0~3；級距不可增刪，故它同時是列的識別鍵 */
  sortOrder: number;
  isBase: boolean;
  name: string;
  badgeVariant: LevelBadgeVariant;
  /** 消費門檻顯示值；基礎級距為「未達門檻」文案 */
  thresholdDisplay: string;
  discountDisplay: string;
  /** 啟用中的權益文案；關閉的權益不入列，全關則為空陣列 */
  benefits: LevelBenefit[];
  /** 該級距的會員數；null＝該店還沒算過等級，顯示層不得當 0 呈現 */
  memberCount: number | null;
  isEnabled: boolean;
  /** 門檻原值，供會員名單假資料產生器取用 */
  threshold: number;
}

/**
 * 把單一級距投影成表格列。
 *
 * @param level - 級距資料
 * @param translate - 顯示層的翻譯函式
 */
export function mapLevelToRow(level: MemberLevel, translate: TranslateFn): MemberLevelRow {
  return {
    sortOrder: level.sortOrder,
    isBase: level.isBase,
    name: level.name,
    badgeVariant: level.isBase ? 'base' : BADGE_VARIANT_BY_SORT_ORDER[level.sortOrder] ?? 'base',
    thresholdDisplay: level.isBase
      ? translate('member_level.text.no_threshold')
      : formatMoney(level.threshold),
    discountDisplay: formatDiscount(level.discountPercent, translate),
    benefits: buildBenefits(level, translate),
    memberCount: level.memberCount,
    isEnabled: level.isEnabled,
    threshold: level.threshold,
  };
}

/** 啟用中的權益文案；兩個權益各有獨立開關，關閉者連同其參數一併不顯示。 */
function buildBenefits(level: MemberLevel, translate: TranslateFn): LevelBenefit[] {
  const benefits: LevelBenefit[] = [];

  if (level.birthdayCouponEnabled) {
    benefits.push({
      kind: 'birthday_coupon',
      text: translate('member_level.text.benefit.birthday_coupon', {
        amount: formatMoney(level.birthdayCouponAmount ?? 0),
      }),
    });
  }

  if (level.upgradePointsEnabled) {
    benefits.push({
      kind: 'upgrade_points',
      text: translate('member_level.text.benefit.upgrade_points', {
        points: (level.upgradePoints ?? 0).toLocaleString('en-US'),
      }),
    });
  }

  return benefits;
}
