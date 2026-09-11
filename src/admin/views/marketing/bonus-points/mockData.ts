import {
  BonusClaimStatus,
  BonusRewardType,
  type BonusClaimRecord,
  type BonusPointsRow,
} from './types';

/**
 * 紅利點數活動 mock 清單（原型階段用；今天基準約 2026-09-11）。
 *
 * 刻意涵蓋各種組合，方便展示 Tabs（進行中 / 接下來 / 已結束）、狀態開關、
 * 比例 vs 固定回饋、有無領取上限、領取進度等呈現。
 */
export const mockBonusPointsList: BonusPointsRow[] = [
  {
    id: '1',
    name: '已停用的比例回饋',
    rewardType: BonusRewardType.Percentage,
    rewardValue: 5,
    pointsCap: null,
    minSpend: 0,
    claimLimit: null,
    claimedCount: 0,
    startAt: '2026-01-01 08:00:00',
    endAt: '2027-01-01 07:59:59',
    enabled: false,
    description: '任意消費即回饋 5% 點數；目前暫停使用。',
  },
  {
    id: '2',
    name: '已結束的固定回饋活動',
    rewardType: BonusRewardType.Fixed,
    rewardValue: 100,
    pointsCap: null,
    minSpend: 0,
    claimLimit: 500,
    claimedCount: 500,
    startAt: '2026-01-01 08:00:00',
    endAt: '2026-04-01 07:59:59',
    enabled: true,
    description: '活動期間單筆消費即贈 100 點，名額已發放完畢。',
  },
  {
    id: '3',
    name: '低門檻 5% 回饋（滿 300 元）',
    rewardType: BonusRewardType.Percentage,
    rewardValue: 5,
    pointsCap: null,
    minSpend: 300,
    claimLimit: null,
    claimedCount: 1280,
    startAt: '2026-01-01 08:00:00',
    endAt: '2027-01-01 07:59:59',
    enabled: true,
    description: '單筆滿 300 元回饋 5% 點數，回饋日常小額消費。',
  },
  {
    id: '4',
    name: '高比例 8% 回饋（上限 150 點）',
    rewardType: BonusRewardType.Percentage,
    rewardValue: 8,
    pointsCap: 150,
    minSpend: 1000,
    claimLimit: 2000,
    claimedCount: 640,
    startAt: '2026-04-01 08:00:00',
    endAt: '2026-10-01 07:59:59',
    enabled: true,
    description: '單筆滿 1000 元回饋 8%，單筆最高贈 150 點。',
  },
  {
    id: '5',
    name: '高消費豪禮（滿 5000 送 800 點）',
    rewardType: BonusRewardType.Fixed,
    rewardValue: 800,
    pointsCap: null,
    minSpend: 5000,
    claimLimit: 300,
    claimedCount: 87,
    startAt: '2026-01-01 08:00:00',
    endAt: '2027-01-01 07:59:59',
    enabled: true,
    description: '單筆滿 5000 元即贈 800 點，鼓勵高客單價消費。',
  },
  {
    id: '6',
    name: '限時促銷固定 100 點',
    rewardType: BonusRewardType.Fixed,
    rewardValue: 100,
    pointsCap: null,
    minSpend: 0,
    claimLimit: 1000,
    claimedCount: 412,
    startAt: '2026-04-01 08:00:00',
    endAt: '2026-10-01 07:59:59',
    enabled: true,
    description: '促銷檔期單筆消費即贈 100 點。',
  },
  {
    id: '7',
    name: '滿額比例回饋',
    rewardType: BonusRewardType.Percentage,
    rewardValue: 6,
    pointsCap: 300,
    minSpend: 800,
    claimLimit: null,
    claimedCount: 0,
    startAt: '2026-01-01 08:00:00',
    endAt: '2027-01-01 07:59:59',
    enabled: false,
    description: '滿 800 元回饋 6%，單筆最高 300 點；目前停用中。',
  },
  {
    id: '8',
    name: '任意消費比例回饋',
    rewardType: BonusRewardType.Percentage,
    rewardValue: 3,
    pointsCap: null,
    minSpend: 0,
    claimLimit: null,
    claimedCount: 3560,
    startAt: '2026-01-01 08:00:00',
    endAt: '2027-01-01 07:59:59',
    enabled: true,
    description: '全站消費一律回饋 3% 點數，作為常態基礎回饋。',
  },
  {
    id: '9',
    name: '滿額固定回饋',
    rewardType: BonusRewardType.Fixed,
    rewardValue: 50,
    pointsCap: null,
    minSpend: 500,
    claimLimit: null,
    claimedCount: 920,
    startAt: '2026-01-01 08:00:00',
    endAt: '2027-01-01 07:59:59',
    enabled: true,
    description: '單筆滿 500 元即贈 50 點。',
  },
  {
    id: '10',
    name: '週年慶加碼 10% 回饋',
    rewardType: BonusRewardType.Percentage,
    rewardValue: 10,
    pointsCap: 500,
    minSpend: 1000,
    claimLimit: 3000,
    claimedCount: 0,
    startAt: '2026-11-01 08:00:00',
    endAt: '2026-11-30 23:59:59',
    enabled: true,
    description: '週年慶檔期滿 1000 元回饋 10%，單筆最高 500 點。',
  },
  {
    id: '11',
    name: '雙 12 固定贈點',
    rewardType: BonusRewardType.Fixed,
    rewardValue: 200,
    pointsCap: null,
    minSpend: 1200,
    claimLimit: 1500,
    claimedCount: 0,
    startAt: '2026-12-01 08:00:00',
    endAt: '2026-12-15 23:59:59',
    enabled: true,
    description: '雙 12 檔期單筆滿 1200 元贈 200 點。',
  },
];

