/**
 * ⚠️ MOCK / 版面預覽假資料 — 請勿上 production。
 *
 * 會員列表與明細/訂單/點數/訊息彈窗為對齊設計 mockup 而擴充，但後端目前未提供這些欄位。
 * 本檔為純前端假資料，僅供版面／視覺預覽使用；待後端補齊對應欄位後，應改由 API 驅動並移除本檔。
 *
 * 對應設計原型：`會員管理.html`。
 */

/** 會員等級（對齊 mockup：一般 / 銅卡 / 銀卡 / 金卡）。 */
export type MockMemberLevel = 'normal' | 'bronze' | 'silver' | 'gold';

/** 會員狀態（對齊 mockup：正常 / 停權 / 黑名單）。 */
export type MockMemberStatus = 'normal' | 'suspended' | 'blacklisted';

/** 性別（走 i18n，不存中文字串）。 */
export type MockMemberGender = 'male' | 'female' | null;

/** 第三方綁定管道開通狀態。 */
export interface MockMemberBindings {
  facebook: boolean;
  line: boolean;
  google: boolean;
  whatsapp: boolean;
  tiktok: boolean;
}

/** 綁定管道鍵（對應 `MockMemberBindings` 的欄位）。 */
export type BindingChannelKey = keyof MockMemberBindings;

/** 會員列表列（mock）。欄位對齊 mockup 14 欄 + 明細/訂單/點數彈窗所需資料。 */
export interface MockMemberRow {
  /** 流水編號 */
  id: number;
  /** 會員編號（對外顯示碼，如 M10101） */
  no: string;
  name: string;
  /** 已隱碼手機（列表顯示用；完整號碼見 phoneFull） */
  mobileMasked: string;
  /** 完整手機（明細彈窗 PII 點開顯示用；null 代表未提供） */
  phoneFull: string | null;
  email: string | null;
  address: string | null;
  gender: MockMemberGender;
  /** 生日（ISO date；null 代表未填） */
  birthday: string | null;
  bindings: MockMemberBindings;
  level: MockMemberLevel;
  /** 星等 0–5，商家手動評定 */
  stars: number;
  /** 評星備註（預設空字串） */
  starNote: string;
  /** 累積消費（元） */
  spend: number;
  /** 紅利點數 */
  points: number;
  /** 訂單數 */
  orders: number;
  /** 已完成訂單數（≤ orders；供訂單紀錄狀態衍生） */
  completedOrders: number;
  /** 標單數 */
  bids: number;
  /** 棄標數（≤ 標單數；棄標率 = abandonedBids / bids） */
  abandonedBids: number;
  /** 開播通知訂閱（會員端自行開通，商家唯讀顯示） */
  notifLiveEnabled: boolean;
  /** 帳號建立日期（ISO） */
  createdAt: string;
  /** 最後購買日 / 最後下單日（ISO；null 代表尚無購買） */
  lastOrderAt: string | null;
  /** 最後結帳日（ISO；null 代表尚無） */
  lastCheckoutAt: string | null;
  /** 最後訂單日（ISO；null 代表尚無） */
  lastOrderCreatedAt: string | null;
  status: MockMemberStatus;
}

/**
 * 會員列表搜尋條件（mock，對齊 mockup 搜尋區）。
 *
 * 各欄位以 `null`／空值表示「全部／不限」（緊湊模式：placeholder 當 label，Select 以 show-clear 清回 null）。
 * `status` 下拉僅提供 正常／停權；黑名單改由 `blacklistOnly` 快切。
 * `bindings` 為多選，語意為「需全部符合」（AND）。
 */
export interface MemberMockFilter {
  keyword: string;
  level: MockMemberLevel | null;
  status: MockMemberStatus | null;
  stars: number | null;
  bindings: BindingChannelKey[];
  createdAtRange: [Date, Date] | null;
  blacklistOnly: boolean;
}

