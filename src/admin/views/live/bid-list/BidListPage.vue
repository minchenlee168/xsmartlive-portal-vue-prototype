<script setup lang="ts">
/**
 * 得標清單頁（Bid List）
 * — 對應舊 168money 「直播拍賣得標（購物車明細）」= /backend/Live_Sale/saleOrderList
 * — 綜合收單區 sidebar 下的核心「進行中標單」處理頁
 */
import { computed, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useGlobalToast } from '@/admin/composables/useGlobalToast';
import { useGlobalDialog } from '@/admin/composables/useGlobalDialog';

import HandbookButton from '@/admin/components/handbook-button/HandbookButton.vue';

import BidListFilterBar from './components/BidListFilterBar.vue';
import BidListBatchMenu, {
  type BidListBatchMenuAction,
} from './components/BidListBatchMenu.vue';
import BidListBatchModeBar from './components/BidListBatchModeBar.vue';
import BidListToolbar, { type BidListToolbarAction } from './components/BidListToolbar.vue';
import BidListTable, { type BidListRowAction } from './components/BidListTable.vue';
import BidListGroupedTable, {
  type BidListGroupedAction,
  type BidListGroupedRow,
} from './components/BidListGroupedTable.vue';
import OrderModificationDialog from './components/OrderModificationDialog.vue';
import BidSettingDialog from './components/BidSettingDialog.vue';
import HelperCheckoutDialog from './components/HelperCheckoutDialog.vue';
import ConvertFbidDialog from './components/ConvertFbidDialog.vue';
import PrintBidDialog from './components/PrintBidDialog.vue';
import NotifyCashoutDialog from './components/NotifyCashoutDialog.vue';
import NotifyHistoryDialog from './components/NotifyHistoryDialog.vue';
import ManualBidFormDialog, {
  type ManualBidSubmitPayload,
} from './components/ManualBidFormDialog.vue';
import LiveProductSalesDialog from './components/LiveProductSalesDialog.vue';
import BatchActionDoneDialog from './components/BatchActionDoneDialog.vue';
import PriceHistoryDialog from './components/PriceHistoryDialog.vue';
import EditBidDataDialog from './components/EditBidDataDialog.vue';
import BatchEditProductQuantityDialog from './components/BatchEditProductQuantityDialog.vue';
import PreorderArrivalDialog from './components/PreorderArrivalDialog.vue';
import WinnerProfileDialog from './components/WinnerProfileDialog.vue';

import SaveFilterNameDialog from './components/SaveFilterNameDialog.vue';
import {
  useBidListFilter,
  type BidListBidStatusFilter,
  type BidListDisplayType,
  type BidListInviteCodeFilter,
  type BidListOrderMethod,
  type BidListProductAttribute,
  type BidListSavedFilter,
  type BidListSearchType,
  type BidListSourceType,
} from './composables/useBidListFilter';
import { useBidListMock, type BidListRow, type BidListWinner } from './composables/useBidListMock';
import type { ManualBidPickedMember } from './composables/useManualBidSessionMock';

const { t } = useI18n();
const { confirm } = useGlobalDialog();
const { showSuccess, showInfo } = useGlobalToast();

const {
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
  reset: resetFilter,
} = useBidListFilter();

const { rows, isLoading } = useBidListMock();

/**
 * 已套用的篩選快照。
 * 下方表格一律只依此快照過濾；篩選區各欄位（pending）由使用者編輯 live ref，
 * 按「搜尋」才 commit 進來。快速篩選 chip 例外——點擊即逐欄 commit（即時生效）。
 */
interface AppliedBidListFilter {
  searchType: BidListSearchType;
  keyword: string;
  displayType: BidListDisplayType;
  dateRange: [Date | null, Date | null] | null;
  sourceType: BidListSourceType | null;
  orderMethod: BidListOrderMethod | null;
  inviteCode: BidListInviteCodeFilter | null;
  productAttributes: BidListProductAttribute[];
  session: string[];
}

/** 由目前 pending（live ref）取一份篩選快照 */
function snapshotFilter(): AppliedBidListFilter {
  return {
    searchType: searchType.value,
    keyword: keyword.value,
    displayType: displayType.value,
    dateRange: dateRange.value,
    sourceType: sourceType.value,
    orderMethod: orderMethod.value,
    inviteCode: inviteCode.value,
    productAttributes: [...productAttributes.value],
    session: [...session.value],
  };
}

const appliedFilter = reactive<AppliedBidListFilter>(snapshotFilter());

/** 把目前 pending 條件整份套用到表格（按「搜尋」、清除、套用常用篩選時呼叫） */
function commitFilter(): void {
  Object.assign(appliedFilter, snapshotFilter());
  page.value = 1;
}

/** 場次下拉選項：由假資料匯總不重複的 sessionName */
const sessionOptions = computed(() => {
  const set = new Set(rows.value.map((row) => row.sessionName));
  return [...set].map((name) => ({ label: name, value: name }));
});

/** 多購物車名稱下拉選項：由假資料匯總不重複、非空的 multiCartName（搜尋類型選「多購物車名稱」時使用） */
const multiCartNameOptions = computed(() => {
  const set = new Set(
    rows.value.map((row) => row.multiCartName).filter((name): name is string => !!name),
  );
  return [...set].map((name) => ({ label: name, value: name }));
});

/** 是否為「預購」顯示模式（工具列多顯示預購到貨、表格用預購行為） */
const isPreorderMode = computed(() => appliedFilter.displayType === 'preorder');

/** 快速篩選：來源 chip（與「標單來源」下拉雙向連動；label 沿用下拉選項文字） */
const quickSourceChips: Array<{ value: BidListSourceType; labelKey: string }> = [
  { value: 'fb', labelKey: 'bid_list.filter.source_type.fb' },
  { value: 'ig', labelKey: 'bid_list.filter.source_type.ig' },
  { value: 'tiktok', labelKey: 'bid_list.filter.source_type.tiktok' },
  { value: 'livebuy', labelKey: 'bid_list.filter.source_type.livebuy' },
];

/** 快速篩選：狀態 chip（displayType 快捷切換，與「標單狀態」下拉雙向連動） */
const quickStatusChips: Array<{ value: BidListDisplayType; labelKey: string }> = [
  { value: 'showIncomplete', labelKey: 'bid_list.quick_filter.show_incomplete' },
  { value: 'showCompleted', labelKey: 'bid_list.quick_filter.show_completed' },
  { value: 'showTransferredToOrder', labelKey: 'bid_list.quick_filter.show_transferred_to_order' },
  { value: 'showDiscarded', labelKey: 'bid_list.quick_filter.show_discarded' },
];

