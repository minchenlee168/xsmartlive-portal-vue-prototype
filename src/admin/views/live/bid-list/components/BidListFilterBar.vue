<script setup lang="ts">
/**
 * 得標清單頁篩選區
 * — 第一列：搜尋類型 + 關鍵字 + 日期區間
 * — 第二列：分組方式 / 來源（label 皆收合為下拉提示文字）/ 重設 / 儲存；所有條件變更即時篩選，無套用按鈕
 * — 排序移至表格表頭 icon（BidListTable）；歷史價格查詢移至頁面標題列的文字按鈕
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useGlobalToast } from '@/admin/composables/useGlobalToast';
import type {
  BidListBidStatusFilter,
  BidListDisplayType,
  BidListInviteCodeFilter,
  BidListOrderMethod,
  BidListProductAttribute,
  BidListSavedFilter,
  BidListSearchType,
  BidListSourceType,
} from '../composables/useBidListFilter';

interface Props {
  searchType: BidListSearchType;
  keyword: string;
  displayType: BidListDisplayType;
  dateRange: [Date | null, Date | null] | null;
  sourceType: BidListSourceType | null;
  /** 標單狀態（null = 未選取）；與快速篩選連動 */
  bidStatus: BidListBidStatusFilter | null;
  orderMethod: BidListOrderMethod | null;
  inviteCode: BidListInviteCodeFilter | null;
  productAttributes: BidListProductAttribute[];
  /** 場次多選（空陣列 = 不限） */
  session: string[];
  /** 場次下拉選項 */
  sessionOptions: { label: string; value: string }[];
  /** 多購物車名稱下拉選項（搜尋類型選「多購物車名稱」時，關鍵字改為此下拉挑選） */
  multiCartNameOptions: { label: string; value: string }[];
  /** 已儲存的常用篩選 */
  savedFilters: BidListSavedFilter[];
  /** 批次模式中：停用「以同一標方式顯示」分組（群組檢視無勾選框，與批次選取衝突） */
  isBatchMode?: boolean;
}

