import { ref } from 'vue';

/**
 * 得標清單 row 狀態
 * — 對應舊 168money order_data.status:
 *   unfinished=5 未完成得標、transferredToOrder=6 已轉訂單、
 *   transferredToComplete=7 已轉完成單、discarded=4 已棄標
 */
export type BidListStatusKey =
  | 'unfinished'
  | 'transferredToOrder'
  | 'transferredToComplete'
  | 'discarded';

/**
 * 得標人（社群會員）資訊
 */
export interface BidListWinner {
  avatar: string;
  name: string;
  facebookId: string;
  psid?: string;
  /** 是否已綁定商店的 LINE 結帳通知（頭像會疊綠色 LINE icon） */
  hasLine?: boolean;
}

/**
 * 已轉單後對應的正式訂單狀態
 * — normal: 一般（顯示訂單編號連結）
 * — merged: 訂單資料已併單
 * — split:  訂單資料已拆單
 */
export type BidListLinkedOrderStatus = 'normal' | 'merged' | 'split';

/**
 * 組合商品的單一子商品（用於規格欄展開顯示其內容）
 */
export interface BidListBundleItem {
  /** 子商品名稱 */
  name: string;
  /** 子商品規格；無規格的子商品可省略（規格欄僅顯示名稱） */
  spec?: string;
  /** 組合內含數量（規格欄一律以「×N」顯示） */
  qty: number;
}

/**
 * 得標清單列（純 UI 用，mock-only）
 */
export interface BidListRow {
  /** 內部識別 id */
  id: string;
  /** 建立時間 */
  createTime: string;
  /** 最後異動時間 */
  updateTime: string;
  /** 商品卡建立時間（同場次 × 同商品共用，商品卡每場次僅建立一次） */
  productCardCreateTime: string;
  /** 場次名稱 */
  sessionName: string;
  /** 商品縮圖；空字串代表未上傳 */
  productImage: string;
  /** 商品卡圖片；加購商品有設定時優先於商品縮圖顯示，空字串或未設定代表商品卡未設圖 */
  cardImage?: string;
  /** 多購物車名稱；null 代表非多購物車 */
  multiCartName: string | null;
  /** 商品 ID（同商品名稱給同 ID，方便在歷史價格查詢中鎖定商品） */
  productId: string;
  /** 商品名稱 */
  productName: string;
  /** 是否為加購商品 */
  isAddOn: boolean;
  /** 是否為預購商品（切「預購」顯示類型時篩選用；一般顯示模式不顯示預購標籤） */
  isPreorder?: boolean;
  /**
   * 下單來源類型（對應舊系統 order_data.types）
   * — facebookPage=2 粉專單、preorder=5 預購單、multiCart=6 多購物車、community=8 社團單
   */
  bidOriginType: 'facebookPage' | 'preorder' | 'multiCart' | 'community';
  /** 是否為 LiveBuy 推薦商品（有 invite_code） */
  hasLivebuyInvite?: boolean;
  /** 是否已設定單品免運 */
  hasSingleItemFreeShipping: boolean;
  /** 標單編號 */
  bidNumber: string;
  /** 已轉單後對應的正式訂單編號（transferredToOrder / transferredToComplete 才有值） */
  linkedOrderNo?: string;
  /** 對應正式訂單的狀態 */
  linkedOrderStatus?: BidListLinkedOrderStatus;
  /** 規格備註 */
  specNote: string;
  /** 組合商品的子商品列表；有值代表此列為組合商品，規格欄顯示「組」Tag（內容置於 tooltip） */
  bundleItems?: BidListBundleItem[];
  /** 後選規格（買家先下標、規格待補選）；true 時規格欄顯示「待選規格」而非「無規格」 */
  isSpecPending?: boolean;
  /** 得標人資訊 */
  winner: BidListWinner;
  /** 得標數量 */
  quantity: number;
  /** 成本 */
  cost: number;
  /** 得標金額 */
  totalAmount: number;
  /** 星星評分（1~5，0 代表未評） */
  rating: number;
  /** 留言 */
  message: string;
  /** 平台 */
  platform: 'facebook' | 'instagram' | 'tiktok' | 'livebuy' | 'line';
  /** 收單方式（直播收單／貼文收單／社團收單） */
  orderMethod: 'live' | 'post' | 'community';
  /** 標單狀態 */
  status: BidListStatusKey;
}

