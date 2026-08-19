import { ref } from 'vue';

/**
 * 手動下標 - 場次紀錄 tab 用的 mock 資料
 * 涵蓋：場次卡、每場次的商品卡、每商品的候選會員（含多種找人情境）
 */

/** 場次卡（只顯示場次名稱） */
export interface ManualBidSession {
  id: string;
  name: string;
}

/** 場次內的商品卡 */
export interface ManualBidProduct {
  id: string;
  sessionId: string;
  name: string;
  keyword: string;
  price: number;
  image: string;
  /** 目前剩餘庫存（isPreorder 為 true 時無意義） */
  stock: number;
  /** 預購商品：不擋庫存 */
  isPreorder: boolean;
  /** 一般商品允許超賣：不擋庫存 */
  allowOversell: boolean;
}

/**
 * 候選會員來源類別
 * — smartMatch: 依商品關鍵字近似留言推薦
 * — commentUnpaired: 該場次留言但未成立訂單
 * — sessionBuyer: 該場次已成立訂單的買家
 * — productBuyer: 曾下標此商品的會員
 * — recent: 最近下單的活躍會員
 * — all: 全站會員（僅供搜尋 fallback）
 */
export type ManualBidMemberSource =
  | 'smartMatch'
  | 'commentUnpaired'
  | 'sessionBuyer'
  | 'productBuyer'
  | 'recent'
  | 'all';

/** 已選會員（含每人下標數量） */
export interface ManualBidPickedMember {
  member: ManualBidMemberCandidate;
  quantity: number;
}

/** 已選批次（帶場次 + 商品 + 會員） */
export interface ManualBidBatchPayload {
  session: ManualBidSession;
  product: ManualBidProduct;
  members: ManualBidPickedMember[];
}

/** 候選會員 */
export interface ManualBidMemberCandidate {
  id: string;
  memberCode: string;
  name: string;
  avatar: string;
  platform: 'facebook' | 'instagram' | 'tiktok' | 'line';
  socialAccount: string;
  phoneLast4: string;
  email: string;
  /** 該筆候選來自哪個場次的 pool */
  sessionId: string;
  /** 該筆候選相關的商品（智慧推薦、留言、下標關聯） */
  productId?: string;
  /** 來源類別（一個會員可能同時出現在多個 pool，用陣列表示） */
  sources: ManualBidMemberSource[];
  /** 顯示於卡片下方的情境備註（如「留言：+1 拿一件」、「近 7 天下單 3 筆」） */
  contextNote: string;
  /** VIP 標籤 */
  isVip?: boolean;
  /** 各平台 ID（訂購人「ID 搜尋」用；會員 ID 即 memberCode） */
  socialIds?: {
    facebook?: string;
    tiktok?: string;
    instagram?: string;
    livebuy?: string;
  };
}

const SAMPLE_AVATAR = 'https://placehold.co/64x64/8b5cf6/ffffff/png?text=A';
const SAMPLE_PRODUCT_IMG = 'https://placehold.co/120x120/e2e8f0/475569/png?text=P';

const mockSessions: ManualBidSession[] = [
  { id: 'sess-20260714', name: '2026-07-14 週三夜市直播' },
  { id: 'sess-20260712', name: '2026-07-12 週一晚間新品' },
  { id: 'sess-20260710', name: '2026-07-10 週五端午特賣' },
  { id: 'sess-20260707', name: '2026-07-07 週二日常清倉' },
  { id: 'sess-20260703', name: '2026-07-03 週五夏季服飾專場' },
  { id: 'sess-20260630', name: '2026-06-30 週二媽媽選物' },
];

const mockProducts: ManualBidProduct[] = [
  { id: 'p-1', sessionId: 'sess-20260714', name: '米色針織上衣', keyword: '+1', price: 590, image: SAMPLE_PRODUCT_IMG, stock: 5, isPreorder: false, allowOversell: false },
  { id: 'p-2', sessionId: 'sess-20260714', name: '寬版牛仔褲', keyword: '+2', price: 890, image: SAMPLE_PRODUCT_IMG, stock: 2, isPreorder: false, allowOversell: false },
  { id: 'p-3', sessionId: 'sess-20260714', name: '棉麻長裙', keyword: '+3', price: 690, image: SAMPLE_PRODUCT_IMG, stock: 999, isPreorder: false, allowOversell: true },
  { id: 'p-4', sessionId: 'sess-20260714', name: '真皮小方包', keyword: '+22', price: 1290, image: SAMPLE_PRODUCT_IMG, stock: 3, isPreorder: false, allowOversell: false },
  { id: 'p-5', sessionId: 'sess-20260712', name: '涼感短袖', keyword: 'A1', price: 390, image: SAMPLE_PRODUCT_IMG, stock: 30, isPreorder: false, allowOversell: false },
  { id: 'p-6', sessionId: 'sess-20260712', name: '休閒短褲', keyword: 'A2', price: 490, image: SAMPLE_PRODUCT_IMG, stock: 8, isPreorder: false, allowOversell: false },
  { id: 'p-7', sessionId: 'sess-20260710', name: '端午禮盒 A', keyword: 'DR-A', price: 880, image: SAMPLE_PRODUCT_IMG, stock: 0, isPreorder: true, allowOversell: false },
];