function quickFilterChipClass(isActive: boolean): string {
  return [
    'px-3 py-1.5 rounded-full border text-sm transition-colors',
    isActive
      ? 'border-primary-500 bg-primary-50 text-primary-600 dark:border-primary-400 dark:bg-primary-950 dark:text-primary-300'
      : 'border-surface-300 text-surface-600 hover:bg-surface-100 dark:border-surface-600 dark:text-surface-300 dark:hover:bg-surface-800',
  ].join(' ');
}

/** 點快速篩選狀態 chip：已選中再點一次 = 取消回「全部」；即時套用（不需按搜尋） */
function toggleQuickFilter(value: BidListDisplayType): void {
  displayType.value = displayType.value === value ? 'showAll' : value;
  appliedFilter.displayType = displayType.value;
  page.value = 1;
}

/** 點快速篩選來源 chip：已選中再點一次 = 取消（回未選取，視同全部來源）；即時套用 */
function toggleQuickSource(value: BidListSourceType): void {
  sourceType.value = sourceType.value === value ? null : value;
  appliedFilter.sourceType = sourceType.value;
  page.value = 1;
}

/** 標單狀態 ↔ displayType 對應表（與快速篩選共用同一狀態，天然雙向連動） */
const bidStatusDisplayTypeMap: Record<BidListBidStatusFilter, BidListDisplayType> = {
  unfinished: 'showIncomplete',
  completed: 'showCompleted',
  transferredToOrder: 'showTransferredToOrder',
  discarded: 'showDiscarded',
};

/** 標單狀態下拉（null = 未選取）；寫入即切換 displayType，快速篩選會同步亮起 */
const bidStatus = computed<BidListBidStatusFilter | null>({
  get: () => {
    const matched = (
      Object.entries(bidStatusDisplayTypeMap) as Array<[BidListBidStatusFilter, BidListDisplayType]>
    ).find(([, display]) => display === displayType.value);
    return matched ? matched[0] : null;
  },
  set: (value) => {
    displayType.value = value ? bidStatusDisplayTypeMap[value] : 'showAll';
  },
});

/**
 * 「加購商品（一週內）」的基準日：mock 資料裡最新的 createTime
 * — 接真 API 時改用 `new Date()`
 */
const ADD_ON_RECENT_ANCHOR_DATE = '2026-07-14 09:35:03';
const ADD_ON_RECENT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

function isWithinAddOnWindow(createTime: string): boolean {
  const anchor = new Date(ADD_ON_RECENT_ANCHOR_DATE).getTime();
  const target = new Date(createTime).getTime();
  return anchor - target <= ADD_ON_RECENT_WINDOW_MS && anchor - target >= 0;
}

/** 依 displayType 過濾 + 依 timeSort 排序 + 依搜尋條件過濾（keyword/dateRange/sourceType） */
const displayedRows = computed(() => {
  let list = rows.value;

  // 來源篩選（依已套用快照）
  if (appliedFilter.sourceType === 'fb') {
    list = list.filter((row) => row.platform === 'facebook');
  } else if (appliedFilter.sourceType === 'ig') {
    list = list.filter((row) => row.platform === 'instagram');
  } else if (appliedFilter.sourceType === 'tiktok') {
    list = list.filter((row) => row.platform === 'tiktok');
  } else if (appliedFilter.sourceType === 'livebuy') {
    list = list.filter((row) => row.platform === 'livebuy');
  }

  // 收單方式篩選；null = 未選取不過濾
  if (appliedFilter.orderMethod) {
    const method = appliedFilter.orderMethod;
    list = list.filter((row) => row.orderMethod === method);
  }

  // 推薦碼篩選；null／不限 不過濾
  if (appliedFilter.inviteCode === 'has') {
    list = list.filter((row) => row.hasLivebuyInvite === true);
  } else if (appliedFilter.inviteCode === 'none') {
    list = list.filter((row) => row.hasLivebuyInvite !== true);
  }

  // 商品屬性篩選；可複選，符合任一屬性即列出
  const attributes = appliedFilter.productAttributes;
  if (attributes.length > 0) {
    list = list.filter((row) =>
      attributes.some((attribute) => {
        switch (attribute) {
          case 'preorder':
            return isPreorderRow(row);
          case 'addOn':
            return row.isAddOn === true;
          case 'freeShipping':
            return row.hasSingleItemFreeShipping === true;
        }
        return false;
      }),
    );
  }

  // 場次多選篩選；空陣列 = 不限，OR 邏輯（符合任一勾選場次即列出）
  const sessionValues = appliedFilter.session;
  if (sessionValues.length > 0) {
    const sessionSet = new Set(sessionValues);
    list = list.filter((row) => sessionSet.has(row.sessionName));
  }

  // 日期區間篩選；兩端都有值才套用
  const range = appliedFilter.dateRange;
  if (range && range[0] && range[1]) {
    const startMs = new Date(range[0]).setHours(0, 0, 0, 0);
    const endMs = new Date(range[1]).setHours(23, 59, 59, 999);
    list = list.filter((row) => {
      const rowMs = new Date(row.createTime).getTime();
      return rowMs >= startMs && rowMs <= endMs;
    });
  }

  // 關鍵字搜尋（依已套用快照）
  const keywordValue = appliedFilter.keyword.trim();
  if (keywordValue) {
    const lowerKeyword = keywordValue.toLowerCase();
    list = list.filter((row) => {
      switch (appliedFilter.searchType) {
        case 'facebookName':
          return row.winner.name.toLowerCase().includes(lowerKeyword);
        case 'facebookOrLivebuyId':
          return row.winner.facebookId.toLowerCase().includes(lowerKeyword);
        case 'session':
          return row.sessionName.toLowerCase().includes(lowerKeyword);
        case 'productName':
          return row.productName.toLowerCase().includes(lowerKeyword);
        case 'specNote':
          return (row.specNote ?? '').toLowerCase().includes(lowerKeyword);
        case 'multiCartName':
          return (row.multiCartName ?? '').toLowerCase().includes(lowerKeyword);
        case 'bidNumber':
          return row.bidNumber.toLowerCase().includes(lowerKeyword);
        default:
          return true;
      }
    });
  }

  switch (appliedFilter.displayType) {
    case 'showIncomplete':
      list = list.filter((row) => row.status === 'unfinished');
      break;
    case 'showCompleted':
      list = list.filter(
        (row) => row.status === 'transferredToOrder' || row.status === 'transferredToComplete',
      );
      break;
    case 'showTransferredToOrder':
      list = list.filter((row) => row.status === 'transferredToOrder');
      break;
    case 'showDiscarded':
      list = list.filter((row) => row.status === 'discarded');
      break;
    case 'preorder':
      list = list.filter((row) => row.bidOriginType === 'preorder');
      break;
    case 'multiCart':
      list = list.filter(
        (row) => row.bidOriginType === 'multiCart' && row.status !== 'discarded',
      );
      break;
    case 'addOnRecent':
      list = list.filter(
        (row) => row.isAddOn === true && isWithinAddOnWindow(row.createTime),
      );
      break;
  }
  const sorted = [...list];
  sorted.sort((a, b) => {
    switch (timeSort.value) {
      case 'lastUpdateTimeDesc':
        return a.updateTime < b.updateTime ? 1 : a.updateTime > b.updateTime ? -1 : 0;
      case 'lastUpdateTimeAsc':
        return a.updateTime > b.updateTime ? 1 : a.updateTime < b.updateTime ? -1 : 0;
      case 'newlyAddedTimeDesc':
        return a.productCardCreateTime < b.productCardCreateTime
          ? 1
          : a.productCardCreateTime > b.productCardCreateTime
            ? -1
            : 0;
      case 'newlyAddedTimeAsc':
        return a.productCardCreateTime > b.productCardCreateTime
          ? 1
          : a.productCardCreateTime < b.productCardCreateTime
            ? -1
            : 0;
      case 'ratingDesc':
        return b.rating - a.rating;
      case 'ratingAsc':
        return a.rating - b.rating;
      case 'createTimeAsc':
        return a.createTime > b.createTime ? 1 : a.createTime < b.createTime ? -1 : 0;
      case 'createTimeDesc':
      default:
        return a.createTime < b.createTime ? 1 : a.createTime > b.createTime ? -1 : 0;
    }
  });
  return sorted;
});