/** 版面預覽用假資料（涵蓋各等級 / 星等 / 狀態 / 綁定 / 棄標率高低、以及有無 email/地址等空值狀態）。 */
export const mockMembers: MockMemberRow[] = [
  {
    id: 1, no: 'M10101', name: '陳小美', mobileMasked: '+886 9•••••112', phoneFull: '+886 912-345-112',
    email: 'may@example.com', address: '台北市信義區松高路 1 號 5 樓', gender: 'female', birthday: '1993-05-09',
    bindings: { facebook: true, line: true, google: false, whatsapp: false, tiktok: false },
    level: 'gold', stars: 5, starNote: '回購穩定、少客訴', spend: 132500, points: 12800,
    orders: 38, completedOrders: 36, bids: 45, abandonedBids: 2, notifLiveEnabled: true,
    createdAt: '2025-11-02T10:15:00Z', lastOrderAt: '2026-07-12T20:10:00Z',
    lastCheckoutAt: '2026-07-12T20:25:00Z', lastOrderCreatedAt: '2026-07-13T09:00:00Z', status: 'normal',
  },
  {
    id: 2, no: 'M10102', name: '林大明', mobileMasked: '+886 9•••••233', phoneFull: '+886 955-123-233',
    email: 'ming@example.com', address: '新北市板橋區文化路二段 20 號', gender: 'male', birthday: '1985-01-30',
    bindings: { facebook: false, line: false, google: true, whatsapp: false, tiktok: false },
    level: 'gold', stars: 4, starNote: '', spend: 87600, points: 8400,
    orders: 24, completedOrders: 20, bids: 30, abandonedBids: 5, notifLiveEnabled: false,
    createdAt: '2025-10-15T09:05:00Z', lastOrderAt: '2026-03-24T14:00:00Z',
    lastCheckoutAt: '2026-03-25T10:20:00Z', lastOrderCreatedAt: '2026-03-25T10:22:00Z', status: 'blacklisted',
  },
  {
    id: 3, no: 'M10103', name: '黃佩珊', mobileMasked: '+886 9•••••566', phoneFull: '+886 966-101-566',
    email: 'pei@example.com', address: '台南市東區長榮路一段 88 號', gender: 'female', birthday: '1987-02-14',
    bindings: { facebook: true, line: true, google: false, whatsapp: false, tiktok: false },
    level: 'gold', stars: 5, starNote: '高消費、常參與直播', spend: 210300, points: 21000,
    orders: 56, completedOrders: 55, bids: 62, abandonedBids: 3, notifLiveEnabled: true,
    createdAt: '2025-08-11T08:00:00Z', lastOrderAt: '2026-07-17T21:45:00Z',
    lastCheckoutAt: '2026-07-18T08:10:00Z', lastOrderCreatedAt: '2026-07-18T08:12:00Z', status: 'normal',
  },
  {
    id: 4, no: 'M10104', name: '王曉華', mobileMasked: '+886 9•••••344', phoneFull: '+886 933-222-344',
    email: 'hua@example.com', address: '台中市西屯區台灣大道三段 100 號', gender: 'female', birthday: '1990-11-11',
    bindings: { facebook: true, line: true, google: true, whatsapp: true, tiktok: false },
    level: 'silver', stars: 3, starNote: '', spend: 29800, points: 3200,
    orders: 9, completedOrders: 8, bids: 12, abandonedBids: 2, notifLiveEnabled: true,
    createdAt: '2026-01-20T14:40:00Z', lastOrderAt: '2026-07-04T11:20:00Z',
    lastCheckoutAt: '2026-07-05T09:30:00Z', lastOrderCreatedAt: '2026-07-05T09:31:00Z', status: 'normal',
  },
  {
    id: 5, no: 'M10105', name: '吳建志', mobileMasked: '+886 9•••••677', phoneFull: '+886 900-456-677',
    email: 'chih@example.com', address: '桃園市中壢區中正路 200 號', gender: 'male', birthday: '1982-09-19',
    bindings: { facebook: false, line: true, google: true, whatsapp: false, tiktok: false },
    level: 'gold', stars: 2, starNote: '曾多次棄標', spend: 94100, points: 9600,
    orders: 27, completedOrders: 22, bids: 40, abandonedBids: 12, notifLiveEnabled: false,
    createdAt: '2025-12-28T16:30:00Z', lastOrderAt: '2026-05-19T10:05:00Z',
    lastCheckoutAt: '2026-05-20T09:00:00Z', lastOrderCreatedAt: '2026-05-20T09:02:00Z', status: 'suspended',
  },
  {
    id: 6, no: 'M10106', name: '張家豪', mobileMasked: '+886 9•••••455', phoneFull: '+886 921-888-455',
    email: '', address: '', gender: 'male', birthday: '1998-07-02',
    bindings: { facebook: false, line: true, google: false, whatsapp: false, tiktok: true },
    level: 'bronze', stars: 2, starNote: '', spend: 5400, points: 600,
    orders: 2, completedOrders: 2, bids: 4, abandonedBids: 1, notifLiveEnabled: true,
    createdAt: '2026-05-30T18:22:00Z', lastOrderAt: '2026-06-09T16:30:00Z',
    lastCheckoutAt: '2026-06-10T12:00:00Z', lastOrderCreatedAt: '2026-06-10T12:01:00Z', status: 'normal',
  },
  {
    id: 7, no: 'M10107', name: '周雅婷', mobileMasked: '+886 9•••••788', phoneFull: '+886 912-777-788',
    email: 'ya@example.com', address: '', gender: 'female', birthday: '2000-03-25',
    bindings: { facebook: true, line: false, google: false, whatsapp: false, tiktok: true },
    level: 'normal', stars: 3, starNote: '', spend: 1200, points: 150,
    orders: 1, completedOrders: 1, bids: 2, abandonedBids: 1, notifLiveEnabled: true,
    createdAt: '2026-06-20T11:11:00Z', lastOrderAt: '2026-07-01T09:30:00Z',
    lastCheckoutAt: '2026-07-02T09:35:00Z', lastOrderCreatedAt: '2026-07-02T09:36:00Z', status: 'normal',
  },
  {
    id: 8, no: 'M10108', name: '黃俊傑', mobileMasked: '+886 9•••••899', phoneFull: '+886 988-333-899',
    email: 'jun@example.com', address: '新竹市東區光復路二段 50 號', gender: 'male', birthday: '1994-12-08',
    bindings: { facebook: true, line: true, google: true, whatsapp: false, tiktok: false },
    level: 'gold', stars: 4, starNote: '', spend: 41700, points: 4500,
    orders: 14, completedOrders: 13, bids: 18, abandonedBids: 2, notifLiveEnabled: true,
    createdAt: '2026-02-15T13:00:00Z', lastOrderAt: '2026-07-08T19:00:00Z',
    lastCheckoutAt: '2026-07-09T10:00:00Z', lastOrderCreatedAt: '2026-07-09T10:03:00Z', status: 'normal',
  },
  {
    id: 9, no: 'M10109', name: '劉宗翰', mobileMasked: '+886 9•••••021', phoneFull: null,
    email: '', address: '', gender: null, birthday: null,
    bindings: { facebook: false, line: false, google: false, whatsapp: false, tiktok: false },
    level: 'normal', stars: 1, starNote: '', spend: 0, points: 0,
    orders: 0, completedOrders: 0, bids: 1, abandonedBids: 0, notifLiveEnabled: false,
    createdAt: '2026-06-08T08:02:00Z', lastOrderAt: null,
    lastCheckoutAt: null, lastOrderCreatedAt: null, status: 'normal',
  },
  {
    id: 10, no: 'M10110', name: '蔡怡君', mobileMasked: '+886 9•••••330', phoneFull: '+886 977-654-330',
    email: 'chun@example.com', address: '高雄市前鎮區中山二路 5 號', gender: 'female', birthday: '1996-06-06',
    bindings: { facebook: true, line: true, google: false, whatsapp: true, tiktok: false },
    level: 'silver', stars: 5, starNote: '', spend: 16400, points: 1800,
    orders: 5, completedOrders: 5, bids: 7, abandonedBids: 1, notifLiveEnabled: true,
    createdAt: '2026-03-05T15:20:00Z', lastOrderAt: '2026-05-29T15:20:00Z',
    lastCheckoutAt: '2026-05-30T11:00:00Z', lastOrderCreatedAt: '2026-05-30T11:02:00Z', status: 'normal',
  },
  {
    id: 11, no: 'M10111', name: '楊志偉', mobileMasked: '+886 9•••••742', phoneFull: '+886 934-111-742',
    email: 'wei@example.com', address: '台北市中山區南京東路二段 100 號', gender: 'male', birthday: '1989-08-21',
    bindings: { facebook: false, line: true, google: false, whatsapp: false, tiktok: false },
    level: 'bronze', stars: 1, starNote: '棄標率偏高', spend: 4200, points: 420,
    orders: 4, completedOrders: 2, bids: 9, abandonedBids: 5, notifLiveEnabled: false,
    createdAt: '2026-04-01T13:10:00Z', lastOrderAt: '2026-04-18T13:10:00Z',
    lastCheckoutAt: '2026-04-19T09:00:00Z', lastOrderCreatedAt: '2026-04-19T09:05:00Z', status: 'suspended',
  },
  {
    id: 12, no: 'M10112', name: '許淑芬', mobileMasked: '+886 9•••••158', phoneFull: '+886 988-777-158',
    email: 'fen@example.com', address: '台中市北區三民路三段 200 號', gender: 'female', birthday: '1991-04-17',
    bindings: { facebook: true, line: true, google: true, whatsapp: false, tiktok: true },
    level: 'gold', stars: 4, starNote: '', spend: 68900, points: 7000,
    orders: 21, completedOrders: 20, bids: 24, abandonedBids: 3, notifLiveEnabled: true,
    createdAt: '2025-09-18T18:40:00Z', lastOrderAt: '2026-06-30T18:40:00Z',
    lastCheckoutAt: '2026-07-01T09:00:00Z', lastOrderCreatedAt: '2026-07-01T09:05:00Z', status: 'normal',
  },
];
