import {
  BonusGiftType,
  BonusSendStatus,
  BonusSource,
  type BonusOrderCart,
  type BonusOrderDetail,
  type BonusPointsRow,
  type BonusSendRecord,
} from './types';

/**
 * 紅利點數活動 mock 清單（原型階段用；今天基準約 2026-09-14）。
 *
 * 刻意涵蓋各種組合，方便展示 Tabs（進行中 / 接下來 / 已結束）、狀態開關、
 * 百分比 vs 現金贈送、有無門檻、有無發送上限等呈現。
 */
export const mockBonusPointsList: BonusPointsRow[] = [
  {
    id: '1',
    name: '已停用的比例回饋',
    source: BonusSource.Consumption,
    sendLimit: null,
    perMemberLimit: null,
    minSpend: 0,
    giftType: BonusGiftType.Percentage,
    giftValue: 5,
    giftCap: null,
    sentCount: 0,
    description: '任意消費即回饋 5% 點數；目前暫停使用。',
    note: '暫停中，待行銷確認後再開啟。',
    startAt: '2026-01-01 08:00:00',
    endAt: '2027-01-01 07:59:59',
    enabled: false,
  },
  {
    id: '2',
    name: '已結束的固定回饋活動',
    source: BonusSource.Consumption,
    sendLimit: 500,
    perMemberLimit: 1,
    minSpend: 0,
    giftType: BonusGiftType.Cash,
    giftValue: 100,
    giftCap: null,
    sentCount: 500,
    description: '活動期間單筆消費即贈 100 點，名額已發放完畢。',
    note: '名額已用罄。',
    startAt: '2026-01-01 08:00:00',
    endAt: '2026-04-01 07:59:59',
    enabled: true,
  },
  {
    id: '3',
    name: '低門檻 5% 回饋（滿 300 元）',
    source: BonusSource.Consumption,
    sendLimit: null,
    perMemberLimit: null,
    minSpend: 300,
    giftType: BonusGiftType.Percentage,
    giftValue: 5,
    giftCap: null,
    sentCount: 1280,
    description: '單筆滿 300 元回饋 5% 點數，回饋日常小額消費。',
    note: '',
    startAt: '2026-01-01 08:00:00',
    endAt: '2027-01-01 07:59:59',
    enabled: true,
  },
  {
    id: '4',
    name: '高比例 8% 回饋（上限 150 點）',
    source: BonusSource.Consumption,
    sendLimit: 2000,
    perMemberLimit: null,
    minSpend: 1000,
    giftType: BonusGiftType.Percentage,
    giftValue: 8,
    giftCap: 150,
    sentCount: 640,
    description: '單筆滿 1000 元回饋 8%，單筆最高贈 150 點。',
    note: '檔期主打活動。',
    startAt: '2026-04-01 08:00:00',
    endAt: '2026-10-01 07:59:59',
    enabled: true,
  },
  {
    id: '5',
    name: '高消費豪禮（滿 5000 送 800 點）',
    source: BonusSource.Consumption,
    sendLimit: 300,
    perMemberLimit: 1,
    minSpend: 5000,
    giftType: BonusGiftType.Cash,
    giftValue: 800,
    giftCap: null,
    sentCount: 87,
    description: '單筆滿 5000 元即贈 800 點，鼓勵高客單價消費。',
    note: '',
    startAt: '2026-01-01 08:00:00',
    endAt: '2027-01-01 07:59:59',
    enabled: true,
  },
  {
    id: '6',
    name: '註冊禮固定 100 點',
    source: BonusSource.Register,
    sendLimit: 1000,
    perMemberLimit: 1,
    minSpend: 0,
    giftType: BonusGiftType.Cash,
    giftValue: 100,
    giftCap: null,
    sentCount: 412,
    description: '新會員註冊即贈 100 點。',
    note: '拉新專用。',
    startAt: '2026-04-01 08:00:00',
    endAt: '2026-10-01 07:59:59',
    enabled: true,
  },
  {
    id: '7',
    name: '滿額比例回饋',
    source: BonusSource.Consumption,
    sendLimit: null,
    perMemberLimit: null,
    minSpend: 800,
    giftType: BonusGiftType.Percentage,
    giftValue: 6,
    giftCap: 300,
    sentCount: 0,
    description: '滿 800 元回饋 6%，單筆最高 300 點；目前停用中。',
    note: '待審核文案後開啟。',
    startAt: '2026-01-01 08:00:00',
    endAt: '2027-01-01 07:59:59',
    enabled: false,
  },
  {
    id: '8',
    name: '任意消費比例回饋',
    source: BonusSource.Consumption,
    sendLimit: null,
    perMemberLimit: null,
    minSpend: 0,
    giftType: BonusGiftType.Percentage,
    giftValue: 3,
    giftCap: null,
    sentCount: 3560,
    description: '全站消費一律回饋 3% 點數，作為常態基礎回饋。',
    note: '常態基礎回饋，勿隨意關閉。',
    startAt: '2026-01-01 08:00:00',
    endAt: '2027-01-01 07:59:59',
    enabled: true,
  },
  {
    id: '9',
    name: '滿額固定回饋',
    source: BonusSource.Consumption,
    sendLimit: null,
    perMemberLimit: null,
    minSpend: 500,
    giftType: BonusGiftType.Cash,
    giftValue: 50,
    giftCap: null,
    sentCount: 920,
    description: '單筆滿 500 元即贈 50 點。',
    note: '',
    startAt: '2026-01-01 08:00:00',
    endAt: '2027-01-01 07:59:59',
    enabled: true,
  },
  {
    id: '10',
    name: '週年慶加碼 10% 回饋',
    source: BonusSource.Consumption,
    sendLimit: 3000,
    perMemberLimit: null,
    minSpend: 1000,
    giftType: BonusGiftType.Percentage,
    giftValue: 10,
    giftCap: 500,
    sentCount: 0,
    description: '週年慶檔期滿 1000 元回饋 10%，單筆最高 500 點。',
    note: '週年慶主檔，11 月上線。',
    startAt: '2026-11-01 08:00:00',
    endAt: '2026-11-30 23:59:59',
    enabled: true,
  },
  {
    id: '11',
    name: '雙 12 固定贈點',
    source: BonusSource.Consumption,
    sendLimit: 1500,
    perMemberLimit: 1,
    minSpend: 1200,
    giftType: BonusGiftType.Cash,
    giftValue: 200,
    giftCap: null,
    sentCount: 0,
    description: '雙 12 檔期單筆滿 1200 元贈 200 點。',
    note: '雙 12 檔期。',
    startAt: '2026-12-01 08:00:00',
    endAt: '2026-12-15 23:59:59',
    enabled: true,
  },
];