/** 是否切到「以同一標方式顯示」群組視圖 */
const isGroupedView = computed(() => appliedFilter.displayType === 'groupBySameBid');

/**
 * 群組列：把 rows 依 (sessionName + productName) 分組聚合
 * — 建立時間取群組內最早
 * — 商品圖取第一筆有值
 * — 標單數量 = 群組筆數
 */
const groupedRows = computed<BidListGroupedRow[]>(() => {
  const groups = new Map<string, BidListGroupedRow>();
  for (const row of rows.value) {
    const key = `${row.sessionName}::${row.productName}`;
    const existing = groups.get(key);
    if (existing) {
      existing.bidCount += 1;
      if (row.createTime < existing.createTime) {
        existing.createTime = row.createTime;
      }
      if (!existing.productImage && row.productImage) {
        existing.productImage = row.productImage;
      }
      if (!existing.specNote && row.specNote) {
        existing.specNote = row.specNote;
      }
      if (!existing.bundleItems?.length && row.bundleItems?.length) {
        existing.bundleItems = row.bundleItems;
      }
    } else {
      groups.set(key, {
        key,
        createTime: row.createTime,
        sessionName: row.sessionName,
        productName: row.productName,
        productImage: row.productImage,
        specNote: row.specNote,
        bundleItems: row.bundleItems,
        bidCount: 1,
      });
    }
  }
  return Array.from(groups.values()).sort((a, b) => (a.createTime < b.createTime ? 1 : -1));
});

/** 過濾後總筆數（給分頁用） */
const totalRecords = computed(() =>
  isGroupedView.value ? groupedRows.value.length : displayedRows.value.length,
);

/** 已套用的顯示類型切換時，分頁回到第一頁、清空勾選 */
watch(
  () => appliedFilter.displayType,
  () => {
    page.value = 1;
    selectedIds.value = new Set();
  },
);

/** 該列屬性是否為預購單 */
function isPreorderRow(row: BidListRow): boolean {
  return row.isPreorder === true || row.bidOriginType === 'preorder';
}

/** 勾選清單 */
const selectedIds = ref<Set<string>>(new Set());

/** 目前勾選對應的 row 明細（供幫客戶轉訂單 dialog 顯示商品資訊） */
const selectedRowList = computed<BidListRow[]>(() =>
  rows.value.filter((row) => selectedIds.value.has(row.id)),
);

/** 批次模式（null = 未進入）；批次作業選單點動作後進入，勾選框僅在模式中顯示 */
type BidListBatchMode = BidListBatchMenuAction | 'batchRating';
const batchMode = ref<BidListBatchMode | null>(null);
/** 批次更新星等模式所選星數 */
const batchRatingValue = ref(0);
const isBatchMode = computed(() => batchMode.value !== null);

const batchModeI18nKeyMap: Record<BidListBatchMode, string> = {
  batchTransferComplete: 'batch_transfer_complete',
  batchPreorderArrival: 'batch_preorder_arrival',
  notifyCashout: 'notify_cashout',
  batchRating: 'batch_rating',
  helperTransferOrder: 'helper_transfer_order',
  printBid: 'print_bid',
  orderModification: 'order_modification',
  batchDiscard: 'batch_discard',
};

const batchModeTitle = computed(() => {
  if (!batchMode.value) return '';
  if (batchMode.value === 'batchRating') {
    return t('bid_list.batch_mode.title.batch_rating', { rating: batchRatingValue.value });
  }
  return t(`bid_list.batch_mode.title.${batchModeI18nKeyMap[batchMode.value]}`);
});

const batchModeNextLabel = computed(() =>
  batchMode.value ? t(`bid_list.batch_mode.next.${batchModeI18nKeyMap[batchMode.value]}`) : '',
);

/** 目前批次模式下可勾選的列：批次轉完成單＝未完成且非預購屬性；批次預購到貨＝僅預購屬性；一鍵催單／轉預購標單＝未完成；其他＝全部 */
const batchSelectableRows = computed<BidListRow[]>(() => {
  switch (batchMode.value) {
    case 'batchTransferComplete':
      return displayedRows.value.filter(
        (row) => row.status === 'unfinished' && !isPreorderRow(row),
      );
    case 'batchPreorderArrival':
      return displayedRows.value.filter((row) => isPreorderRow(row));
    case 'notifyCashout':
      return displayedRows.value.filter((row) => row.status === 'unfinished');
    case 'orderModification':
      return displayedRows.value.filter((row) => row.status === 'unfinished');
    default:
      return displayedRows.value;
  }
});

/** 傳給表格的可勾選列 id 集合（無限制的模式回 null） */
const batchSelectableIds = computed<Set<string> | null>(() =>
  batchMode.value === 'batchTransferComplete' ||
  batchMode.value === 'batchPreorderArrival' ||
  batchMode.value === 'notifyCashout' ||
  batchMode.value === 'orderModification'
    ? new Set(batchSelectableRows.value.map((row) => row.id))
    : null,
);

