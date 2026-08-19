import { ref } from 'vue';

/**
 * 搜尋類型（左側下拉）
 * — 對應舊 168money saleOrderList 的 searchType 選項
 */
export type BidListSearchType =
  | 'facebookName'
  | 'facebookOrLivebuyId'
  | 'session'
  | 'productName'
  | 'specNote'
  | 'multiCartName'
  | 'bidNumber';

/**
 * 顯示類型（中間下拉）
 * — 對應舊系統 showStatus 1~12
 */
export type BidListDisplayType =
  | 'showAll'
  | 'showIncomplete'
  | 'showCompleted'
  | 'showTransferredToOrder'
  | 'showDiscarded'
  | 'groupBySameBid'
  | 'preorder'
  | 'multiCart'
  | 'addOnRecent';

/**
 * 標單狀態篩選（與快速篩選連動：值映射至 displayType 對應狀態情境）
 */
export type BidListBidStatusFilter =
  | 'unfinished'
  | 'completed'
  | 'transferredToOrder'
  | 'discarded';

/**
 * 時間排序切換
 */
export type BidListTimeSort =
  | 'createTimeDesc'
  | 'createTimeAsc'
  | 'lastUpdateTimeDesc'
  | 'lastUpdateTimeAsc'
  | 'newlyAddedTimeDesc'
  | 'newlyAddedTimeAsc'
  | 'ratingDesc'
  | 'ratingAsc';

/**
 * 直播來源篩選
 */
export type BidListSourceType = 'fb' | 'ig' | 'tiktok' | 'livebuy';

/**
 * 收單方式篩選
 */
export type BidListOrderMethod = 'live' | 'post' | 'community';

/**
 * 推薦碼篩選（LiveBuy 分銷推薦碼）
 */
export type BidListInviteCodeFilter = 'has' | 'none';

/**
 * 商品屬性篩選（可複選，符合任一屬性即列出）
 */
export type BidListProductAttribute = 'preorder' | 'addOn' | 'freeShipping';

/**
 * 常用篩選：記住第二列下拉條件的快照（不含搜尋類型／關鍵字／日期區間）
 */
export interface BidListSavedFilter {
  id: number;
  name: string;
  displayType: BidListDisplayType;
  sourceType: BidListSourceType | null;
  orderMethod: BidListOrderMethod | null;
  inviteCode: BidListInviteCodeFilter | null;
  productAttributes: BidListProductAttribute[];
  session: string[];
}

/**
 * 建立預設日期區間：近 30 天（含今天，迄日為今天）
 */
function createDefaultDateRange(): [Date, Date] {
  const end = new Date();
  end.setHours(0, 0, 0, 0);
  const start = new Date(end);
  start.setDate(start.getDate() - 29);
  return [start, end];
}

/**
 * 得標清單頁面篩選狀態
 */
export function useBidListFilter() {
  /** 搜尋類型 */
  const searchType = ref<BidListSearchType>('facebookName');
  /** 搜尋關鍵字 */
  const keyword = ref<string>('');
  /** 顯示類型 */
  const displayType = ref<BidListDisplayType>('showAll');
  /** 排序（null = 未選取，視同標單建立時間由新到舊） */
  const timeSort = ref<BidListTimeSort | null>(null);
  /** 日期區間 [起, 迄]，預設近 30 天 */
  const dateRange = ref<[Date | null, Date | null] | null>(createDefaultDateRange());
  /** 直播來源篩選（null = 未選取，視同全部） */
  const sourceType = ref<BidListSourceType | null>(null);
  /** 收單方式篩選（null = 未選取，視同不限） */
  const orderMethod = ref<BidListOrderMethod | null>(null);
  /** 推薦碼篩選（null = 未選取，視同不限） */
  const inviteCode = ref<BidListInviteCodeFilter | null>(null);
  /** 商品屬性篩選（空陣列 = 不限） */
  const productAttributes = ref<BidListProductAttribute[]>([]);
  /** 場次篩選（空陣列 = 不限，多選 OR 邏輯） */
  const session = ref<string[]>([]);

  /** 分頁 */
  const page = ref<number>(1);
  const perPage = ref<number>(30);

  /**
   * 重置全部篩選欄位為預設值
   */
  function reset() {
    searchType.value = 'facebookName';
    keyword.value = '';
    displayType.value = 'showAll';
    timeSort.value = null;
    dateRange.value = createDefaultDateRange();
    sourceType.value = null;
    orderMethod.value = null;
    inviteCode.value = null;
    productAttributes.value = [];
    session.value = [];
    page.value = 1;
  }

  return {
    searchType,
    keyword,
    displayType,
    timeSort,
    dateRange,
    sourceType,
    orderMethod,
    inviteCode,
    productAttributes,
    session,
    page,
    perPage,
    reset,
  };
}