/** 發送明細示範會員名單（依 index 輪流取用，產生穩定假資料） */
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

/** 由種子產生 7 碼英數發送代碼（形如 1L9BwwO） */
function makeSendCode(seed: string): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789abcdefghijkmnopqrstuvwxyz';
  let n = seededInt(seed);
  let code = '';
  for (let i = 0; i < 7; i += 1) {
    code += chars[n % chars.length];
    n = Math.floor(n / chars.length) + (i + 1) * 17;
  }
  return code;
}

/** 把 'YYYY-MM-DD HH:mm:ss' 起始時間往後推 n 小時，做為發送時間 */
function addHours(base: string, hours: number): string {
  const d = new Date(base.replace(' ', 'T'));
  d.setHours(d.getHours() + hours);
  const p = (v: number) => String(v).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} `
    + `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** 折抵點數示範值 */
const POINTS_USED_SET = [100, 200, 300, 500];

/** 由種子產生會員識別（FBID / ID / 會員編號 三種形式輪流） */
function makeMemberRef(seed: string, i: number): string {
  const kind = i % 3;
  if (kind === 0) return `FBID:1000${String(10000000000 + (seededInt(seed) % 89999999999))}`;
  const code = makeSendCode(`${seed}-mr`).toUpperCase().slice(0, 6);
  return kind === 1 ? `ID:TEST_MEMBER_20251001_${code}` : `TEST_MEMBER_20251001_${code}`;
}

/**
 * 依活動產生發送明細（使用此活動的訂單）示範資料（原型階段用）。
 *
 * 取樣呈現：實際訂單量可能上千筆，這裡最多產生 ~30 筆做示範；代碼 / 金額由活動 id + index
 * 種子產生，確保每次開窗結果一致。
 */