/** 開啟空白手動下標單視窗：不帶商品、不帶會員、不看勾選（一律空白，讓使用者在表單內選） */
function openBlankManualBid() {
  quickBidWinners.value = [];
  quickBidProduct.value = null;
  manualBidDialogTitle.value = t('bid_list.manual_form.title_blank');
  isManualBidFormOpen.value = true;
}

/** 批次操作需可勾選的平面表；若正在群組檢視（以同一標）則先切回平面，避免批次列無框可勾 */
function ensureFlatViewForBatch(): void {
  if (appliedFilter.displayType === 'groupBySameBid') {
    displayType.value = 'showAll';
    appliedFilter.displayType = 'showAll';
  }
}

function enterBatchMode(action: BidListBatchMenuAction) {
  ensureFlatViewForBatch();
  batchMode.value = action;
  selectedIds.value = new Set();
}

function enterBatchRatingMode(value: number) {
  ensureFlatViewForBatch();
  batchRatingValue.value = value;
  batchMode.value = 'batchRating';
  selectedIds.value = new Set();
}

function exitBatchMode() {
  batchMode.value = null;
  batchRatingValue.value = 0;
  selectedIds.value = new Set();
}

function handleBatchSelectAll() {
  selectedIds.value = new Set(batchSelectableRows.value.map((row: BidListRow) => row.id));
}

/** 批次模式「下一步」：開啟原本設計的確認視窗／dialog；確認取消則停留在模式中 */
async function handleBatchNextStep() {
  switch (batchMode.value) {
    case 'batchTransferComplete': {
      const accepted = await confirm({
        message: t('bid_list.dialog.confirm_batch_transfer_complete', {
          count: selectedIds.value.size,
        }),
      });
      if (accepted) {
        isBatchDoneOpen.value = true;
        exitBatchMode();
      }
      break;
    }
    case 'batchDiscard': {
      const accepted = await confirm({
        message: t('bid_list.dialog.confirm_batch_discard', {
          count: selectedIds.value.size,
        }),
      });
      if (accepted) {
        isBatchDoneOpen.value = true;
        exitBatchMode();
      }
      break;
    }
    case 'batchRating': {
      const value = batchRatingValue.value;
      for (const row of rows.value) {
        if (selectedIds.value.has(row.id)) {
          row.rating = value;
        }
      }
      showSuccess({
        detail: t('bid_list.toast.rating_updated', {
          count: selectedIds.value.size,
          rating: value,
        }),
      });
      exitBatchMode();
      break;
    }
    case 'helperTransferOrder': {
      const uniqueBuyerCount = new Set(
        selectedRowList.value.map((row) => row.winner.facebookId),
      ).size;
      if (uniqueBuyerCount > 1) {
        const accepted = await confirm({
          message: t('bid_list.dialog.confirm_open_multi_buyer', {
            count: uniqueBuyerCount,
          }),
        });
        if (!accepted) return;
      }
      helperCheckoutRows.value = selectedRowList.value;
      isHelperCheckoutOpen.value = true;
      break;
    }
    case 'printBid':
      isPrintBidOpen.value = true;
      break;
    case 'batchPreorderArrival':
      preorderArrivalRows.value = selectedRowList.value;
      isPreorderArrivalOpen.value = true;
      break;
    case 'notifyCashout':
      notifyCashoutRows.value = selectedRowList.value;
      isNotifyCashoutOpen.value = true;
      break;
    case 'orderModification':
      orderModificationRows.value = selectedRowList.value;
      isOrderModificationOpen.value = true;
      break;
  }
}

/** Dialog 顯示狀態 */
const isHelperCheckoutOpen = ref(false);
/** 幫客戶轉訂單視窗資料來源：批次模式帶勾選列、列操作「轉訂單」帶單一列 */
const helperCheckoutRows = ref<BidListRow[]>([]);
const isOrderModificationOpen = ref(false);
/** 標單設定 dialog 開關 */
const isBidSettingOpen = ref(false);

/** 常用篩選（mockup：本 session 保存；記第二列下拉條件，不含關鍵字／日期） */
const savedFilters = ref<BidListSavedFilter[]>([]);
const isSaveFilterOpen = ref(false);
let savedFilterSeq = 0;

const productAttributeLabelKeyMap: Record<BidListProductAttribute, string> = {
  preorder: 'preorder',
  addOn: 'add_on',
  freeShipping: 'free_shipping',
};

const groupDisplayTypeLabelKeyMap: Partial<Record<BidListDisplayType, string>> = {
  groupBySameBid: 'group_by_same_bid',
  multiCart: 'multi_cart',
};

/** 儲存常用篩選的預設名稱：已選下拉選項文字以「-」連接（依第二列欄位順序，截 20 字） */
const defaultSavedFilterName = computed(() => {
  const parts: string[] = [];
  if (orderMethod.value) parts.push(t(`bid_list.filter.order_method.${orderMethod.value}`));
  if (sourceType.value) parts.push(t(`bid_list.filter.source_type.${sourceType.value}`));
  if (bidStatus.value) parts.push(t(`bid_list.filter.bid_status.${bidStatus.value}`));
  for (const attribute of productAttributes.value) {
    parts.push(t(`bid_list.filter.product_attributes.${productAttributeLabelKeyMap[attribute]}`));
  }
  if (inviteCode.value) parts.push(t(`bid_list.filter.invite_code.${inviteCode.value}`));
  const groupLabelKey = groupDisplayTypeLabelKeyMap[displayType.value];
  if (groupLabelKey) parts.push(t(`bid_list.filter.display_type.${groupLabelKey}`));
  return parts.join('-').slice(0, 20);
});

/** 儲存常用篩選：同名視為覆蓋既有條件快照 */
function handleSaveFilter(name: string) {
  const snapshot = {
    displayType: displayType.value,
    sourceType: sourceType.value,
    orderMethod: orderMethod.value,
    inviteCode: inviteCode.value,
    productAttributes: [...productAttributes.value],
    session: [...session.value],
  };
  const existing = savedFilters.value.find((item) => item.name === name);
  if (existing) {
    Object.assign(existing, snapshot);
    showSuccess({ detail: t('bid_list.saved_filter.toast.updated', { name }) });
    return;
  }
  savedFilterSeq += 1;
  savedFilters.value.push({ id: savedFilterSeq, name, ...snapshot });
  showSuccess({ detail: t('bid_list.saved_filter.toast.saved') });
}

/** 套用常用篩選：還原下拉條件並即時套用；保留關鍵字與日期區間現值 */
function handleApplySavedFilter(id: number) {
  const savedFilter = savedFilters.value.find((item) => item.id === id);
  if (!savedFilter) return;
  displayType.value = savedFilter.displayType;
  sourceType.value = savedFilter.sourceType;
  orderMethod.value = savedFilter.orderMethod;
  inviteCode.value = savedFilter.inviteCode;
  productAttributes.value = [...savedFilter.productAttributes];
  session.value = [...savedFilter.session];
  commitFilter();
  showSuccess({ detail: t('bid_list.saved_filter.toast.applied', { name: savedFilter.name }) });
}