const SAMPLE_AVATAR = 'https://placehold.co/64x64/8b5cf6/ffffff/png?text=A';
/** 假商品圖（picsum 種子圖；同種子每次載入同一張，僅 mockup 展示用） */
function fakeProductImage(seed: string): string {
  return `https://picsum.photos/seed/${seed}/240/240`;
}
const SAMPLE_CARD_IMG = 'https://placehold.co/120x120/bae6fd/0369a1/png?text=Card';

/** mock 買家 A：孫小美（已綁 LINE） */
const WINNER_A: BidListWinner = {
  avatar: SAMPLE_AVATAR,
  name: '孫小美',
  facebookId: '1000000000001234',
  hasLine: true,
};

/** mock 買家 B：王大明（未綁 LINE） */
const WINNER_B: BidListWinner = {
  avatar: SAMPLE_AVATAR,
  name: '王大明',
  facebookId: '1000000000005678',
};

/** mock 買家 C：李小華（已綁 LINE） */
const WINNER_C: BidListWinner = {
  avatar: SAMPLE_AVATAR,
  name: '李小華',
  facebookId: '1000000000005001',
  hasLine: true,
};

/** mock 買家 D：陳大力 */
const WINNER_D: BidListWinner = {
  avatar: SAMPLE_AVATAR,
  name: '陳大力',
  facebookId: '1000000000005002',
};

/** mock 買家 E：林美人（已綁 LINE） */
const WINNER_E: BidListWinner = {
  avatar: SAMPLE_AVATAR,
  name: '林美人',
  facebookId: '1000000000005003',
  hasLine: true,
};

/** mock 買家 F：錢蔬君（對照舊系統預購截圖 #44） */
const WINNER_F: BidListWinner = {
  avatar: SAMPLE_AVATAR,
  name: '錢蔬君',
  facebookId: '27835462632749939',
};

