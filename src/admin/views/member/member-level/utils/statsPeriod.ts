/**
 * 會員等級設定的唯讀文案推導：消費金額計算範圍、統計區間、等級更新週期。
 *
 * 值對不到前端值域時一律退回前端 i18n key（通稱），細節由同一格底下的統計區間補足。
 */
import { MEMBER_LEVEL_RECALCULATE_CYCLE, MEMBER_LEVEL_STATS_PERIOD, type MemberLevelSetting } from '../types';
import type { TranslateFn } from './formatDiscount';

/** 前端認得的計算範圍月數（不含 `UNLIMITED`）。 */
const STATS_PERIOD_MONTHS: readonly number[] = Object.values(MEMBER_LEVEL_STATS_PERIOD).filter(
  (months) => months !== MEMBER_LEVEL_STATS_PERIOD.UNLIMITED,
);

/** 等級更新週期 → 文案 key。 */
const RECALCULATE_CYCLE_KEYS: Record<number, string | undefined> = {
  [MEMBER_LEVEL_RECALCULATE_CYCLE.MONTHLY]: 'member_level.master.option.recalculate_cycle.monthly',
  [MEMBER_LEVEL_RECALCULATE_CYCLE.WEEKLY]: 'member_level.master.option.recalculate_cycle.weekly',
};

/** 消費金額計算範圍的顯示文字；設定尚未載入時為 null。 */
export function formatStatsPeriodLabel(
  setting: MemberLevelSetting | null,
  translate: TranslateFn,
): string | null {
  if (!setting) return null;

  if (setting.statsPeriodMonths === MEMBER_LEVEL_STATS_PERIOD.UNLIMITED) {
    return translate('member_level.master.option.stats_period.unlimited');
  }

  if (!STATS_PERIOD_MONTHS.includes(setting.statsPeriodMonths)) {
    return translate('member_level.master.option.stats_period.custom');
  }

  return translate('member_level.master.option.stats_period.recent_months', {
    months: setting.statsPeriodMonths,
  });
}

/** 等級更新週期的顯示文字；設定尚未載入時為 null。 */
export function formatRecalculateCycleLabel(
  setting: MemberLevelSetting | null,
  translate: TranslateFn,
): string | null {
  if (!setting) return null;

  const key = RECALCULATE_CYCLE_KEYS[setting.recalculateCycle];

  return translate(key ?? 'member_level.master.option.recalculate_cycle.custom');
}

/** 實際納入統計的區間；起日為 null＝不限期間，只講得出統計到哪天。設定尚未載入時為 null。 */
export function formatStatsPeriodRange(
  setting: MemberLevelSetting | null,
  translate: TranslateFn,
): string | null {
  if (!setting) return null;

  if (setting.statsPeriodStart === null) {
    return translate('member_level.master.text.stats_period_until', {
      end: toSlashDate(setting.statsPeriodEnd),
    });
  }

  return translate('member_level.master.text.stats_period_value', {
    start: toSlashDate(setting.statsPeriodStart),
    end: toSlashDate(setting.statsPeriodEnd),
  });
}

/** 等級名單「區間消費」欄的標題；講不出月數時退回不帶範圍的通稱。 */
export function formatWindowSpentHeader(
  setting: MemberLevelSetting | null,
  translate: TranslateFn,
): string {
  if (!setting) return translate('member_level.members.column.window_spent');

  if (setting.statsPeriodMonths === MEMBER_LEVEL_STATS_PERIOD.UNLIMITED) {
    return translate('member_level.members.column.window_spent_unlimited');
  }

  if (!STATS_PERIOD_MONTHS.includes(setting.statsPeriodMonths)) {
    return translate('member_level.members.column.window_spent');
  }

  return translate('member_level.members.column.window_spent_months', {
    months: setting.statsPeriodMonths,
  });
}

/** 等級名單消費欄的區間與快照說明。 */
export function formatSpentNote(setting: MemberLevelSetting | null, translate: TranslateFn): string {
  if (!setting) return translate('member_level.members.text.spent_note_undated');

  const end = toSlashDate(setting.statsPeriodEnd);

  return setting.statsPeriodStart === null
    ? translate('member_level.members.text.spent_note_unlimited', { end })
    : translate('member_level.members.text.spent_note', {
        start: toSlashDate(setting.statsPeriodStart),
        end,
      });
}

/** `YYYY-MM-DD` 換成 `YYYY/MM/DD`。 */
export function toSlashDate(date: string): string {
  return date.replace(/-/g, '/');
}