async function handleRemoveSavedFilter(id: number) {
  const savedFilter = savedFilters.value.find((item) => item.id === id);
  if (!savedFilter) return;
  const accepted = await confirm({
    message: t('bid_list.saved_filter.dialog_confirm_remove', { name: savedFilter.name }),
  });
  if (!accepted) return;
  savedFilters.value = savedFilters.value.filter((item) => item.id !== id);
  showSuccess({ detail: t('bid_list.saved_filter.toast.removed') });
}
const isConvertFbidOpen = ref(false);
const convertFbidRow = ref<BidListRow | null>(null);
const isPrintBidOpen = ref(false);
const isNotifyCashoutOpen = ref(false);
/** 批次通知視窗的來源列（由批次模式帶入） */
const notifyCashoutRows = ref<BidListRow[]>([]);
/** 批次轉預購標單視窗的來源列（由批次模式帶入） */
const orderModificationRows = ref<BidListRow[]>([]);
const isNotifyHistoryOpen = ref(false);
/**
 * 通知紀錄視窗要顯示的標單 id：
 * - 有值：由單筆列的通知視窗開啟，僅顯示該筆標單的通知紀錄
 * - null：由批次通知視窗開啟，顯示場次別彙總
 */
const notifyHistoryBidId = ref<string | null>(null);

/** 通知視窗打開通知紀錄：依 payload 決定要顯示單筆 / 場次別 */
function handleOpenNotifyHistory(payload: { isSingle: boolean; bidId: string | null }) {
  notifyHistoryBidId.value = payload.isSingle ? payload.bidId : null;
  isNotifyHistoryOpen.value = true;
}
const isManualBidFormOpen = ref(false);
/** 當次 dialog 標題（依觸發按鈕不同顯示不同標題） */
const manualBidDialogTitle = ref<string>('');
/** 由列內「新增手動標單」或勾選帶入的訂購人，僅本次 dialog 使用 */
const quickBidWinners = ref<ManualBidPickedMember[]>([]);
/** 列內快捷帶入的商品資訊（同 quickBidWinners 一起生效） */
interface QuickBidProduct {
  name: string;
  image: string;
  unitPrice: number;
}
const quickBidProduct = ref<QuickBidProduct | null>(null);

watch(isManualBidFormOpen, (value) => {
  if (!value) {
    quickBidWinners.value = [];
    quickBidProduct.value = null;
  }
});

const isLiveProductSalesOpen = ref(false);
const isBatchDoneOpen = ref(false);
const isImagePreviewOpen = ref(false);
const previewImageSrc = ref('');
const isPriceHistoryOpen = ref(false);
/** 由「表格金額」點入時鎖定的商品 ID；由頁面標題列按鈕開啟時為 null（一般搜尋模式） */
const priceHistoryProductId = ref<string | null>(null);
/** 由「表格金額」點入時預帶的場次名稱 */
const priceHistorySessionName = ref<string | null>(null);
/** 由「表格金額」點入時預帶的收單方式（community 對應 group） */
const priceHistoryOrderMethod = ref<'live' | 'post' | 'group' | null>(null);
/** 由「表格金額」點入時預帶的收單來源（facebook/instagram 分別對應 fb/ig；line 無對應則不預帶） */
const priceHistorySource = ref<'fb' | 'ig' | 'tiktok' | 'livebuy' | null>(null);

/** 匯出設定視窗（點「匯出」開啟，於視窗內確認後才開始匯出） */
const isExportSettingOpen = ref(false);
/** 匯出選項（mock，僅前端狀態；含照片＝商品截圖與會員大頭照皆納入） */
const exportSettings = ref({
  isAddonSeparated: false,
  hasPhotos: true,
  isSortedByCustomer: false,
  sortDirection: 'newest' as 'newest' | 'oldest',
});
/** 日期區間起訖皆有值時才可匯出 */
const canExport = computed(() => Boolean(dateRange.value?.[0] && dateRange.value?.[1]));

/** 匯出（mock）：關閉設定視窗並顯示開始匯出 toast */
function handleExport() {
  isExportSettingOpen.value = false;
  showSuccess({ detail: t('bid_list.export.toast.started') });
}
const isEditBidOpen = ref(false);
const editBidRow = ref<BidListRow | null>(null);
const isBatchEditQtyOpen = ref(false);
const batchEditQtySessionName = ref<string>('');
const isPreorderArrivalOpen = ref(false);
/** 預購到貨（結單）作用的列：單筆帶入該列、批次帶入已選列 */
const preorderArrivalRows = ref<BidListRow[]>([]);
const isWinnerProfileOpen = ref(false);
const winnerProfileTarget = ref<BidListWinner | null>(null);
const winnerProfilePlatform = ref<BidListRow['platform'] | null>(null);

/** 幫客戶轉訂單／列印標單 dialog 關閉後退出批次模式（勾選需保留到 dialog 使用完） */
watch(isHelperCheckoutOpen, (isOpen) => {
  if (!isOpen && batchMode.value === 'helperTransferOrder') exitBatchMode();
});
watch(isPrintBidOpen, (isOpen) => {
  if (!isOpen && batchMode.value === 'printBid') exitBatchMode();
});
watch(isPreorderArrivalOpen, (isOpen) => {
  if (!isOpen && batchMode.value === 'batchPreorderArrival') exitBatchMode();
});

function handleShowWinnerProfile(row: BidListRow) {
  winnerProfileTarget.value = row.winner;
  winnerProfilePlatform.value = row.platform;
  isWinnerProfileOpen.value = true;
}

function handleReset() {
  resetFilter();
  commitFilter();
  showInfo({ detail: t('bid_list.toast.reset_done') });
}

function handleToolbarAction(action: BidListToolbarAction) {
  switch (action) {
    case 'liveProductSales':
      isLiveProductSalesOpen.value = true;
      break;
    case 'preorderArrival': {
      if (selectedIds.value.size === 0) {
        showInfo({ detail: t('bid_list.toast.select_first') });
        return;
      }
      preorderArrivalRows.value = selectedRowList.value;
      isPreorderArrivalOpen.value = true;
      break;
    }
  }
}

/**
 * 將列的 platform 對應到歷史價格查詢頁的收單來源選項；
 * 對不到（如 line）時回傳 null，讓 dialog 不預帶。
 *
 * @param platform 列的平台
 * @returns 對應的 BidSource；無對應時為 null
 */
