<script setup lang="ts">
/**
 * 得標清單表格
 * — 每列包含：建立/異動時間、場次、商品照、多購物車、商品名稱+單品免運膠囊+加購 badge、
 *   規格備註、得標人+社群 ID、得標數量、得標金額、留言、來源、動作按鈕組
 * — 4 種標單狀態各自渲染不同的列快捷按鈕群
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useGlobalToast } from '@/admin/composables/useGlobalToast';
import { ProductRouteName } from '@/admin/router/routes/productRoutes';
import livebuyLogo from '@/admin/assets/images/logo-livebuy-square.png';
import RatingSelector from './RatingSelector.vue';
import type { BidListRow, BidListStatusKey } from '../composables/useBidListMock';
import type { BidListTimeSort } from '../composables/useBidListFilter';
import { stripSpecPrefix } from '../utils/spec';

export type BidListRowAction =
  | 'transferComplete'
  | 'transferOrder'
  | 'convertFbid'
  | 'discard'
  | 'restoreFromDiscard'
  | 'printBid'
  | 'editData'
  | 'notifyBidWin'
  | 'toggleFreeShipping'
  | 'preorderArrival'
  | 'createManualBid'
  | 'openPriceHistoryByProduct';

interface Props {
  rows: BidListRow[];
  selectedIds: Set<string>;
  /** 預購顯示模式：true 時商品名稱上方顯示「(預購商品)」標籤 */
  isPreorderMode?: boolean;
  /** 批次模式：true 時才顯示表頭全選與列首勾選框 */
  selectable?: boolean;
  /** 批次模式可勾選的列 id（null／undefined = 全部可勾）；不在範圍的列不顯示勾選框 */
  selectableIds?: Set<string> | null;
  /** 目前排序（null = 未排序，視同標單建立時間由新到舊） */
  timeSort: BidListTimeSort | null;
}