interface Emits {
  (event: 'update:searchType', value: BidListSearchType): void;
  (event: 'update:keyword', value: string): void;
  (event: 'update:displayType', value: BidListDisplayType): void;
  (event: 'update:dateRange', value: [Date | null, Date | null] | null): void;
  (event: 'update:sourceType', value: BidListSourceType | null): void;
  (event: 'update:bidStatus', value: BidListBidStatusFilter | null): void;
  (event: 'update:orderMethod', value: BidListOrderMethod | null): void;
  (event: 'update:inviteCode', value: BidListInviteCodeFilter | null): void;
  (event: 'update:productAttributes', value: BidListProductAttribute[]): void;
  (event: 'update:session', value: string[]): void;
  (event: 'search'): void;
  (event: 'reset'): void;
  (event: 'saveFilter'): void;
  (event: 'applySavedFilter', id: number): void;
  (event: 'removeSavedFilter', id: number): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const { t } = useI18n();
const { showInfo } = useGlobalToast();

const searchTypeOptions = computed(() => [
  { value: 'facebookName', label: t('bid_list.filter.search_type.facebook_name') },
  { value: 'facebookOrLivebuyId', label: t('bid_list.filter.search_type.facebook_or_livebuy_id') },
  { value: 'session', label: t('bid_list.filter.search_type.session') },
  { value: 'productName', label: t('bid_list.filter.search_type.product_name') },
  { value: 'specNote', label: t('bid_list.filter.search_type.spec_note') },
  { value: 'multiCartName', label: t('bid_list.filter.search_type.multi_cart_name') },
  { value: 'bidNumber', label: t('bid_list.filter.search_type.bid_number') },
]);

/** 分組方式下拉：僅保留 3 種分組情境（狀態情境由快速篩選／標單狀態下拉切換） */
const displayTypeOptions = computed(() => [
  {
    value: 'groupBySameBid',
    label: t('bid_list.filter.display_type.group_by_same_bid'),
    disabled: props.isBatchMode === true,
  },
  { value: 'multiCart', label: t('bid_list.filter.display_type.multi_cart') },
]);

const sourceTypeOptions = computed(() => [
  { value: 'fb', label: t('bid_list.filter.source_type.fb') },
  { value: 'ig', label: t('bid_list.filter.source_type.ig') },
  { value: 'tiktok', label: t('bid_list.filter.source_type.tiktok') },
  { value: 'livebuy', label: t('bid_list.filter.source_type.livebuy') },
]);

const orderMethodOptions = computed(() => [
  { value: 'live', label: t('bid_list.filter.order_method.live') },
  { value: 'post', label: t('bid_list.filter.order_method.post') },
  { value: 'community', label: t('bid_list.filter.order_method.community') },
]);

const inviteCodeOptions = computed(() => [
  { value: 'has', label: t('bid_list.filter.invite_code.has') },
  { value: 'none', label: t('bid_list.filter.invite_code.none') },
]);

const bidStatusOptions = computed(() => [
  { value: 'unfinished', label: t('bid_list.filter.bid_status.unfinished') },
  { value: 'completed', label: t('bid_list.filter.bid_status.completed') },
  { value: 'transferredToOrder', label: t('bid_list.filter.bid_status.transferred_to_order') },
  { value: 'discarded', label: t('bid_list.filter.bid_status.discarded') },
]);

const productAttributeOptions = computed(() => [
  { value: 'preorder', label: t('bid_list.filter.product_attributes.preorder') },
  { value: 'addOn', label: t('bid_list.filter.product_attributes.add_on') },
  { value: 'freeShipping', label: t('bid_list.filter.product_attributes.free_shipping') },
]);

const localSearchType = computed({
  get: () => props.searchType,
  set: (value) => emit('update:searchType', value),
});
const localKeyword = computed({
  get: () => props.keyword,
  set: (value) => emit('update:keyword', value),
});
/** 分組方式下拉僅對應 3 種分組值；showAll／狀態情境視為未選取，清除時回復 showAll */
const groupDisplayTypeValues: BidListDisplayType[] = ['groupBySameBid', 'multiCart'];
const localDisplayType = computed<BidListDisplayType | null>({
  get: () => (groupDisplayTypeValues.includes(props.displayType) ? props.displayType : null),
  set: (value) => emit('update:displayType', value ?? 'showAll'),
});
const localDateRange = computed({
  get: () => props.dateRange,
  set: (value) => emit('update:dateRange', value),
});
const localSourceType = computed({
  get: () => props.sourceType,
  set: (value) => emit('update:sourceType', value),
});
const localOrderMethod = computed({
  get: () => props.orderMethod,
  set: (value) => emit('update:orderMethod', value),
});
const localInviteCode = computed({
  get: () => props.inviteCode,
  set: (value) => emit('update:inviteCode', value),
});
const localBidStatus = computed({
  get: () => props.bidStatus,
  set: (value) => emit('update:bidStatus', value),
});
const localProductAttributes = computed({
  get: () => props.productAttributes,
  set: (value) => emit('update:productAttributes', value),
});
const localSession = computed({
  get: () => props.session,
  set: (value) => emit('update:session', value),
});

/** 商品屬性觸發鈕文字：有選取時顯示「商品屬性（n）」 */
const productAttributesTriggerLabel = computed(() =>
  t('bid_list.filter.product_attributes.trigger', { count: props.productAttributes.length }),
);

/** 場次觸發鈕文字：有選取時顯示「場次（n）」 */
const sessionTriggerLabel = computed(() =>
  t('bid_list.filter.session.trigger_label', { count: props.session.length }),
);

/** keyword 輸入框 placeholder 依當前搜尋條件即時對應 */
const keywordPlaceholder = computed(() =>
  t(`bid_list.filter.placeholder.by_search_type.${localSearchType.value}`),
);

/** 搜尋類型為「多購物車名稱」時，關鍵字改以下拉挑選現有多購物車名稱（可清除） */
const isMultiCartSearch = computed(() => localSearchType.value === 'multiCartName');
/** 多購物車名稱下拉綁定：清除時 PrimeVue 回傳 null，統一轉回空字串以符合 keyword 型別 */
const localMultiCartName = computed<string | null>({
  get: () => props.keyword || null,
  set: (value) => emit('update:keyword', value ?? ''),
});

type DateRangeQuickKey = 'today' | 'last7Days' | 'last30Days';

const dateRangeQuickOptions = computed<{ value: DateRangeQuickKey; label: string }[]>(() => [
  { value: 'today', label: t('bid_list.filter.date_quick.today') },
  { value: 'last7Days', label: t('bid_list.filter.date_quick.last_7_days') },
  { value: 'last30Days', label: t('bid_list.filter.date_quick.last_30_days') },
]);

/** 快速套用起訖日：迄日皆為今天，起日含今天往前推 */
function applyDateRangeQuick(option: { value: DateRangeQuickKey; label: string }) {
  const end = new Date();
  end.setHours(0, 0, 0, 0);
  const start = new Date(end);
  if (option.value === 'last7Days') start.setDate(start.getDate() - 6);
  else if (option.value === 'last30Days') start.setDate(start.getDate() - 29);
  localDateRange.value = [start, end];
  showInfo({ detail: t('bid_list.filter.toast.date_quick_filled', { label: option.label }) });
}

/** 未設定任何下拉條件時不可儲存常用篩選（標單狀態已透過 displayType 反映） */
const canSaveFilter = computed(
  () =>
    props.displayType !== 'showAll' ||
    props.sourceType !== null ||
    props.orderMethod !== null ||
    props.inviteCode !== null ||
    props.productAttributes.length > 0 ||
    props.session.length > 0,
);
</script>

<template>
  <div class="flex flex-col gap-3">
    <!-- 第一列：搜尋類型 + 關鍵字 + 日期區間 -->
    <div class="flex flex-wrap items-center gap-3">
      <Select
        v-model="localSearchType"
        :options="searchTypeOptions"
        option-label="label"
        option-value="value"
        :aria-label="t('bid_list.filter.label.search_by')"
        class="w-56"
      />