function mapPlatformToPriceHistorySource(
  platform: BidListRow['platform'],
): 'fb' | 'ig' | 'tiktok' | 'livebuy' | null {
  switch (platform) {
    case 'facebook':
      return 'fb';
    case 'instagram':
      return 'ig';
    case 'tiktok':
      return 'tiktok';
    case 'livebuy':
      return 'livebuy';
    default:
      return null;
  }
}

async function handleRowAction(action: BidListRowAction, row: BidListRow) {
  switch (action) {
    case 'transferComplete': {
      const accepted = await confirm({
        message: t('bid_list.dialog.confirm_transfer_complete_single'),
      });
      if (accepted) {
        showSuccess({ detail: t('bid_list.toast.transfer_complete_done') });
      }
      break;
    }
    case 'transferOrder': {
      helperCheckoutRows.value = [row];
      isHelperCheckoutOpen.value = true;
      break;
    }
    case 'convertFbid': {
      convertFbidRow.value = row;
      isConvertFbidOpen.value = true;
      break;
    }
    case 'discard': {
      const accepted = await confirm({
        message: t('bid_list.dialog.confirm_discard_single'),
      });
      if (accepted) {
        showSuccess({ detail: t('bid_list.toast.discard_done') });
      }
      break;
    }
    case 'restoreFromDiscard': {
      const accepted = await confirm({
        message: t('bid_list.dialog.confirm_restore'),
      });
      if (accepted) {
        showSuccess({ detail: t('bid_list.toast.restore_done') });
      }
      break;
    }
    case 'printBid':
      isPrintBidOpen.value = true;
      break;
    case 'editData':
      editBidRow.value = row;
      isEditBidOpen.value = true;
      break;
    case 'notifyBidWin':
      notifyCashoutRows.value = [row];
      isNotifyCashoutOpen.value = true;
      break;
    case 'toggleFreeShipping':
      row.hasSingleItemFreeShipping = !row.hasSingleItemFreeShipping;
      showSuccess({
        detail: row.hasSingleItemFreeShipping
          ? t('bid_list.toast.free_shipping_added')
          : t('bid_list.toast.free_shipping_removed'),
      });
      break;
    case 'preorderArrival': {
      preorderArrivalRows.value = [row];
      isPreorderArrivalOpen.value = true;
      break;
    }
    case 'createManualBid': {
      // 只帶入該列的商品資訊，得標人空白（勾選框僅批次模式顯示，不再帶入勾選會員）
      quickBidWinners.value = [];
      quickBidProduct.value = {
        name: row.productName,
        image: row.productImage,
        unitPrice: row.quantity > 0 ? Math.round(row.totalAmount / row.quantity) : row.totalAmount,
      };
      manualBidDialogTitle.value = t('bid_list.manual_form.title_manual');
      isManualBidFormOpen.value = true;
      break;
    }
    case 'openPriceHistoryByProduct': {
      priceHistoryProductId.value = row.productId;
      priceHistorySessionName.value = row.sessionName || null;
      priceHistoryOrderMethod.value =
        row.orderMethod === 'community' ? 'group' : row.orderMethod;
      priceHistorySource.value = mapPlatformToPriceHistorySource(row.platform);
      isPriceHistoryOpen.value = true;
      break;
    }
  }
}

/** 編輯資料 dialog 儲存（mock）：顯示成功 toast */
function handleEditBidSave() {
  showSuccess({ detail: t('bid_list.toast.edit_data_saved') });
}

/** 編輯資料 dialog 批次修改（mock）：範圍確認已於 dialog 內完成，這裡顯示成功 toast */
function handleEditBidBatchSave() {
  showSuccess({ detail: t('bid_list.toast.edit_data_batch_saved') });
}

/** 編輯資料 dialog「手動下標單」：沿用列內快捷的空白標單流程 */
function handleEditBidManualBid() {
  if (!editBidRow.value) return;
  void handleRowAction('createManualBid', editBidRow.value);
}

/**
 * 預購到貨 dialog 送出：依照 168money 行為，成功後顯示對應 toast。
 * — 有勾 + 有值：toast 提示已附加至場次
 * — 沒勾 + 沒值：toast 提示未附加任何資訊
 */
function handlePreorderArrivalConfirm(payload: { extraInfo: string; appendToSessionName: boolean }) {
  // 預購到貨（結單）：清除預購屬性 → 該列變回一般「未完成」列（可轉完成單／轉訂單、不再顯示預購單 tag 與預購到貨）
  preorderArrivalRows.value.forEach((row) => {
    row.isPreorder = false;
    if (row.bidOriginType === 'preorder') {
      row.bidOriginType = 'facebookPage';
    }
    if (payload.appendToSessionName && payload.extraInfo) {
      row.sessionName = `${row.sessionName} ${payload.extraInfo}`;
    }
  });
  if (payload.appendToSessionName && payload.extraInfo) {
    showSuccess({
      detail: t('bid_list.toast.preorder_arrival_done_with_info', { info: payload.extraInfo }),
    });
  } else {
    showSuccess({ detail: t('bid_list.toast.preorder_arrival_done') });
  }
  preorderArrivalRows.value = [];
}

/**
 * 將 0 顯示為「未評」，其餘顯示為「N 星」，供確認視窗訊息使用。
 *
 * @param value 星等值（0~5）
 * @returns i18n 後的顯示文字
 */
function formatRatingLabel(value: number): string {
  return value === 0
    ? t('bid_list.rating.unrated')
    : t('bid_list.rating.stars', { n: value });
}

/**
 * 單筆評星異動：跳確認視窗，確認後才寫入 row.rating；
 * 目標值與目前相同時視為無異動、直接略過。
 *
 * @param row 該筆標單
 * @param value 使用者點下的目標星等（0~5）
 */
async function handleRowRatingChange(row: BidListRow, value: number) {
  if (value === row.rating) {
    return;
  }
  const accepted = await confirm({
    message: t('bid_list.dialog.row_rating_change_confirm', {
      name: row.winner.name || t('bid_list.table.cell.no_name'),
      id: row.winner.facebookId,
      from: formatRatingLabel(row.rating),
      to: formatRatingLabel(value),
    }),
  });
  if (!accepted) {
    return;
  }
  row.rating = value;
  showSuccess({ detail: t('bid_list.toast.row_rating_updated', { rating: value }) });
}

function handleGroupedRowAction(action: BidListGroupedAction, row: BidListGroupedRow) {
  switch (action) {
    case 'batchEdit':
      batchEditQtySessionName.value = row.sessionName;
      isBatchEditQtyOpen.value = true;
      break;
    case 'batchUpdate':
      showInfo({
        detail: t('bid_list.toast.grouped_batch_update_placeholder', {
          product: row.productName,
          session: row.sessionName,
        }),
      });
      break;
  }
}