interface Emits {
  (event: 'update:selectedIds', value: Set<string>): void;
  (event: 'update:timeSort', value: BidListTimeSort | null): void;
  (event: 'row-action', action: BidListRowAction, row: BidListRow): void;
  (event: 'row-rating-change', row: BidListRow, value: number): void;
  (event: 'preview-image', src: string): void;
  (event: 'winner-profile', row: BidListRow): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const { t } = useI18n();
const { showInfo, showError } = useGlobalToast();
const router = useRouter();

/** 商品詳細頁 URL（mock 階段所有商品都連到 id 14，接 API 後改成 row.productId） */
const productDetailUrl = computed(() =>
  router.resolve({ name: ProductRouteName.ProductUpdate, params: { id: '14' } }).href,
);

// ── 得標者「社群 ID」hover 卡：滑到人名上顯示社群 ID + 複製鈕 ──
/** hover 卡當前對應的列 */
const hoverWinnerRow = ref<BidListRow | null>(null);
/** 社群 ID hover 卡（PrimeVue Popover，置於 v-for 外共用） */
const winnerIdPopover = ref();
/** 離開名字後延遲收合的計時器（保留空檔讓游標滑進卡片點複製） */
let winnerIdHideTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * 滑入人名：顯示該列的社群 ID hover 卡。
 * 已顯示時先收合再於下一 tick 開啟，確保重新定位到新的人名（PrimeVue Popover 對已開啟者不會重新對位）。
 * @param row 目標列
 * @param event 觸發事件（供 Popover 定位）
 */
function showWinnerId(row: BidListRow, event: Event): void {
  cancelHideWinnerId();
  const target = event.currentTarget as HTMLElement;
  hoverWinnerRow.value = row;
  const popover = winnerIdPopover.value;
  if (!popover) return;
  popover.hide();
  nextTick(() => popover.show({ currentTarget: target } as unknown as Event));
}

/** 離開人名 / 卡片：延遲收合，讓游標有時間滑進卡片按複製。 */
function scheduleHideWinnerId(): void {
  winnerIdHideTimer = setTimeout(() => {
    winnerIdPopover.value?.hide();
  }, 150);
}

/** 游標滑進 hover 卡：取消延遲收合。 */
function cancelHideWinnerId(): void {
  if (winnerIdHideTimer) {
    clearTimeout(winnerIdHideTimer);
    winnerIdHideTimer = null;
  }
}

/** 得標者社群 ID 的欄位標籤：依平台顯示（如 facebook → 「Facebook ID」）。 */
function winnerIdLabel(row: BidListRow): string {
  return t('bid_list.table.cell.platform_id', { platform: platformStyle[row.platform].label });
}

/** 複製當前 hover 卡的社群 ID 到剪貼簿，並以 toast 回饋結果。 */
async function copyCommunityId(): Promise<void> {
  const row = hoverWinnerRow.value;
  if (!row?.winner.facebookId) return;
  try {
    await navigator.clipboard.writeText(row.winner.facebookId);
    showInfo({
      detail: t('bid_list.toast.copied_platform_id', { platform: platformStyle[row.platform].label }),
    });
  }
  catch {
    showError({ detail: t('bid_list.toast.copy_failed') });
  }
  winnerIdPopover.value?.hide();
}

/** 規格欄：去掉 specNote 的「規格:」前綴，回傳純規格值（無則空字串） */
function specValue(row: BidListRow): string {
  return stripSpecPrefix(row.specNote);
}

/** 組合商品規格欄預設最多顯示的子商品數，其餘收進「更多」 */
const BUNDLE_PREVIEW_COUNT = 3;

/** 已展開「更多」子商品的組合商品列 id */
const expandedBundleIds = ref<Set<string>>(new Set());

function isBundleExpanded(rowId: string): boolean {
  return expandedBundleIds.value.has(rowId);
}

function toggleBundle(rowId: string) {
  const next = new Set(expandedBundleIds.value);
  if (next.has(rowId)) {
    next.delete(rowId);
  } else {
    next.add(rowId);
  }
  expandedBundleIds.value = next;
}

/** 規格欄目前要顯示的子商品（未展開時僅前 BUNDLE_PREVIEW_COUNT 件） */
function visibleBundleItems(row: BidListRow) {
  const items = row.bundleItems ?? [];
  return isBundleExpanded(row.id) ? items : items.slice(0, BUNDLE_PREVIEW_COUNT);
}

function isSelected(row: BidListRow): boolean {
  return props.selectedIds.has(row.id);
}

/** 該列在目前批次模式下是否可勾選 */
function isRowSelectable(row: BidListRow): boolean {
  return props.selectableIds == null || props.selectableIds.has(row.id);
}

/** 表頭全選（僅批次模式顯示）：以目前顯示中「可勾選」的 rows 為範圍 */
const selectableRows = computed(() => props.rows.filter((row) => isRowSelectable(row)));

const allSelected = computed({
  get: () =>
    selectableRows.value.length > 0 &&
    selectableRows.value.every((row) => props.selectedIds.has(row.id)),
  set: (value: boolean) => {
    emit(
      'update:selectedIds',
      value ? new Set(selectableRows.value.map((row) => row.id)) : new Set<string>(),
    );
  },
});

function toggle(row: BidListRow, value: boolean) {
  const next = new Set(props.selectedIds);
  if (value) {
    next.add(row.id);
  } else {
    next.delete(row.id);
  }
  emit('update:selectedIds', next);
}

const statusMeta: Record<
  BidListStatusKey,
  { labelKey: string; severity: 'success' | 'warn' | 'danger' }
> = {
  unfinished: { labelKey: 'bid_list.status.unfinished', severity: 'warn' },
  transferredToOrder: { labelKey: 'bid_list.status.transferred_to_order', severity: 'success' },
  transferredToComplete: {
    labelKey: 'bid_list.status.transferred_to_complete',
    severity: 'success',
  },
  discarded: { labelKey: 'bid_list.status.discarded', severity: 'danger' },
};

/** 列動作描述 */
interface RowActionItem {
  key: BidListRowAction;
  labelKey: string;
  icon: [string, string];
  /** 指定則以此 PrimeIcon class 渲染（優先於 FontAwesome）；用於規範指定的圖示，如編輯 `pi pi-pen-to-square` */
  pi?: string;
  severity: 'primary' | 'success' | 'info' | 'warn' | 'danger' | 'secondary';
}

/**
 * 各狀態列共通的核心操作（順序固定，讓不同狀態的操作欄前段一致）
 * @param row 得標清單列
 * @returns 共通操作清單
 */
function buildCommonActions(row: BidListRow): RowActionItem[] {
  return [
    {
      key: 'createManualBid',
      labelKey: 'bid_list.table.action.create_manual_bid',
      icon: ['fas', 'file-signature'],
      severity: 'info',
    },
    {
      key: 'editData',
      labelKey: 'bid_list.table.action.edit_data',
      icon: ['fas', 'edit'],
      pi: 'pi pi-pen-to-square',
      severity: 'primary',
    },
    {
      key: 'toggleFreeShipping',
      labelKey: row.hasSingleItemFreeShipping
        ? 'bid_list.table.action.remove_free_shipping'
        : 'bid_list.table.action.add_free_shipping',
      icon: ['fas', 'truck-fast'],
      severity: row.hasSingleItemFreeShipping ? 'danger' : 'primary',
    },
    {
      key: 'printBid',
      labelKey: 'bid_list.table.action.print_bid',
      icon: ['fas', 'print'],
      severity: 'info',
    },
    {
      key: 'notifyBidWin',
      labelKey: 'bid_list.table.action.notify_bid_win',
      icon: ['fas', 'bell'],
      severity: 'info',
    },
  ];
}

/**
 * 狀態專屬的額外操作（放在共通操作後、以分隔線隔開）
 * — 未處理：棄標／轉訂單／轉完成單或預購到貨／轉 FB
 * — 已棄標：還原
 * @param row 得標清單列
 * @returns 額外操作清單（無則空陣列）
 */
function buildExtraActions(row: BidListRow): RowActionItem[] {
  const actions: RowActionItem[] = [];
  const isPreorderAttribute = row.isPreorder === true || row.bidOriginType === 'preorder';
  if (row.status === 'unfinished') {
    actions.push({
      key: 'discard',
      labelKey: 'bid_list.table.action.discard',
      icon: ['fas', 'ban'],
      severity: 'danger',
    });
    if (!isPreorderAttribute) {
      actions.push({
        key: 'transferOrder',
        labelKey: 'bid_list.table.action.transfer_order',
        icon: ['fas', 'cart-shopping'],
        severity: 'info',
      });
    }
    if (isPreorderAttribute) {
      // 預購屬性標單：需先預購到貨，不提供轉完成單／轉訂單
      actions.push({
        key: 'preorderArrival',
        labelKey: 'bid_list.table.action.preorder_arrival',
        icon: ['fas', 'truck'],
        severity: 'success',
      });
    } else {
      actions.push({
        key: 'transferComplete',
        labelKey: 'bid_list.table.action.transfer_complete',
        icon: ['fas', 'check-double'],
        severity: 'primary',
      });
    }
    actions.push({
      key: 'convertFbid',
      labelKey: 'bid_list.table.action.convert_fbid',
      icon: ['fas', 'shuffle'],
      severity: 'info',
    });
  }
  if (row.status === 'discarded') {
    actions.push({
      key: 'restoreFromDiscard',
      labelKey: 'bid_list.table.action.restore_from_discard',
      icon: ['fas', 'rotate-left'],
      severity: 'info',
    });
  }
  return actions;
}

interface PlatformStyle {
  label: string;
  bgClass: string;
  textClass: string;
  icon: [string, string] | null;
  /** 無 FontAwesome 品牌 icon 時改用圖片 logo（如 Livebuy） */
  image?: string;
}

const platformStyle: Record<BidListRow['platform'], PlatformStyle> = {
  facebook: {
    label: 'Facebook',
    bgClass: 'bg-[#1877F2]',
    textClass: 'text-white',
    icon: ['fab', 'facebook'],
  },
  instagram: {
    label: 'Instagram',
    bgClass: 'bg-[#E4405F]',
    textClass: 'text-white',
    icon: ['fab', 'instagram'],
  },
  tiktok: {
    label: 'TikTok',
    bgClass: 'bg-black',
    textClass: 'text-white',
    icon: ['fab', 'tiktok'],
  },
  livebuy: {
    label: 'LiveBuy',
    bgClass: 'bg-surface-500',
    textClass: 'text-white',
    icon: null,
    image: livebuyLogo,
  },
  line: {
    label: 'LINE',
    bgClass: 'bg-[#06C755]',
    textClass: 'text-white',
    icon: ['fab', 'line'],
  },
};

/**
 * 將 'YYYY-MM-DD HH:mm:ss' 裁切為 'YYYY-MM-DD HH:mm' 顯示
 * @param time 完整時間字串
 * @returns 精確到分鐘的時間字串
 */
function formatTimeToMinute(time: string): string {
  return time.slice(0, 16);
}

/**
 * 商品照顯示來源
 * — 加購商品優先顯示商品卡圖片，未設定則退回商品圖片；兩者皆無回傳空字串（顯示未上傳提示）
 * @param row 得標清單列
 * @returns 圖片網址；空字串代表無圖可顯示
 */
function resolveProductImage(row: BidListRow): string {
  if (row.isAddOn && row.cardImage) return row.cardImage;
  return row.productImage;
}

/** 表頭排序欄位（4 欄互斥，一次僅一欄生效） */
type BidListSortField = 'createTime' | 'lastUpdateTime' | 'newlyAddedTime' | 'rating';

const sortFieldValueMap: Record<BidListSortField, { desc: BidListTimeSort; asc: BidListTimeSort }> = {
  createTime: { desc: 'createTimeDesc', asc: 'createTimeAsc' },
  lastUpdateTime: { desc: 'lastUpdateTimeDesc', asc: 'lastUpdateTimeAsc' },
  newlyAddedTime: { desc: 'newlyAddedTimeDesc', asc: 'newlyAddedTimeAsc' },
  rating: { desc: 'ratingDesc', asc: 'ratingAsc' },
};

const sortFieldLabelKeyMap: Record<BidListSortField, string> = {
  createTime: 'bid_list.table.sort.create_time',
  lastUpdateTime: 'bid_list.table.sort.last_update_time',
  newlyAddedTime: 'bid_list.table.sort.newly_added_time',
  rating: 'bid_list.table.sort.rating',
};

/** 選單內顯示的欄位短名稱 */
const sortFieldShortLabelKeyMap: Record<BidListSortField, string> = {
  createTime: 'bid_list.table.sort.field.create_time',
  lastUpdateTime: 'bid_list.table.sort.field.last_update_time',
  newlyAddedTime: 'bid_list.table.sort.field.newly_added_time',
  rating: 'bid_list.table.sort.field.rating',
};

/** 時間排序選單的欄位順序 */
const timeSortFields: BidListSortField[] = ['createTime', 'lastUpdateTime', 'newlyAddedTime'];

/** 時間排序選單（單一 icon 點開） */
const timeSortMenu = ref();

/** 操作欄外顯的核心操作數（其餘收進「更多」⋮ 縱向選單） */
const VISIBLE_COMMON_COUNT = 2;
/** 「更多」選單當前作用的列 */
const moreActionRow = ref<BidListRow | null>(null);
const moreActionMenu = ref();

/**
 * 開啟某列的「更多」操作選單。
 * @param row 目標列
 * @param event 觸發事件（供 Popover 定位）
 */
function openMoreActions(row: BidListRow, event: Event): void {
  moreActionRow.value = row;
  moreActionMenu.value?.toggle(event);
}

/**
 * 點選「更多」選單中的操作：發出 row-action 後收合選單。
 * @param action 操作 key
 */
function handleMoreAction(action: BidListRowAction): void {
  if (moreActionRow.value) emit('row-action', action, moreActionRow.value);
  moreActionMenu.value?.hide();
}

/**
 * 「更多」選單項目的 class：破壞性操作（severity=danger，如棄標／移除免運）以紅字警示，其餘走灰階，
 * 與同模組 BidListBatchMenu 的破壞性動作紅字慣例一致。
 * @param action 操作項目
 * @returns Tailwind class 字串
 */
function moreActionItemClass(action: RowActionItem): string {
  const base = 'flex items-center gap-3 rounded px-3 py-2 text-sm';
  return action.severity === 'danger'
    ? `${base} text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30`
    : `${base} text-surface-700 hover:bg-surface-100 dark:text-surface-200 dark:hover:bg-surface-700`;
}

// ── 表格橫向捲動提示（參照訂單管理）：資料未捲到底時，在凍結操作欄左側顯示漸層 + 可點 chevron ──
const tableScrollWrap = ref<HTMLElement | null>(null);
const canScrollLeft = ref(false);
const canScrollRight = ref(false);
const overlayTop = ref(0);
const overlayHeight = ref(0);
const frozenColWidth = ref(0);
let scrollEl: HTMLElement | null = null;

/** 量測捲動容器尺寸與凍結欄寬（供 overlay 定位），並更新捲動狀態。 */
function measureTable(): void {
  const wrap = tableScrollWrap.value;
  if (!wrap) return;
  scrollEl = wrap.querySelector('.p-datatable-table-container');
  if (!scrollEl) return;
  overlayTop.value = scrollEl.offsetTop;
  overlayHeight.value = scrollEl.clientHeight;
  const frozen = wrap.querySelector<HTMLElement>('.p-datatable-thead .p-datatable-frozen-column');
  frozenColWidth.value = frozen ? frozen.offsetWidth : 0;
  updateScrollState();
}

/** 依捲動位置更新左右箭頭顯示（右側殘差扣 16px，避免捲到底仍顯示）。 */
function updateScrollState(): void {
  if (!scrollEl) return;
  canScrollLeft.value = scrollEl.scrollLeft > 1;
  canScrollRight.value = scrollEl.scrollWidth - (scrollEl.scrollLeft + scrollEl.clientWidth) > 16;
}

/**
 * 點箭頭時平滑捲動約 60% 視寬。
 * @param dir 1=向右、-1=向左
 */
function scrollTableBy(dir: 1 | -1): void {
  scrollEl?.scrollBy({ left: dir * Math.round((scrollEl.clientWidth || 400) * 0.6), behavior: 'smooth' });
}

let tableResizeObserver: ResizeObserver | null = null;
onMounted(async () => {
  await nextTick();
  measureTable();
  scrollEl?.addEventListener('scroll', updateScrollState, { passive: true });
  tableResizeObserver = new ResizeObserver(() => measureTable());
  if (tableScrollWrap.value) tableResizeObserver.observe(tableScrollWrap.value);
});
onBeforeUnmount(() => {
  scrollEl?.removeEventListener('scroll', updateScrollState);
  tableResizeObserver?.disconnect();
  if (winnerIdHideTimer) clearTimeout(winnerIdHideTimer);
});
// 資料 / 批次模式改變後行高與欄寬變動，重新量測
watch(
  () => [props.rows, props.selectable] as const,
  () => nextTick(measureTable),
);

/** 目前生效的時間排序欄位（null = 未排序或星等排序中） */
const activeTimeField = computed<BidListSortField | null>(() => {
  for (const field of timeSortFields) {
    if (sortDirection(field) !== null) return field;
  }
  return null;
});

function sortDirection(field: BidListSortField): 'desc' | 'asc' | null {
  if (props.timeSort === sortFieldValueMap[field].desc) return 'desc';
  if (props.timeSort === sortFieldValueMap[field].asc) return 'asc';
  return null;
}

/** 點擊循環：未排序 → 降冪 → 升冪 → 取消；點其他欄位時直接改為該欄降冪 */
function toggleSort(field: BidListSortField) {
  const direction = sortDirection(field);
  if (direction === null) {
    emit('update:timeSort', sortFieldValueMap[field].desc);
  } else if (direction === 'desc') {
    emit('update:timeSort', sortFieldValueMap[field].asc);
  } else {
    emit('update:timeSort', null);
  }
}

function sortIcon(field: BidListSortField): [string, string] {
  const direction = sortDirection(field);
  if (direction === 'desc') return ['fas', 'arrow-down'];
  if (direction === 'asc') return ['fas', 'arrow-up'];
  return ['fas', 'arrows-up-down'];
}

function sortIconClass(field: BidListSortField): string {
  return sortDirection(field) === null
    ? 'text-surface-400 hover:text-surface-600 dark:hover:text-surface-200'
    : 'text-primary-600 dark:text-primary-400';
}

</script>

<template>
  <div
    ref="tableScrollWrap"
    class="relative"
  >
    <DataTable
      :value="rows"
      data-key="id"
      striped-rows
      scrollable
      class="bid-list-main-table text-sm"
    >
      <template #empty>
        <div class="py-12 text-center text-surface-500 dark:text-surface-400">
          {{ t('bid_list.empty.no_data') }}
        </div>
      </template>