const mockMembers: ManualBidMemberCandidate[] = [
  {
    id: 'm-1001',
    memberCode: 'MB-0001',
    name: '孫小美',
    avatar: SAMPLE_AVATAR,
    platform: 'facebook',
    socialAccount: 'Sun.Little.Beauty',
    phoneLast4: '3421',
    email: 'sun.mei@example.com',
    sessionId: 'sess-20260714',
    productId: 'p-1',
    sources: ['smartMatch', 'commentUnpaired'],
    contextNote: '留言：「+11」（推測為 +1 手誤）',
    socialIds: { facebook: '1000000000001234', livebuy: 'LB-88001' },
    isVip: true,
  },
  {
    id: 'm-1002',
    memberCode: 'MB-0002',
    name: '王大明',
    avatar: SAMPLE_AVATAR,
    platform: 'facebook',
    socialAccount: 'Wang.DaMing',
    phoneLast4: '8890',
    email: 'daming@example.com',
    sessionId: 'sess-20260714',
    productId: 'p-1',
    sources: ['commentUnpaired'],
    contextNote: '留言：「一件米色的」（純文字未含關鍵字）',
    socialIds: { facebook: '1000000000005678' },
  },
  {
    id: 'm-1003',
    memberCode: 'MB-0003',
    name: '李小華',
    avatar: SAMPLE_AVATAR,
    platform: 'instagram',
    socialAccount: 'xiaohua.li',
    phoneLast4: '0102',
    email: 'xiaohua@example.com',
    sessionId: 'sess-20260714',
    productId: 'p-2',
    sources: ['sessionBuyer', 'recent'],
    contextNote: '本場已下標 2 筆｜近 30 天下 5 筆',
    socialIds: { instagram: 'ig_7788112233', livebuy: 'LB-88003' },
    isVip: true,
  },
  {
    id: 'm-1004',
    memberCode: 'MB-0004',
    name: '陳大力',
    avatar: SAMPLE_AVATAR,
    platform: 'facebook',
    socialAccount: 'Chen.DaLi',
    phoneLast4: '7788',
    email: 'chen.dali@example.com',
    sessionId: 'sess-20260714',
    productId: 'p-1',
    sources: ['productBuyer', 'sessionBuyer'],
    contextNote: '曾下標「米色針織上衣」3 次',
    socialIds: { facebook: '1000000000007788' },
  },
  {
    id: 'm-1005',
    memberCode: 'MB-0005',
    name: '林美人',
    avatar: SAMPLE_AVATAR,
    platform: 'tiktok',
    socialAccount: 'meiren.lin',
    phoneLast4: '9911',
    email: 'meiren@example.com',
    sessionId: 'sess-20260714',
    productId: 'p-2',
    sources: ['smartMatch', 'commentUnpaired'],
    contextNote: '留言：「+2 一件謝謝」（可能被過濾）',
    socialIds: { tiktok: 'tt_5566001122' },
  },
  {
    id: 'm-1006',
    memberCode: 'MB-0006',
    name: '錢蔬君',
    avatar: SAMPLE_AVATAR,
    platform: 'line',
    socialAccount: 'qian.shujun',
    phoneLast4: '2020',
    email: 'shujun@example.com',
    sessionId: 'sess-20260714',
    productId: 'p-4',
    sources: ['commentUnpaired'],
    contextNote: '留言：「小方包+2」（關鍵字為 +22 未配對）',
    socialIds: { livebuy: 'LB-88006' },
  },
  {
    id: 'm-1007',
    memberCode: 'MB-0007',
    name: '張美玲',
    avatar: SAMPLE_AVATAR,
    platform: 'facebook',
    socialAccount: 'Zhang.Meiling',
    phoneLast4: '5566',
    email: 'meiling@example.com',
    sessionId: 'sess-20260714',
    sources: ['recent'],
    contextNote: '近 7 天下單 4 筆（活躍常客）',
    socialIds: { facebook: '1000000000005566', instagram: 'ig_2233445566' },
    isVip: true,
  },
  {
    id: 'm-1008',
    memberCode: 'MB-0008',
    name: '黃志偉',
    avatar: SAMPLE_AVATAR,
    platform: 'facebook',
    socialAccount: 'Huang.ZhiWei',
    phoneLast4: '1122',
    email: 'zhiwei@example.com',
    sessionId: 'sess-20260714',
    sources: ['all'],
    contextNote: '全站會員',
    socialIds: { facebook: '1000000000001122', tiktok: 'tt_9900112233', livebuy: 'LB-88008' },
  },
];

/**
 * 提供手動下標場次紀錄 tab 的 mock 資料
 */
export function useManualBidSessionMock() {
  const sessions = ref<ManualBidSession[]>(mockSessions);
  const products = ref<ManualBidProduct[]>(mockProducts);
  const members = ref<ManualBidMemberCandidate[]>(mockMembers);

  return {
    sessions,
    products,
    members,
  };
}