function handlePreviewImage(src: string) {
  previewImageSrc.value = src;
  isImagePreviewOpen.value = true;
}

/** 批次轉預購標單送出：關窗、清空來源列、退出批次模式（成功 toast 由 dialog 自行顯示） */
function handleOrderModificationSubmit() {
  isOrderModificationOpen.value = false;
  orderModificationRows.value = [];
  if (batchMode.value === 'orderModification') {
    exitBatchMode();
  }
}

/** 批次通知送出：依通知類型顯示對應 toast、關窗、退出批次模式 */
function handleNotifyCashoutSend(payload: { notifyType: 'bid_win' | 'urge' }) {
  const count = notifyCashoutRows.value.length || selectedIds.value.size;
  const toastKey =
    payload.notifyType === 'bid_win'
      ? 'bid_list.notify_cashout.toast.sent_bid_win'
      : 'bid_list.notify_cashout.toast.sent';
  showSuccess({ detail: t(toastKey, { count }) });
  isNotifyCashoutOpen.value = false;
  notifyCashoutRows.value = [];
  if (batchMode.value === 'notifyCashout') {
    exitBatchMode();
  }
}

/**
 * 手動下標表單送出：為每位得標人建一筆 BidListRow，放在清單最上方
 */
function handleManualBidSubmit(payload: ManualBidSubmitPayload) {
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const timestamp = Date.now();
  for (const [index, winner] of payload.winners.entries()) {
    const newRow: BidListRow = {
      id: `manual-${timestamp}-${index}`,
      createTime: now,
      updateTime: now,
      productCardCreateTime: now,
      sessionName: payload.sessionName,
      productImage: payload.productImage,
      multiCartName: payload.multiCartName,
      productId: `MANUAL-${timestamp}`,
      productName: payload.productName,
      isAddOn: false,
      isPreorder: payload.cartType === 'preorder',
      hasSingleItemFreeShipping: false,
      bidOriginType: payload.bidOriginType,
      bidNumber: `M${timestamp}${index.toString().padStart(2, '0')}`,
      specNote: payload.note,
      winner: {
        avatar: winner.avatar,
        name: winner.name,
        facebookId: winner.memberKey,
      },
      quantity: winner.quantity,
      cost: 0,
      totalAmount: payload.unitPrice * winner.quantity,
      rating: 0,
      message: t('bid_list.manual_form.title'),
      platform: payload.platform,
      orderMethod: payload.bidOriginType === 'community' ? 'community' : 'live',
      status: 'unfinished',
    };
    rows.value.unshift(newRow);
  }
}