/** 領取明細示範會員名單（依 index 輪流取用，產生穩定假資料） */
const MOCK_MEMBER_NAMES = [
  '陳怡君', '林哲宇', '黃美玲', '張家豪', '吳雅婷',
  '劉建宏', '蔡佩珊', '鄭凱文', '許雅雯', '王志明',
  '李欣怡', '周俊傑', '謝宜庭', '楊承翰', '洪詩涵',
];

/** 由字串種子產生穩定的正整數（避免 Math.random，讓每次開窗結果一致） */
function seededInt(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/** 由種子產生 7 碼英數領取代碼（形如 1L9BwwO） */
function makeClaimCode(seed: string): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789abcdefghijkmnopqrstuvwxyz';
  let n = seededInt(seed);
  let code = '';
  for (let i = 0; i < 7; i += 1) {
    code += chars[n % chars.length];
    n = Math.floor(n / chars.length) + (i + 1) * 17;
  }
  return code;
}

/** 把 'YYYY-MM-DD HH:mm:ss' 起始時間往後推 n 小時，做為領取時間 */
function addHours(base: string, hours: number): string {
  const d = new Date(base.replace(' ', 'T'));
  d.setHours(d.getHours() + hours);
  const p = (v: number) => String(v).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} `
    + `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/**
 * 依活動產生領取明細示範資料（原型階段用）。
 *
 * 取樣呈現：實際發行量可能上千筆，這裡最多產生 ~36 筆做示範；其中前段標記為「已領取」
 * （筆數對齊 claimedCount 但同樣封頂），其餘為「未領取」。代碼 / 連結由活動 id + index
 * 種子產生，確保每次開窗結果一致。
 */
export function createMockClaimRecords(row: BonusPointsRow): BonusClaimRecord[] {
  const SAMPLE_CAP = 36;
  const issued = row.claimLimit === null
    ? Math.min(Math.max(row.claimedCount, 12), SAMPLE_CAP)
    : Math.min(row.claimLimit, SAMPLE_CAP);
  const claimedInSample = Math.min(row.claimedCount, issued);

  return Array.from({ length: issued }, (_, i) => {
    const code = makeClaimCode(`${row.id}-${i}`);
    const isClaimed = i < claimedInSample;
    const memberName = MOCK_MEMBER_NAMES[(seededInt(`${row.id}-${i}-n`)) % MOCK_MEMBER_NAMES.length];
    const memberId = String(4800000000000000 + (seededInt(`${row.id}-${i}-m`) % 199999999));
    // 每 5 筆示範一次「代領 / 轉贈」：使用人 ID 與歸戶會員 ID 不同
    const isProxyClaim = isClaimed && i % 5 === 4;
    const usedById = isProxyClaim
      ? String(4800000000000000 + (seededInt(`${row.id}-${i}-u`) % 199999999))
      : memberId;

    return {
      claimCode: code,
      memberName: isClaimed ? memberName : null,
      claimedAt: isClaimed ? addHours(row.startAt, i * 5 + 2) : null,
      points: isClaimed
        ? (row.rewardType === BonusRewardType.Fixed
            ? row.rewardValue
            : Math.min(
                row.pointsCap ?? Number.MAX_SAFE_INTEGER,
                Math.round((row.minSpend > 0 ? row.minSpend : 1000) * row.rewardValue / 100),
              ))
        : null,
      memberId: isClaimed ? memberId : null,
      usedById: isClaimed ? usedById : null,
      orderNo: isClaimed && row.minSpend > 0 ? `A${20260500000 + seededInt(`${row.id}-${i}-o`) % 99999}` : null,
      status: isClaimed ? BonusClaimStatus.Claimed : BonusClaimStatus.Unclaimed,
    };
  });
}