export function createMockSendRecords(row: BonusPointsRow): BonusSendRecord[] {
  const SAMPLE_CAP = 30;
  const count = Math.min(Math.max(row.sentCount, 6), SAMPLE_CAP);

  return Array.from({ length: count }, (_, i) => {
    const memberName = MOCK_MEMBER_NAMES[(seededInt(`${row.id}-${i}-n`)) % MOCK_MEMBER_NAMES.length];
    const memberRef = makeMemberRef(`${row.id}-${i}`, i);
    const orderedAt = addHours(row.startAt, i * 3 + 2);
    // 訂單編號沿用訂單列表格式：A + YYYYMMDD（下單日）+ 3 碼流水
    const seq = String((seededInt(`${row.id}-${i}-o`) % 900) + 100);
    const orderNo = `A${orderedAt.slice(0, 10).replace(/-/g, '')}${seq}`;
    const pointsUsed = POINTS_USED_SET[seededInt(`${row.id}-${i}-p`) % POINTS_USED_SET.length];
    const amountAfterDeduction = 1000 + (seededInt(`${row.id}-${i}-a`) % 10000);

    return {
      memberName,
      memberRef,
      orderNo,
      orderedAt,
      pointsUsed,
      amountAfterDeduction,
      status: BonusSendStatus.Sent,
    };
  });
}

/** 商品示範資料池（童裝 / 玩具） */
const PRODUCT_POOL = [
  { name: '新款 包屁衣韓版小洋裝', price: 290 },
  { name: '秋裝針織包屁衣', price: 290 },
  { name: '秋裝長袖公主南瓜系包屁衣', price: 290 },
  { name: '草莓泳衣 女寶寶專用 0-3歲', price: 190 },
  { name: '秋冬荷葉邊包暖 全棉 男寶女寶都可穿！', price: 290 },
  { name: '秋裝全棉女寶寶包屁褲 附贈襪子/帽子', price: 290 },
  { name: 'ins 嬰兒秋裝長袖連體包屁衣 女寶寶秋裝', price: 50 },
  { name: '秋裝女寶寶針織 兩件式', price: 290 },
  { name: '英式田園風草莓女寶寶裝 包屁褲', price: 290 },
  { name: '0-3歲積木寶寶精細', price: 190 },
];

/** 購物車 / 賣場名稱池 */
const CART_NAMES = [
  '美美姐家童裝搭活動滿千送百',
  '下午場玩具波波家',
  '晚場親子服飾團',
  '週末寶寶用品快閃',
];

/**
 * 依訂單編號產生「查看商品項目」示範資料（依購物車分組），原型階段用。
 * 種子取自 orderNo，確保每次開窗結果一致。
 */
export function createMockOrderCarts(orderNo: string): BonusOrderCart[] {
  const cartCount = (seededInt(`${orderNo}-cc`) % 2) + 1;

  return Array.from({ length: cartCount }, (_, c) => {
    const cartName = CART_NAMES[(seededInt(`${orderNo}-cn-${c}`)) % CART_NAMES.length];
    const itemCount = c === 0
      ? (seededInt(`${orderNo}-ic-${c}`) % 6) + 3
      : (seededInt(`${orderNo}-ic-${c}`) % 2) + 1;

    const items = Array.from({ length: itemCount }, (_, i) => {
      const p = PRODUCT_POOL[(seededInt(`${orderNo}-p-${c}-${i}`)) % PRODUCT_POOL.length];
      const quantity = (seededInt(`${orderNo}-q-${c}-${i}`) % 5) + 1;
      return { name: p.name, unitPrice: p.price, quantity, cost: null, price: p.price * quantity };
    });

    const subtotal = items.reduce((sum, it) => sum + it.price, 0);
    return { cartName, items, subtotal };
  });
}

/**
 * 依訂單編號 + 折抵點數，產生「查看商品項目」的金額明細（比照商城前台結帳計算），原型階段用。
 */
export function createMockOrderDetail(orderNo: string, pointsUsed: number): BonusOrderDetail {
  const carts = createMockOrderCarts(orderNo);
  const productTotal = carts.reduce((sum, c) => sum + c.subtotal, 0);
  const shippingFee = [0, 60, 150][seededInt(`${orderNo}-sf`) % 3];
  const shippingDiscount = 0;
  const couponDiscount = seededInt(`${orderNo}-cp`) % 3 === 0
    ? (seededInt(`${orderNo}-cpv`) % 150) + 50
    : null;
  const pointsDeduction = pointsUsed;
  const total = productTotal + shippingFee - shippingDiscount - (couponDiscount ?? 0) - pointsDeduction;
  return { carts, productTotal, shippingFee, shippingDiscount, couponDiscount, pointsDeduction, total };
}