const mockList: BidListRow[] = [
  // ---- 組合商品示範列（規格欄改列子商品內容） ----
  {
    id: '20260714-bundle',
    createTime: '2026-07-14 10:05:22',
    updateTime: '2026-07-14 10:05:22',
    productCardCreateTime: '2026-07-14 10:00:00',
    sessionName: '0114',
    productImage: fakeProductImage('bundle'),
    multiCartName: null,
    productId: '900',
    productName: '暖冬三件組',
    isAddOn: false,
    hasSingleItemFreeShipping: false,
    bidNumber: '1000000000009001',
    specNote: '',
    bundleItems: [
      { name: '米色外衣', spec: 'XL', qty: 1 },
      { name: '堅果 500g', qty: 2 },
      { name: '保溫杯', spec: '藍', qty: 1 },
    ],
    winner: { ...WINNER_E },
    quantity: 1,
    cost: 0,
    totalAmount: 680,
    rating: 5,
    message: '手動下標 conv:12070',
    platform: 'facebook',
    orderMethod: 'live',
    bidOriginType: 'facebookPage',
    status: 'unfinished',
  },
  // ---- 組合商品示範列（子商品超過 3 件，規格欄以「更多」展開其餘） ----
  {
    id: '20260714-bundle2',
    createTime: '2026-07-14 10:04:08',
    updateTime: '2026-07-14 10:04:08',
    productCardCreateTime: '2026-07-14 10:00:00',
    sessionName: '0114',
    productImage: fakeProductImage('bundle2'),
    multiCartName: null,
    productId: '901',
    productName: '居家五件組',
    isAddOn: false,
    hasSingleItemFreeShipping: false,
    bidNumber: '1000000000009003',
    specNote: '',
    bundleItems: [
      { name: '米色外衣', spec: 'XL', qty: 1 },
      { name: '堅果 500g', qty: 2 },
      { name: '保溫杯', spec: '藍', qty: 1 },
      { name: '毛毯', spec: '灰', qty: 1 },
      { name: '拖鞋', spec: 'L', qty: 2 },
    ],
    winner: { ...WINNER_C },
    quantity: 1,
    cost: 0,
    totalAmount: 1280,
    rating: 4,
    message: '手動下標 conv:12072',
    platform: 'facebook',
    orderMethod: 'live',
    bidOriginType: 'facebookPage',
    status: 'unfinished',
  },
  // ---- 後選規格示範列（規格欄顯示「待選規格」） ----
  {
    id: '20260714-pending',
    createTime: '2026-07-14 10:02:10',
    updateTime: '2026-07-14 10:02:10',
    productCardCreateTime: '2026-07-14 10:00:00',
    sessionName: '0114',
    productImage: fakeProductImage('coat'),
    multiCartName: null,
    productId: '123',
    productName: '米色外衣',
    isAddOn: false,
    hasSingleItemFreeShipping: false,
    bidNumber: '1000000000009002',
    specNote: '',
    isSpecPending: true,
    winner: { ...WINNER_B },
    quantity: 1,
    cost: 0,
    totalAmount: 5,
    rating: 0,
    message: '手動下標 conv:12071',
    platform: 'facebook',
    orderMethod: 'live',
    bidOriginType: 'facebookPage',
    status: 'unfinished',
  },
  {
    id: '20260714-001',
    createTime: '2026-07-14 09:17:41',
    updateTime: '2026-07-14 09:20:00',
    productCardCreateTime: '2026-07-14 09:00:12',
    sessionName: '0114',
    productImage: fakeProductImage('coat'),
    multiCartName: null,
    productId: '123',
    productName: '米色外衣',
    isAddOn: false,
    hasSingleItemFreeShipping: false,
    bidNumber: '1000000000001111',
    specNote: '規格:XL',
    winner: { ...WINNER_A },
    quantity: 1,
    cost: 0,
    totalAmount: 5,
    rating: 3,
    message: 'MerchantApi 手動下標 conv:12063',
    platform: 'facebook',
    orderMethod: 'live',
    bidOriginType: 'facebookPage',
    status: 'unfinished',
  },
  // ---- 同群組 A：0114 場次 × 米色外衣 ----
  {
    id: '20260714-001b',
    createTime: '2026-07-14 09:22:15',
    updateTime: '2026-07-14 09:22:15',
    productCardCreateTime: '2026-07-14 09:00:12',
    sessionName: '0114',
    productImage: fakeProductImage('coat'),
    multiCartName: null,
    productId: '123',
    productName: '米色外衣',
    isAddOn: false,
    hasSingleItemFreeShipping: false,
    bidNumber: '1000000000001112',
    specNote: '規格:XL',
    winner: { ...WINNER_C },
    quantity: 2,
    cost: 0,
    totalAmount: 10,
    rating: 4,
    message: '手動下標 conv:12064',
    platform: 'facebook',
    orderMethod: 'live',
    bidOriginType: 'facebookPage',
    status: 'unfinished',
  },
  {
    id: '20260714-001c',
    createTime: '2026-07-14 09:35:03',
    updateTime: '2026-07-14 09:35:03',
    productCardCreateTime: '2026-07-14 09:00:12',
    sessionName: '0114',
    productImage: fakeProductImage('coat'),
    multiCartName: null,
    productId: '123',
    productName: '米色外衣',
    isAddOn: false,
    hasSingleItemFreeShipping: false,
    bidNumber: '1000000000001113',
    specNote: '規格:XL',
    winner: { ...WINNER_D },
    quantity: 1,
    cost: 0,
    totalAmount: 5,
    rating: 0,
    message: '手動下標 conv:12065',
    platform: 'facebook',
    orderMethod: 'live',
    bidOriginType: 'facebookPage',
    status: 'transferredToOrder',
    linkedOrderNo: '2000000000001113',
    linkedOrderStatus: 'normal',
  },
  {
    id: '20260711-002',
    createTime: '2026-07-11 22:19:02',
    updateTime: '2026-07-11 22:19:02',
    productCardCreateTime: '2026-07-11 20:15:33',
    sessionName: 'Test 0711-2',
    productImage: '',
    cardImage: SAMPLE_CARD_IMG,
    multiCartName: '水果',
    productId: '201',
    productName: 'ooo111',
    isAddOn: true,
    hasSingleItemFreeShipping: true,
    bidNumber: '1000000000002222',
    specNote: '',
    winner: { ...WINNER_B },
    quantity: 1,
    cost: 0,
    totalAmount: 77,
    rating: 3,
    message: '加購下單',
    platform: 'facebook',
    orderMethod: 'live',
    bidOriginType: 'multiCart',
    status: 'unfinished',
  },
  {
    id: '20260711-003',
    createTime: '2026-07-11 21:54:42',
    updateTime: '2026-07-12 10:00:00',
    productCardCreateTime: '2026-07-11 21:30:50',
    sessionName: 'Test 0711-2',
    productImage: '',
    multiCartName: null,
    productId: '202',
    productName: 'go',
    isAddOn: false,
    hasSingleItemFreeShipping: false,
    bidNumber: '1000000000003333',
    linkedOrderNo: '2000000000003333',
    linkedOrderStatus: 'normal',
    specNote: '',
    winner: { ...WINNER_B },
    quantity: 1,
    cost: 0,
    totalAmount: 50,
    rating: 3,
    message: '加購下單',
    platform: 'facebook',
    orderMethod: 'post',
    bidOriginType: 'facebookPage',
    status: 'transferredToOrder',
  },
  // ---- 同群組 B：Test 0711-2 場次 × go ----
  {
    id: '20260711-003b',
    createTime: '2026-07-11 22:03:11',
    updateTime: '2026-07-11 22:03:11',
    productCardCreateTime: '2026-07-11 21:30:50',
    sessionName: 'Test 0711-2',
    productImage: '',
    multiCartName: null,
    productId: '202',
    productName: 'go',
    isAddOn: false,
    hasSingleItemFreeShipping: false,
    bidNumber: '1000000000003334',
    specNote: '',
    winner: { ...WINNER_E },
    quantity: 1,
    cost: 0,
    totalAmount: 50,
    rating: 5,
    message: '加購下單',
    platform: 'facebook',
    orderMethod: 'post',
    bidOriginType: 'facebookPage',
    status: 'unfinished',
  },
  {
    id: '20260623-004',
    createTime: '2026-06-23 02:14:21',
    updateTime: '2026-06-24 09:00:00',
    productCardCreateTime: '2026-06-23 02:00:33',
    sessionName: 'test-0623-1',
    productImage: fakeProductImage('serum'),
    multiCartName: null,
    productId: '203',
    productName: '精華液安瓶',
    isAddOn: false,
    hasSingleItemFreeShipping: false,
    bidNumber: '1000000000004444',
    linkedOrderNo: '2000000000004444',
    linkedOrderStatus: 'merged',
    specNote: '規格:小容量',
    winner: {
      ...WINNER_A,
      psid: '3000000000001234',
    },
    quantity: 1,
    cost: 999,
    totalAmount: 999,
    rating: 3,
    message: 'MerchantApi 手動下標 conv:1',
    platform: 'facebook',
    orderMethod: 'live',
    bidOriginType: 'facebookPage',
    status: 'transferredToComplete',
  },
  // ---- 同群組 C：test-0623-1 場次 × 精華液安瓶 ----
  {
    id: '20260623-004b',
    createTime: '2026-06-23 02:33:07',
    updateTime: '2026-06-23 02:33:07',
    productCardCreateTime: '2026-06-23 02:00:33',
    sessionName: 'test-0623-1',
    productImage: fakeProductImage('serum'),
    multiCartName: null,
    productId: '203',
    productName: '精華液安瓶',
    isAddOn: false,
    hasSingleItemFreeShipping: false,
    bidNumber: '1000000000004445',
    specNote: '規格:小容量',
    winner: { ...WINNER_C },
    quantity: 2,
    cost: 1998,
    totalAmount: 1998,
    rating: 4,
    message: '手動下標 conv:2',
    platform: 'facebook',
    orderMethod: 'live',
    bidOriginType: 'facebookPage',
    status: 'unfinished',
  },
  // ---- 預購範例 A（對照舊系統顯示預購截圖 #44）----
  {
    id: '20260711-P01',
    createTime: '2026-07-11 21:54:42',
    updateTime: '2026-07-11 21:54:42',
    productCardCreateTime: '2026-07-11 21:30:50',
    sessionName: 'Test 0711-2',
    productImage: fakeProductImage('go'),
    multiCartName: null,
    productId: '202',
    productName: 'go',
    isAddOn: true,
    isPreorder: true,
    hasSingleItemFreeShipping: false,
    bidNumber: '17837780821162515a',
    specNote: '',
    winner: { ...WINNER_F },
    quantity: 1,
    cost: 0,
    totalAmount: 50,
    rating: 3,
    message: 'ppp (加購)',
    platform: 'facebook',
    orderMethod: 'live',
    bidOriginType: 'preorder',
    status: 'unfinished',
  },
  // ---- 預購範例 B（另一場次另一商品，方便對照排序） ----
  {
    id: '20260705-P02',
    createTime: '2026-07-05 14:22:08',
    updateTime: '2026-07-05 14:22:08',
    productCardCreateTime: '2026-07-05 14:00:00',
    sessionName: '0705 預購場',
    productImage: fakeProductImage('blanket'),
    multiCartName: null,
    productId: '204',
    productName: '限量秋冬羊毛毯',
    isAddOn: false,
    isPreorder: true,
    hasSingleItemFreeShipping: false,
    bidNumber: '1000000000009999',
    specNote: '規格:單人',
    winner: { ...WINNER_C },
    quantity: 1,
    cost: 480,
    totalAmount: 890,
    rating: 4,
    message: '預購下單 conv:9001',
    platform: 'facebook',
    orderMethod: 'post',
    bidOriginType: 'preorder',
    status: 'unfinished',
  },
  // ---- 棄標範例 A（對照舊系統顯示棄標標單截圖 #39 第一列）----
  {
    id: '20260711-005',
    createTime: '2026-07-11 21:54:42',
    updateTime: '2026-07-11 21:54:42',
    productCardCreateTime: '2026-07-11 21:30:50',
    sessionName: 'Test 0711-2',
    productImage: '',
    multiCartName: null,
    productId: '202',
    productName: 'go',
    isAddOn: true,
    hasSingleItemFreeShipping: false,
    bidNumber: '178377636770064d1',
    specNote: '',
    winner: {
      avatar: SAMPLE_AVATAR,
      name: 'Pan Sino',
      facebookId: '22168813816587',
    },
    quantity: 1,
    cost: 0,
    totalAmount: 50,
    rating: 3,
    message: '加購下單',
    platform: 'facebook',
    orderMethod: 'live',
    bidOriginType: 'facebookPage',
    status: 'discarded',
  },
  // ---- 棄標範例 B（對照舊系統顯示棄標標單截圖 #39 第二列）----
  {
    id: '20260630-007',
    createTime: '2026-06-30 13:22:21',
    updateTime: '2026-06-30 13:22:21',
    productCardCreateTime: '2026-06-30 13:10:45',
    sessionName: 'test0630',
    productImage: fakeProductImage('test0630'),
    multiCartName: null,
    productId: '210',
    productName: 'test0630',
    isAddOn: false,
    hasSingleItemFreeShipping: false,
    bidNumber: '1782796434253b944',
    specNote: '',
    winner: {
      avatar: SAMPLE_AVATAR,
      name: '蔵仲文',
      facebookId: '2',
    },
    quantity: 1,
    cost: 100,
    totalAmount: 100,
    rating: 0,
    message: '手動下標單，空白標單 conv:1 79',
    platform: 'facebook',
    orderMethod: 'post',
    bidOriginType: 'facebookPage',
    status: 'discarded',
  },
  // ---- 同人不同筆但無名字：與王大明同 fbid，但此筆 fbname 為空且 member 反查也沒有 ----
  {
    id: '20260709-006',
    createTime: '2026-07-09 15:08:03',
    updateTime: '2026-07-09 15:08:03',
    productCardCreateTime: '2026-07-09 14:50:27',
    sessionName: 'Test 0709',
    productImage: fakeProductImage('allocation-b'),
    multiCartName: null,
    productId: '205',
    productName: '配貨測試 B',
    isAddOn: false,
    hasSingleItemFreeShipping: false,
    bidNumber: '1000000000008888',
    specNote: '',
    winner: { ...WINNER_B, name: '' },
    quantity: 1,
    cost: 60,
    totalAmount: 60,
    rating: 0,
    message: 'MerchantApi 手動下標 conv:31021（payload 未帶 fbname）',
    platform: 'facebook',
    orderMethod: 'live',
    bidOriginType: 'facebookPage',
    status: 'unfinished',
  },
  // ---- 多購物車情境 B：零食組（對照 showStatus=7）----
  {
    id: '20260712-M01',
    createTime: '2026-07-12 20:11:05',
    updateTime: '2026-07-12 20:11:05',
    productCardCreateTime: '2026-07-09 11:26:40',
    sessionName: '0712 夜市',
    productImage: fakeProductImage('nuts'),
    multiCartName: '零食組',
    productId: '206',
    productName: '綜合堅果 500g',
    isAddOn: false,
    hasSingleItemFreeShipping: false,
    bidNumber: '1000000000012001',
    specNote: '',
    winner: { ...WINNER_E },
    quantity: 2,
    cost: 200,
    totalAmount: 480,
    rating: 4,
    message: '多購物車：零食組',
    platform: 'facebook',
    orderMethod: 'live',
    bidOriginType: 'multiCart',
    status: 'unfinished',
  },
  // ---- 社團單情境（對照 showStatus=8）----
  {
    id: '20260710-C01',
    createTime: '2026-07-10 19:35:22',
    updateTime: '2026-07-10 19:35:22',
    productCardCreateTime: '2026-07-10 19:20:11',
    sessionName: '社團團購場',
    productImage: fakeProductImage('steak'),
    multiCartName: '社團 A',
    productId: '207',
    productName: '會員限定牛排組',
    isAddOn: false,
    hasSingleItemFreeShipping: false,
    bidNumber: '1000000000013001',
    specNote: '規格:6 入',
    winner: { ...WINNER_D },
    quantity: 1,
    cost: 1500,
    totalAmount: 2800,
    rating: 5,
    message: '社團團購單',
    platform: 'facebook',
    orderMethod: 'community',
    bidOriginType: 'community',
    status: 'unfinished',
  },
  // ---- LiveBuy 購物情境（對照 showStatus=11）----
  {
    id: '20260708-L01',
    createTime: '2026-07-08 10:15:00',
    updateTime: '2026-07-08 10:15:00',
    productCardCreateTime: '2026-07-08 10:02:46',
    sessionName: 'LiveBuy 首頁',
    productImage: fakeProductImage('livebuy'),
    multiCartName: null,
    productId: '208',
    productName: 'LiveBuy 站內下單商品',
    isAddOn: false,
    hasSingleItemFreeShipping: false,
    bidNumber: '1000000000014001',
    specNote: '',
    winner: { ...WINNER_C },
    quantity: 1,
    cost: 250,
    totalAmount: 599,
    rating: 3,
    message: 'LiveBuy 下單',
    platform: 'livebuy',
    orderMethod: 'live',
    bidOriginType: 'facebookPage',
    status: 'unfinished',
  },
  // ---- LiveBuy 推薦商品情境（有 invite_code，對照 showStatus=12）----
  {
    id: '20260706-L02',
    createTime: '2026-07-06 16:42:19',
    updateTime: '2026-07-06 16:42:19',
    productCardCreateTime: '2026-07-06 16:30:08',
    sessionName: 'LiveBuy 推薦',
    productImage: fakeProductImage('recommend'),
    multiCartName: null,
    productId: '209',
    productName: '推薦碼 REC-8888 商品',
    isAddOn: false,
    hasSingleItemFreeShipping: false,
    bidNumber: '1000000000015001',
    specNote: '',
    winner: { ...WINNER_E },
    quantity: 1,
    cost: 300,
    totalAmount: 899,
    rating: 4,
    message: 'LiveBuy 推薦下單，invite_code=REC-8888',
    platform: 'livebuy',
    orderMethod: 'live',
    bidOriginType: 'facebookPage',
    hasLivebuyInvite: true,
    status: 'unfinished',
  },
];

/**
 * 提供得標清單列表的 mock 資料來源
 */
export function useBidListMock() {
  const rows = ref<BidListRow[]>(mockList);
  const totalRecords = ref<number>(mockList.length);
  const isLoading = ref<boolean>(false);

  return {
    rows,
    totalRecords,
    isLoading,
  };
}
