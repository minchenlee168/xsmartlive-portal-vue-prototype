/**
 * 會員等級設定的假資料（版面預覽用）。
 *
 * ⚠️ 服務於 mock 版面預覽；欄位由後端補齊、改接 API 後應一併檢視去留。
 * 初值提供「已開啟＋四個級距」的常見情境，讓畫面一進來就看得到完整版型。
 */
import {
  MEMBER_LEVEL_BIRTHDAY_GIFT_TIMING,
  MEMBER_LEVEL_RECALCULATE_CYCLE,
  MEMBER_LEVEL_STATS_PERIOD,
  MEMBER_LEVEL_UPGRADE_POINTS_TIMING,
  type MemberLevel,
  type MemberLevelMember,
  type MemberLevelSetting,
} from '../types';

/** 四個級距的初值（sortOrder 0~3：一般會員 / 銅卡 / 銀卡 / 金卡）。 */
const MOCK_LEVELS: MemberLevel[] = [
  {
    sortOrder: 0,
    isBase: true,
    name: '一般會員',
    threshold: 0,
    discountPercent: 100,
    isEnabled: true,
    memberCount: 3182,
    birthdayGiftEnabled: false,
    birthdayGiftPoints: null,
    birthdayGiftExpireDays: null,
    birthdayGiftTiming: MEMBER_LEVEL_BIRTHDAY_GIFT_TIMING.BIRTH_MONTH,
    upgradePointsEnabled: false,
    upgradePoints: null,
    upgradePointsExpireDays: null,
    upgradePointsTiming: MEMBER_LEVEL_UPGRADE_POINTS_TIMING.ON_UPGRADE,
  },
  {
    sortOrder: 1,
    isBase: false,
    name: '銅卡',
    threshold: 3000,
    discountPercent: 98,
    isEnabled: true,
    memberCount: 642,
    birthdayGiftEnabled: true,
    birthdayGiftPoints: 100,
    birthdayGiftExpireDays: 90,
    birthdayGiftTiming: MEMBER_LEVEL_BIRTHDAY_GIFT_TIMING.BIRTH_MONTH,
    upgradePointsEnabled: true,
    upgradePoints: 100,
    upgradePointsExpireDays: 180,
    upgradePointsTiming: MEMBER_LEVEL_UPGRADE_POINTS_TIMING.ON_UPGRADE,
  },
  {
    sortOrder: 2,
    isBase: false,
    name: '銀卡',
    threshold: 10000,
    discountPercent: 95,
    isEnabled: true,
    memberCount: 218,
    birthdayGiftEnabled: true,
    birthdayGiftPoints: 300,
    birthdayGiftExpireDays: 90,
    birthdayGiftTiming: MEMBER_LEVEL_BIRTHDAY_GIFT_TIMING.BIRTH_MONTH,
    upgradePointsEnabled: true,
    upgradePoints: 300,
    upgradePointsExpireDays: 180,
    upgradePointsTiming: MEMBER_LEVEL_UPGRADE_POINTS_TIMING.ON_UPGRADE,
  },
  {
    sortOrder: 3,
    isBase: false,
    name: '金卡',
    threshold: 30000,
    discountPercent: 90,
    isEnabled: true,
    memberCount: 47,
    birthdayGiftEnabled: true,
    birthdayGiftPoints: 500,
    birthdayGiftExpireDays: 90,
    birthdayGiftTiming: MEMBER_LEVEL_BIRTHDAY_GIFT_TIMING.BIRTH_DAY,
    upgradePointsEnabled: true,
    upgradePoints: 500,
    upgradePointsExpireDays: 180,
    upgradePointsTiming: MEMBER_LEVEL_UPGRADE_POINTS_TIMING.NEXT_MONTH,
  },
];

/** 會員等級設定初值；深拷貝一份給 composable 當可變狀態，別讓 UI 動到這份常數。 */
export function createMockMemberLevelSetting(): MemberLevelSetting {
  return {
    isEnabled: true,
    statsPeriodMonths: MEMBER_LEVEL_STATS_PERIOD.TWELVE_MONTHS,
    statsPeriodStart: '2024-09-01',
    statsPeriodEnd: '2025-08-31',
    recalculateCycle: MEMBER_LEVEL_RECALCULATE_CYCLE.MONTHLY,
    levels: MOCK_LEVELS.map((level) => ({ ...level })),
  };
}

const MEMBER_NAMES = [
  '王小明', '陳美玲', '林志豪', '張雅婷', '李承翰', '黃淑芬', '吳建宏', '劉思妤',
  '蔡宗翰', '鄭婉如', '許家豪', '謝佩珊', '洪偉誠', '曾雅琪', '呂俊傑', '賴怡君',
];

/**
 * 產出某一級距的假會員名單（依 `sortOrder` 決定筆數與消費區間，讓不同級距看起來不同）。
 *
 * @param sortOrder - 級距順序 0~3
 * @param threshold - 該級距門檻，用來讓區間消費落在合理範圍
 * @param count - 要產出的筆數（對齊該級距的 memberCount，過多則截斷示意）
 */
export function createMockLevelMembers(
  sortOrder: number,
  threshold: number,
  count: number,
): MemberLevelMember[] {
  const size = Math.min(count, 12);
  const base = Math.max(threshold, 500);

  return Array.from({ length: size }, (_, index) => {
    // 依序號製造遞減但仍高於門檻的區間消費，末筆偶爾壓在門檻附近示意「剛好升上來」
    const spent = Math.round(base * (1.8 - index * 0.08) + (index % 3) * 137);

    return {
      id: sortOrder * 100 + index + 1,
      memberCode: `M${String(sortOrder * 1000 + index * 17 + 108).padStart(6, '0')}`,
      name: MEMBER_NAMES[(sortOrder * 5 + index) % MEMBER_NAMES.length],
      windowSpent: spent,
      paidOrderCount: 3 + ((sortOrder * 7 + index * 2) % 24),
    };
  });
}