      <!-- 多購物車名稱：關鍵字改為下拉挑選現有名稱；其餘搜尋類型維持文字輸入 -->
      <Select
        v-if="isMultiCartSearch"
        v-model="localMultiCartName"
        :options="multiCartNameOptions"
        option-label="label"
        option-value="value"
        :placeholder="t('bid_list.filter.placeholder.multi_cart_select')"
        :empty-message="t('bid_list.filter.multi_cart.empty')"
        show-clear
        class="w-72"
      />
      <InputText
        v-else
        v-model="localKeyword"
        :placeholder="keywordPlaceholder"
        class="w-72"
      />

      <DatePicker
        v-model="localDateRange"
        selection-mode="range"
        date-format="yy/mm/dd"
        :placeholder="t('bid_list.filter.placeholder.date_range')"
        show-icon
        class="w-72"
      />

      <div class="flex items-center gap-2">
        <button
          v-for="option in dateRangeQuickOptions"
          :key="option.value"
          type="button"
          class="rounded-full border border-surface-300 px-2.5 py-1 text-xs text-surface-700 hover:bg-surface-100 dark:border-surface-600 dark:text-surface-200 dark:hover:bg-surface-800"
          @click="applyDateRangeQuick(option)"
        >
          {{ option.label }}
        </button>
      </div>
    </div>

    <!-- 第二列：收單方式 / 標單來源 / 標單狀態 / 標單商品屬性 / 推薦碼 / 分組方式 / 清除 / 套用 -->
    <div class="flex flex-wrap items-center gap-3">
      <Select
        v-model="localOrderMethod"
        :options="orderMethodOptions"
        option-label="label"
        option-value="value"
        :placeholder="t('bid_list.filter.placeholder.order_method')"
        show-clear
        class="w-36"
      />

      <Select
        v-model="localSourceType"
        :options="sourceTypeOptions"
        option-label="label"
        option-value="value"
        :placeholder="t('bid_list.filter.placeholder.source')"
        show-clear
        class="w-36"
      />