      <!-- 勾選（僅批次模式顯示；不符合當前批次條件的列不顯示勾選框） -->
      <Column
        v-if="selectable"
        frozen
        header-style="width: 3rem"
        body-class="align-top"
      >
        <template #header>
          <Checkbox
            v-model="allSelected"
            :binary="true"
          />
        </template>
        <template #body="{ data: row }: { data: BidListRow }">
          <Checkbox
            v-if="isRowSelectable(row)"
            :model-value="isSelected(row)"
            :binary="true"
            @update:model-value="(value: boolean) => toggle(row, value)"
          />
        </template>
      </Column>

      <!-- 建立/異動/商品卡建立時間（各以 icon 標示） -->
      <Column body-class="whitespace-nowrap text-sm align-top">
        <template #header>
          <div class="inline-flex items-center gap-2">
            <span class="font-semibold">{{ t('bid_list.table.column.source_session_time') }}</span>
            <!-- 時間欄排序：單一排序 icon，點開時間欄位選單 -->
            <button
              v-tooltip.top="t('bid_list.table.sort.time_menu')"
              type="button"
              :class="[
                'focus:outline-none',
                activeTimeField
                  ? 'text-primary-600 dark:text-primary-400'
                  : 'text-surface-400 hover:text-surface-600 dark:hover:text-surface-200',
              ]"
              :aria-label="t('bid_list.table.sort.time_menu')"
              @click="timeSortMenu?.toggle($event)"
            >
              <FontAwesomeIcon
                :icon="activeTimeField ? sortIcon(activeTimeField) : ['fas', 'arrows-up-down']"
              />
            </button>
          </div>
        </template>
        <template #body="{ data: row }: { data: BidListRow }">
          <div class="flex items-center gap-2 text-surface-700 dark:text-surface-100">
            <FontAwesomeIcon
              v-tooltip.top="t('bid_list.table.sort.field.create_time')"
              :icon="['fas', 'clock']"
              class="text-surface-400"
            />
            {{ formatTimeToMinute(row.createTime) }}
          </div>
          <div
            v-if="row.updateTime && row.updateTime !== row.createTime"
            class="mt-1 flex items-center gap-2 text-xs text-surface-400"
          >
            <FontAwesomeIcon
              v-tooltip.top="t('bid_list.table.sort.field.last_update_time')"
              :icon="['fas', 'pen-to-square']"
            />
            {{ formatTimeToMinute(row.updateTime) }}
          </div>
          <div class="mt-1 flex items-center gap-2 text-xs text-surface-400">
            <FontAwesomeIcon
              v-tooltip.top="t('bid_list.table.sort.field.newly_added_time')"
              :icon="['fas', 'box']"
            />
            {{ formatTimeToMinute(row.productCardCreateTime) }}
          </div>
        </template>
      </Column>

      <!-- 狀態/多購物車：狀態膠囊每列固定顯示，其下為購物車名稱；內容置左 -->
      <Column
        :header="t('bid_list.table.column.multi_cart')"
        body-class="text-left align-top"
      >
        <template #body="{ data: row }: { data: BidListRow }">
          <Tag
            :severity="statusMeta[row.status].severity"
            :value="t(statusMeta[row.status].labelKey)"
          />
          <div class="mt-1.5 text-surface-500 dark:text-surface-400">
            <span v-if="row.multiCartName">{{ row.multiCartName }}</span>
            <span v-else>---</span>
          </div>
        </template>
      </Column>

      <!-- 得標人 + 評分 -->
      <Column body-class="min-w-[200px] align-top">
        <template #header>
          <div class="inline-flex items-center gap-2">
            <span class="font-semibold">{{ t('bid_list.table.column.winner') }}</span>
            <!-- 得標者/星等欄：星等排序 icon -->
            <button
              v-tooltip.top="t(sortFieldLabelKeyMap.rating)"
              type="button"
              :class="['focus:outline-none', sortIconClass('rating')]"
              :aria-label="t(sortFieldLabelKeyMap.rating)"
              @click="toggleSort('rating')"
            >
              <FontAwesomeIcon :icon="sortIcon('rating')" />
            </button>
          </div>
        </template>
        <template #body="{ data: row }: { data: BidListRow }">
          <div class="flex items-start gap-3">
            <!-- 頭像（可點擊開會員資料 dialog） + LINE 綁定 icon -->
            <div class="shrink-0">
              <button
                type="button"
                v-tooltip.top="`${t('bid_list.winner_profile.tooltip_prefix')}${row.winner.facebookId}${row.winner.psid ? `${t('bid_list.winner_profile.tooltip_psid_prefix')}${row.winner.psid}` : ''}`"
                class="relative rounded-full focus:outline-none focus:ring-2 focus:ring-primary-500"
                :aria-label="t('bid_list.winner_profile.title')"
                @click="emit('winner-profile', row)"
              >
                <div class="w-10 h-10 rounded-full bg-surface-200 dark:bg-surface-700 flex items-center justify-center overflow-hidden">
                  <FontAwesomeIcon
                    :icon="['fas', 'user']"
                    class="text-surface-400 dark:text-surface-500 text-lg"
                  />
                </div>
                <FontAwesomeIcon
                  v-if="row.winner.hasLine"
                  :icon="['fab', 'line']"
                  class="absolute -bottom-0.5 -right-0.5 text-[#06C755] text-sm bg-white dark:bg-surface-800 rounded-full"
                  :aria-label="t('bid_list.table.cell.line_bound_tooltip')"
                />
              </button>
            </div>

            <div class="flex-1 min-w-0 flex flex-col gap-1">
              <!-- 名字（點擊開會員資料 dialog；滑鼠 hover 顯示社群 ID + 複製鈕，屬滑鼠導向次要資訊，
                   不綁 focus 觸發以免對鍵盤使用者製造「看似可用、實際按不到複製鈕」的假象） -->
              <div class="flex items-center gap-2">
                <span
                  v-if="row.winner.name"
                  role="button"
                  tabindex="0"
                  class="truncate text-sm text-surface-700 dark:text-surface-100 cursor-pointer hover:underline focus:outline-none focus:underline"
                  @click="emit('winner-profile', row)"
                  @keydown.enter="emit('winner-profile', row)"
                  @mouseenter="showWinnerId(row, $event)"
                  @mouseleave="scheduleHideWinnerId"
                >
                  {{ row.winner.name }}
                </span>
                <span
                  v-else
                  role="button"
                  tabindex="0"
                  class="truncate text-sm italic text-surface-400 dark:text-surface-500 cursor-pointer hover:underline focus:outline-none focus:underline"
                  @click="emit('winner-profile', row)"
                  @keydown.enter="emit('winner-profile', row)"
                  @mouseenter="showWinnerId(row, $event)"
                  @mouseleave="scheduleHideWinnerId"
                >
                  {{ t('bid_list.table.cell.no_name') }}
                </span>
              </div>

              <!-- 星等（置於名稱下方） -->
              <RatingSelector
                :model-value="row.rating"
                size="small"
                @update:model-value="(value: number) => emit('row-rating-change', row, value)"
              />
            </div>
          </div>
        </template>
      </Column>

      <!-- 標單來源/收單方式/場次/留言（第一行平台 icon＋收單方式（含預購膠囊）、第二行場次、第三行留言） -->
      <Column
        :style="{ width: '216px' }"
        body-class="text-xs align-top"
      >
        <template #header>
          <span class="whitespace-nowrap font-semibold">
            {{ t('bid_list.table.column.message') }}
          </span>
        </template>
        <template #body="{ data: row }: { data: BidListRow }">
          <div class="flex flex-col gap-1 w-[184px] whitespace-normal">
            <div class="flex flex-wrap items-center gap-2">
              <!-- 有圖片 logo 的平台（如 Livebuy）：logo 單獨顯示，不套色塊 badge -->
              <img
                v-if="platformStyle[row.platform].image"
                v-tooltip.top="platformStyle[row.platform].label"
                :src="platformStyle[row.platform].image"
                :alt="platformStyle[row.platform].label"
                class="w-5 h-5 shrink-0"
              />
              <span
                v-else
                :class="[
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium',
                  platformStyle[row.platform].bgClass,
                  platformStyle[row.platform].textClass,
                ]"
              >
                <FontAwesomeIcon
                  v-if="platformStyle[row.platform].icon"
                  :icon="platformStyle[row.platform].icon!"
                />
                <span v-if="row.platform !== 'facebook'">
                  {{ platformStyle[row.platform].label }}
                </span>
              </span>
              <span class="font-medium text-surface-700 dark:text-surface-200">
                {{ t(`bid_list.table.cell.order_method.${row.orderMethod}`) }}
              </span>
              <Tag
                v-if="row.isPreorder === true || row.bidOriginType === 'preorder'"
                severity="info"
                :value="t('bid_list.table.cell.preorder_tag')"
                class="text-xs"
              />
            </div>
            <span class="text-surface-800 dark:text-surface-100 font-medium break-words">
              {{ row.sessionName }}
            </span>
            <span class="text-surface-600 dark:text-surface-300 break-words">{{ row.message }}</span>
          </div>
        </template>
      </Column>

      <!-- 商品（縮圖 + 名稱 + 單品免運/加購 badge） -->
      <Column
        :header="t('bid_list.table.column.product')"
        body-class="min-w-[240px] align-top"
      >
        <template #body="{ data: row }: { data: BidListRow }">
          <div class="flex items-start gap-3">
            <!-- 縮圖（加購商品優先顯示商品卡圖片；可點放大）／無圖提示 -->
            <div class="w-14 h-14 shrink-0">
              <button
                v-if="resolveProductImage(row)"
                type="button"
                class="w-14 h-14 bg-surface-100 dark:bg-surface-800 bg-contain bg-no-repeat bg-center border border-surface-200 dark:border-surface-700 rounded"
                :style="{ backgroundImage: `url('${resolveProductImage(row)}')` }"
                :aria-label="t('bid_list.action.preview_image')"
                @click="emit('preview-image', resolveProductImage(row))"
              />
              <span
                v-else
                class="flex h-14 w-14 items-center justify-center rounded border border-dashed border-surface-300 p-1 dark:border-surface-600"
              >
                <span class="whitespace-normal break-all text-center text-xs leading-tight text-surface-500 dark:text-surface-400">
                  {{ t('bid_list.table.cell.no_product_image') }}
                </span>
              </span>
            </div>

            <!-- 名稱 + tag -->
            <div class="flex flex-col gap-1 min-w-0">
              <div
                v-if="isPreorderMode"
                class="text-xs text-surface-500 dark:text-surface-400"
              >
                {{ t('bid_list.table.cell.preorder_label') }}
              </div>
              <a
                :href="productDetailUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="text-blue-600 dark:text-blue-400 hover:underline break-words"
              >
                {{ row.productName }}
              </a>
              <div
                v-if="row.hasSingleItemFreeShipping || row.isAddOn"
                class="flex flex-wrap items-center gap-2"
              >
                <Tag
                  v-if="row.hasSingleItemFreeShipping"
                  :value="t('bid_list.table.cell.free_shipping')"
                />
                <Tag
                  v-if="row.isAddOn"
                  severity="info"
                  :value="t('bid_list.table.cell.add_on')"
                />
              </div>
            </div>
          </div>
        </template>
      </Column>

      <!-- 規格（組合商品→列子商品內容，超過 3 件以「更多」展開；單一商品→規格值／待選規格／無規格） -->
      <Column
        :header="t('bid_list.table.column.spec')"
        body-class="text-sm text-surface-700 dark:text-surface-100 min-w-[140px] align-top"
      >
        <template #body="{ data: row }: { data: BidListRow }">
          <div
            v-if="row.bundleItems?.length"
            class="flex flex-col gap-1"
          >
            <ul class="flex flex-col gap-1">
              <li
                v-for="(item, index) in visibleBundleItems(row)"
                :key="index"
                class="whitespace-nowrap"
              >
                {{ item.spec ? `${item.name} / ${item.spec}` : item.name }} ×{{ item.qty }}
              </li>
            </ul>
            <button
              v-if="row.bundleItems.length > BUNDLE_PREVIEW_COUNT"
              type="button"
              class="self-start text-xs text-primary-600 hover:underline dark:text-primary-400"
              @click="toggleBundle(row.id)"
            >
              {{
                isBundleExpanded(row.id)
                  ? t('bid_list.table.cell.spec_bundle_collapse')
                  : t('bid_list.table.cell.spec_bundle_more', {
                      count: row.bundleItems.length - BUNDLE_PREVIEW_COUNT,
                    })
              }}
            </button>
          </div>
          <span
            v-else-if="row.isSpecPending"
            class="text-surface-500 dark:text-surface-400"
          >
            {{ t('bid_list.table.cell.spec_pending') }}
          </span>
          <span v-else-if="specValue(row)">{{ specValue(row) }}</span>
          <span
            v-else
            class="text-surface-500 dark:text-surface-400"
          >
            {{ t('bid_list.table.cell.spec_none') }}
          </span>
        </template>
      </Column>

      <!-- 得標金額 + 得標數量 -->
      <Column
        :header="t('bid_list.table.column.qty_amount')"
        body-class="whitespace-nowrap text-left align-top"
      >
        <template #body="{ data: row }: { data: BidListRow }">
          <div class="flex items-center gap-1">
            <span class="text-surface-700 dark:text-surface-100">
              {{ row.totalAmount }}
            </span>
            <!-- 放大鏡：查詢該商品歷史價格（金額本身不再可點） -->
            <Button
              v-tooltip.top="t('bid_list.table.amount_lookup_tooltip')"
              type="button"
              text
              size="small"
              severity="secondary"
              :aria-label="t('bid_list.table.amount_lookup_aria', { amount: row.totalAmount })"
              @click.stop="emit('row-action', 'openPriceHistoryByProduct', row)"
            >
              <i class="pi pi-search" />
            </Button>
          </div>
          <div class="text-surface-700 dark:text-surface-100 mt-1">
            {{ row.quantity }}
          </div>
        </template>
      </Column>

      <!-- 操作：外顯前 VISIBLE_COMMON_COUNT 顆核心操作 + 「更多」⋮ 選單（其餘核心操作、狀態專屬操作皆收進選單）
           凍結靠右：表格橫向捲動時操作欄常駐可見（參照訂單管理） -->
      <Column
        :header="t('bid_list.table.column.actions')"
        frozen
        align-frozen="right"
        body-class="whitespace-nowrap min-w-[120px] align-top"
      >
        <template #body="{ data: row }: { data: BidListRow }">
          <div class="flex flex-wrap items-center gap-1">
            <Button
              v-for="action in buildCommonActions(row).slice(0, VISIBLE_COMMON_COUNT)"
              :key="action.key"
              v-tooltip.top="t(action.labelKey)"
              type="button"
              size="small"
              text
              :severity="action.severity"
              :aria-label="t(action.labelKey)"
              @click="emit('row-action', action.key, row)"
            >
              <i
                v-if="action.pi"
                :class="action.pi"
              />
              <FontAwesomeIcon
                v-else
                :icon="action.icon"
              />
            </Button>
            <Button
              v-if="buildCommonActions(row).length > VISIBLE_COMMON_COUNT || buildExtraActions(row).length"
              v-tooltip.top="t('bid_list.table.action.more')"
              :aria-label="t('bid_list.table.action.more')"
              type="button"
              size="small"
              text
              severity="secondary"
              @click="openMoreActions(row, $event)"
            >
              <i class="pi pi-ellipsis-v" />
            </Button>
          </div>
        </template>
      </Column>
    </DataTable>

    <!-- 左側捲動提示：已向右捲動時出現，點擊往回捲 -->
    <div
      v-show="canScrollLeft"
      class="pointer-events-none absolute z-10 flex items-start justify-start pl-1"
      :style="{
        top: overlayTop + 'px',
        height: overlayHeight + 'px',
        left: '0px',
        width: '56px',
        background: 'linear-gradient(to left, transparent, var(--p-content-background))',
      }"
    >
      <button
        type="button"
        class="pointer-events-auto mt-3 flex size-7 items-center justify-center rounded-full border border-[var(--p-content-border-color)] bg-[var(--p-content-background)] text-[var(--p-text-color)] shadow hover:bg-[var(--p-content-hover-background)]"
        :aria-label="t('bid_list.table.scroll.left')"
        @click="scrollTableBy(-1)"
      >
        <i
          class="pi pi-chevron-left"
          style="font-size: 12px"
        />
      </button>
    </div>

    <!-- 右側捲動提示：資料尚未捲到底時出現，貼在凍結操作欄左側，點擊往右捲看更多欄位 -->
    <div
      v-show="canScrollRight"
      class="pointer-events-none absolute z-10 flex items-start justify-end pr-1"
      :style="{
        top: overlayTop + 'px',
        height: overlayHeight + 'px',
        right: frozenColWidth + 'px',
        width: '56px',
        background: 'linear-gradient(to right, transparent, var(--p-content-background))',
      }"
    >
      <button
        type="button"
        class="pointer-events-auto mt-3 flex size-7 items-center justify-center rounded-full border border-[var(--p-content-border-color)] bg-[var(--p-content-background)] text-[var(--p-text-color)] shadow hover:bg-[var(--p-content-hover-background)]"
        :aria-label="t('bid_list.table.scroll.right')"
        @click="scrollTableBy(1)"
      >
        <i
          class="pi pi-chevron-right"
          style="font-size: 12px"
        />
      </button>
    </div>

    <!--
      時間排序選單（置於 v-for 外，避免 template ref 變成陣列；點選項目三態循環）
      §6.7 例外：此面板為「原地三態循環 + 顯示當前排序狀態」，需點選後不收合，
      不適用 <Menu :popup>（Menu 點選即收合會失去循環與狀態回饋），故沿用 Popover。
    -->
    <Popover ref="timeSortMenu">
      <div class="flex flex-col min-w-48">
        <button
          v-for="field in timeSortFields"
          :key="field"
          v-tooltip.top="t(sortFieldLabelKeyMap[field])"
          type="button"
          class="flex items-center justify-between gap-3 px-3 py-2 rounded text-sm hover:bg-surface-100 dark:hover:bg-surface-700"
          @click="toggleSort(field)"
        >
          <span
            :class="
              sortDirection(field)
                ? 'text-primary-600 dark:text-primary-400 font-medium'
                : 'text-surface-700 dark:text-surface-200'
            "
          >
            {{ t(sortFieldShortLabelKeyMap[field]) }}
          </span>
          <FontAwesomeIcon
            :icon="sortIcon(field)"
            :class="
              sortDirection(field)
                ? 'text-primary-600 dark:text-primary-400'
                : 'text-surface-400'
            "
          />
        </button>
      </div>
    </Popover>

    <!-- 操作「更多」選單：未外顯的核心操作 + 狀態專屬操作，由上而下縱向列出，兩群以分隔線區隔
         （置於 v-for 外，避免 ref 陣列化） -->
    <Popover ref="moreActionMenu">
      <div class="flex min-w-44 flex-col">
        <!-- 未外顯的核心操作 -->
        <button
          v-for="action in moreActionRow ? buildCommonActions(moreActionRow).slice(VISIBLE_COMMON_COUNT) : []"
          :key="action.key"
          type="button"
          :class="moreActionItemClass(action)"
          @click="handleMoreAction(action.key)"
        >
          <i
            v-if="action.pi"
            :class="action.pi"
          />
          <FontAwesomeIcon
            v-else
            :icon="action.icon"
          />
          <span>{{ t(action.labelKey) }}</span>
        </button>

        <!-- 分隔線 + 狀態專屬操作（棄標／轉單／轉完成…；僅特定狀態才有） -->
        <template v-if="moreActionRow && buildExtraActions(moreActionRow).length">
          <div
            class="my-1 border-t border-surface-200 dark:border-surface-700"
            aria-hidden="true"
          />
          <button
            v-for="action in buildExtraActions(moreActionRow)"
            :key="action.key"
            type="button"
            :class="moreActionItemClass(action)"
            @click="handleMoreAction(action.key)"
          >
            <i
              v-if="action.pi"
              :class="action.pi"
            />
            <FontAwesomeIcon
              v-else
              :icon="action.icon"
            />
            <span>{{ t(action.labelKey) }}</span>
          </button>
        </template>
      </div>
    </Popover>

    <!-- 得標者「社群 ID」hover 卡：滑到人名上顯示社群 ID + 複製鈕（置於 v-for 外共用） -->
    <Popover ref="winnerIdPopover">
      <div
        v-if="hoverWinnerRow"
        class="flex items-center gap-2 px-2 py-1"
        @mouseenter="cancelHideWinnerId"
        @mouseleave="scheduleHideWinnerId"
      >
        <span class="text-xs text-surface-500 dark:text-surface-400">
          {{ winnerIdLabel(hoverWinnerRow) }}
        </span>
        <span class="select-all text-sm font-medium text-surface-800 dark:text-surface-100">
          {{ hoverWinnerRow.winner.facebookId }}
        </span>
        <Button
          v-tooltip.top="t('bid_list.table.action.copy_platform_id', { platform: platformStyle[hoverWinnerRow.platform].label })"
          :aria-label="t('bid_list.table.action.copy_platform_id', { platform: platformStyle[hoverWinnerRow.platform].label })"
          type="button"
          size="small"
          text
          severity="secondary"
          @click="copyCommunityId"
        >
          <i class="pi pi-copy" />
        </Button>
      </div>
    </Popover>
  </div>
</template>

<style scoped>
/* 得標清單表格：橫向捲軸常駐顯示，提示右側還有欄位可看（參照訂單管理 §7.5） */
:deep(.bid-list-main-table .p-datatable-table-container) {
  overflow-x: scroll !important;
  scrollbar-gutter: stable;
}
:deep(.bid-list-main-table .p-datatable-table-container::-webkit-scrollbar) {
  height: 12px !important;
  width: 12px !important;
  -webkit-appearance: none !important;
  background: var(--p-surface-100) !important;
}
:deep(.bid-list-main-table .p-datatable-table-container::-webkit-scrollbar-track) {
  background: var(--p-surface-100) !important;
  border-radius: 6px !important;
}
:deep(.bid-list-main-table .p-datatable-table-container::-webkit-scrollbar-thumb) {
  background: var(--p-surface-400) !important;
  border-radius: 6px !important;
  border: 2px solid var(--p-surface-100) !important;
}
:deep(.bid-list-main-table .p-datatable-table-container::-webkit-scrollbar-thumb:hover) {
  background: var(--p-surface-500) !important;
}
</style>