function handlePageChange(event: { page: number; rows: number }) {
  page.value = event.page + 1;
  perPage.value = event.rows;
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <Card>
      <template #content>
        <div class="flex flex-col gap-4">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="flex items-center gap-1">
              <h2 class="text-xl font-semibold text-surface-900 dark:text-surface-100">
                {{ t('bid_list.title') }}
              </h2>
              <HandbookButton section="bid_list" />
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <BidListBatchMenu
                @action="enterBatchMode"
                @rating-update="enterBatchRatingMode"
              />
              <Button
                type="button"
                severity="primary"
                outlined
                icon="pi pi-plus"
                :label="t('bid_list.button.manual_bid')"
                @click="openBlankManualBid"
              />
              <Button
                type="button"
                severity="secondary"
                outlined
                :label="t('bid_list.price_history.title')"
                @click="
                  priceHistoryProductId = null;
                  priceHistorySessionName = null;
                  priceHistoryOrderMethod = null;
                  priceHistorySource = null;
                  isPriceHistoryOpen = true;
                "
              />
              <Button
                type="button"
                severity="secondary"
                outlined
                :label="t('bid_list.button.bid_setting')"
                @click="isBidSettingOpen = true"
              />
              <!-- disabled 按鈕不觸發滑鼠事件，tooltip 掛在外層 span 上 -->
              <span v-tooltip.top="{ value: t('bid_list.export.tooltip.need_date_range'), disabled: canExport }">
                <Button
                  type="button"
                  severity="secondary"
                  outlined
                  :disabled="!canExport"
                  :label="t('bid_list.export.button.export')"
                  @click="isExportSettingOpen = true"
                />
              </span>
            </div>
          </div>

          <BidListFilterBar
            v-model:search-type="searchType"
            v-model:keyword="keyword"
            v-model:display-type="displayType"
            v-model:date-range="dateRange"
            v-model:source-type="sourceType"
            v-model:bid-status="bidStatus"
            v-model:order-method="orderMethod"
            v-model:invite-code="inviteCode"
            v-model:product-attributes="productAttributes"
            v-model:session="session"
            :session-options="sessionOptions"
            :multi-cart-name-options="multiCartNameOptions"
            :saved-filters="savedFilters"
            :is-batch-mode="isBatchMode"
            @search="commitFilter"
            @reset="handleReset"
            @save-filter="isSaveFilterOpen = true"
            @apply-saved-filter="handleApplySavedFilter"
            @remove-saved-filter="handleRemoveSavedFilter"
          />

          <Divider class="!my-0" />

          <div class="flex flex-wrap items-center gap-2">
            <span class="text-sm font-medium text-surface-500 dark:text-surface-400">
              {{ t('bid_list.quick_filter.title') }}
            </span>
            <button
              v-for="chip in quickSourceChips"
              :key="chip.value"
              type="button"
              :class="quickFilterChipClass(appliedFilter.sourceType === chip.value)"
              @click="toggleQuickSource(chip.value)"
            >
              {{ t(chip.labelKey) }}
            </button>
            <span class="mx-1 h-5 w-px bg-surface-200 dark:bg-surface-700" />
            <button
              v-for="chip in quickStatusChips"
              :key="chip.value"
              type="button"
              :class="quickFilterChipClass(appliedFilter.displayType === chip.value)"
              @click="toggleQuickFilter(chip.value)"
            >
              {{ t(chip.labelKey) }}
            </button>
            <span class="ml-auto text-sm text-surface-500 dark:text-surface-400">
              {{ t('common.pagination.total_records', { count: totalRecords }) }}
            </span>
          </div>
        </div>
      </template>
    </Card>

    <Card>
      <template #content>
        <div class="flex flex-col gap-4">
          <BidListBatchModeBar
            v-if="isBatchMode"
            :title="batchModeTitle"
            :selected-count="selectedIds.size"
            :selectable-count="batchSelectableRows.length"
            :next-label="batchModeNextLabel"
            @select-all="handleBatchSelectAll"
            @next="handleBatchNextStep"
            @cancel="exitBatchMode"
          />

          <BidListToolbar
            v-if="isPreorderMode"
            @action="handleToolbarAction"
          />

          <div
            v-if="isLoading"
            class="flex flex-col gap-3"
          >
            <Skeleton
              v-for="i in 3"
              :key="i"
              height="6rem"
            />
          </div>

          <BidListGroupedTable
            v-else-if="isGroupedView"
            :rows="groupedRows"
            @row-action="handleGroupedRowAction"
          />

          <BidListTable
            v-else
            :rows="displayedRows"
            :is-preorder-mode="isPreorderMode"
            :selectable="isBatchMode"
            :selectable-ids="batchSelectableIds"
            v-model:selected-ids="selectedIds"
            v-model:time-sort="timeSort"
            @row-action="handleRowAction"
            @row-rating-change="handleRowRatingChange"
            @preview-image="handlePreviewImage"
            @winner-profile="handleShowWinnerProfile"
          />

          <Paginator
            v-if="totalRecords > 0"
            :rows="perPage"
            :total-records="totalRecords"
            :first="(page - 1) * perPage"
            :rows-per-page-options="[10, 30, 50, 100]"
            @page="handlePageChange"
          />
        </div>
      </template>
    </Card>

    <HelperCheckoutDialog
      v-model:visible="isHelperCheckoutOpen"
      :selected-count="helperCheckoutRows.length"
      :selected-rows="helperCheckoutRows"
    />
    <OrderModificationDialog
      v-model:visible="isOrderModificationOpen"
      :candidate-rows="orderModificationRows"
      @submit="handleOrderModificationSubmit"
    />
    <BidSettingDialog v-model:visible="isBidSettingOpen" />

    <SaveFilterNameDialog
      v-model:visible="isSaveFilterOpen"
      :saved-filters="savedFilters"
      :default-name="defaultSavedFilterName"
      @save="handleSaveFilter"
    />
    <ConvertFbidDialog
      v-model:visible="isConvertFbidOpen"
      :row="convertFbidRow"
    />
    <PrintBidDialog v-model:visible="isPrintBidOpen" />
    <NotifyCashoutDialog
      v-model:visible="isNotifyCashoutOpen"
      :selected-rows="notifyCashoutRows"
      @open-history="handleOpenNotifyHistory"
      @send="handleNotifyCashoutSend"
    />
    <NotifyHistoryDialog
      v-model:visible="isNotifyHistoryOpen"
      :bid-id="notifyHistoryBidId"
    />
    <ManualBidFormDialog
      v-model:visible="isManualBidFormOpen"
      :title="manualBidDialogTitle"
      :pending-winners="quickBidWinners"
      :preselected-product="quickBidProduct"
      @submit="handleManualBidSubmit"
    />
    <LiveProductSalesDialog v-model:visible="isLiveProductSalesOpen" />
    <BatchActionDoneDialog v-model:visible="isBatchDoneOpen" />
    <PriceHistoryDialog
      v-model:visible="isPriceHistoryOpen"
      :preselected-product-id="priceHistoryProductId"
      :preselected-session-name="priceHistorySessionName"
      :preselected-order-method="priceHistoryOrderMethod"
      :preselected-source="priceHistorySource"
    />
    <EditBidDataDialog
      v-model:visible="isEditBidOpen"
      :row="editBidRow"
      @save="handleEditBidSave"
      @batch-save="handleEditBidBatchSave"
      @manual-bid="handleEditBidManualBid"
    />
    <BatchEditProductQuantityDialog
      v-model:visible="isBatchEditQtyOpen"
      :session-name="batchEditQtySessionName"
    />
    <PreorderArrivalDialog
      v-model:visible="isPreorderArrivalOpen"
      @confirm="handlePreorderArrivalConfirm"
    />
    <WinnerProfileDialog
      v-model:visible="isWinnerProfileOpen"
      :winner="winnerProfileTarget"
      :platform="winnerProfilePlatform"
    />

    <!-- 匯出設定（點「匯出」開啟：選項 + 排序，視窗內確認後才開始匯出） -->
    <Dialog
      v-model:visible="isExportSettingOpen"
      modal
      :header="t('bid_list.export.dialog.title')"
      :style="{ width: '24rem' }"
    >
      <div class="flex flex-col gap-3 text-sm">
        <div class="flex flex-col gap-2">
          <span class="font-medium text-surface-500 dark:text-surface-400">
            {{ t('bid_list.export.section.options') }}
          </span>
          <label class="inline-flex items-center gap-2 cursor-pointer">
            <Checkbox
              v-model="exportSettings.isAddonSeparated"
              binary
            />
            <span>{{ t('bid_list.export.option.separate_addon') }}</span>
          </label>
          <label class="inline-flex items-center gap-2 cursor-pointer">
            <Checkbox
              v-model="exportSettings.hasPhotos"
              binary
            />
            <span>{{ t('bid_list.export.option.with_photos') }}</span>
          </label>
          <label class="inline-flex items-center gap-2 cursor-pointer">
            <Checkbox
              v-model="exportSettings.isSortedByCustomer"
              binary
            />
            <span>{{ t('bid_list.export.option.sort_by_customer') }}</span>
          </label>
        </div>
        <div class="flex flex-col gap-2 border-t border-surface-200 dark:border-surface-700 pt-3">
          <span class="font-medium text-surface-500 dark:text-surface-400">
            {{ t('bid_list.export.section.sort') }}
          </span>
          <label class="inline-flex items-center gap-2 cursor-pointer">
            <RadioButton
              v-model="exportSettings.sortDirection"
              value="newest"
            />
            <span>{{ t('bid_list.export.sort.newest_first') }}</span>
          </label>
          <label class="inline-flex items-center gap-2 cursor-pointer">
            <RadioButton
              v-model="exportSettings.sortDirection"
              value="oldest"
            />
            <span>{{ t('bid_list.export.sort.oldest_first') }}</span>
          </label>
        </div>
      </div>
      <template #footer>
        <Button
          type="button"
          severity="secondary"
          outlined
          :label="t('bid_list.export.button.cancel')"
          @click="isExportSettingOpen = false"
        />
        <Button
          type="button"
          severity="success"
          :label="t('bid_list.export.button.export')"
          @click="handleExport"
        />
      </template>
    </Dialog>

    <!-- 商品照片預覽 -->
    <Dialog
      v-model:visible="isImagePreviewOpen"
      modal
      :header="t('bid_list.dialog.image_preview_title')"
      :style="{ width: '36rem', maxWidth: '95vw' }"
    >
      <div class="flex items-center justify-center">
        <img
          :src="previewImageSrc"
          alt=""
          class="w-full max-h-[70vh] object-contain rounded"
        />
      </div>
    </Dialog>
  </div>
</template>