      <MultiSelect
        v-model="localSession"
        :options="sessionOptions"
        option-label="label"
        option-value="value"
        :placeholder="t('bid_list.filter.placeholder.session')"
        :show-toggle-all="false"
        :max-selected-labels="0"
        :selected-items-label="sessionTriggerLabel"
        :filter="true"
        :filter-placeholder="t('bid_list.filter.session.filter_placeholder')"
        class="w-40"
      >
        <template #header>
          <button
            v-if="localSession.length > 0"
            type="button"
            class="flex w-full items-center gap-2 border-b border-surface-200 px-3 py-2 text-sm text-primary-600 hover:bg-surface-50 dark:border-surface-700 dark:text-primary-400 dark:hover:bg-surface-800"
            @click="localSession = []"
          >
            <FontAwesomeIcon :icon="['fas', 'xmark']" />
            {{ t('bid_list.filter.session.clear', { count: localSession.length }) }}
          </button>
        </template>
      </MultiSelect>

      <Select
        v-model="localBidStatus"
        :options="bidStatusOptions"
        option-label="label"
        option-value="value"
        :placeholder="t('bid_list.filter.placeholder.bid_status')"
        show-clear
        class="w-36"
      />

      <MultiSelect
        v-model="localProductAttributes"
        :options="productAttributeOptions"
        option-label="label"
        option-value="value"
        :placeholder="t('bid_list.filter.placeholder.product_attributes')"
        :show-toggle-all="false"
        :max-selected-labels="0"
        :selected-items-label="productAttributesTriggerLabel"
        class="w-48"
      >
        <template #header>
          <button
            v-if="localProductAttributes.length > 0"
            type="button"
            class="flex w-full items-center gap-2 border-b border-surface-200 px-3 py-2 text-sm text-primary-600 hover:bg-surface-50 dark:border-surface-700 dark:text-primary-400 dark:hover:bg-surface-800"
            @click="localProductAttributes = []"
          >
            <FontAwesomeIcon :icon="['fas', 'xmark']" />
            {{ t('bid_list.filter.product_attributes.clear', { count: localProductAttributes.length }) }}
          </button>
        </template>
      </MultiSelect>

      <Select
        v-model="localInviteCode"
        :options="inviteCodeOptions"
        option-label="label"
        option-value="value"
        :placeholder="t('bid_list.filter.placeholder.invite_code')"
        show-clear
        class="w-36"
      />

      <Select
        v-model="localDisplayType"
        :options="displayTypeOptions"
        option-label="label"
        option-value="value"
        option-disabled="disabled"
        :placeholder="t('bid_list.filter.placeholder.display_type')"
        show-clear
        class="w-60"
      />

      <!-- 匯出按鈕（由頁面注入，緊鄰分組方式下拉右側） -->
      <slot name="display-type-append" />

      <!-- 搜尋：主色 CTA，選完條件按此才對表格套用（快速篩選 chip 例外，即時生效） -->
      <Button
        type="button"
        :label="t('bid_list.filter.button.search')"
        @click="emit('search')"
      />

      <Button
        type="button"
        severity="secondary"
        outlined
        :label="t('bid_list.filter.button.reset')"
        @click="emit('reset')"
      />

      <Button
        type="button"
        outlined
        :disabled="!canSaveFilter"
        :label="t('bid_list.filter.button.save_filter')"
        @click="emit('saveFilter')"
      />
    </div>

    <!-- 常用篩選快速套用（點名稱套用下拉條件、點 ✕ 刪除；不影響關鍵字與日期） -->
    <div
      v-if="savedFilters.length > 0"
      class="flex flex-wrap items-center gap-2"
    >
      <span
        v-for="savedFilter in savedFilters"
        :key="savedFilter.id"
        class="inline-flex items-center overflow-hidden rounded-full border border-surface-300 dark:border-surface-600"
      >
        <button
          type="button"
          class="px-2.5 py-1 text-xs text-surface-700 hover:bg-surface-100 dark:text-surface-200 dark:hover:bg-surface-800"
          @click="emit('applySavedFilter', savedFilter.id)"
        >
          {{ savedFilter.name }}
        </button>
        <button
          type="button"
          class="px-1.5 py-1 text-xs text-surface-400 hover:bg-surface-100 hover:text-red-500 dark:hover:bg-surface-800"
          :aria-label="t('bid_list.saved_filter.remove')"
          @click="emit('removeSavedFilter', savedFilter.id)"
        >
          <FontAwesomeIcon :icon="['fas', 'xmark']" />
        </button>
      </span>
    </div>
  </div>
</template>
