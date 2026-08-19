<script setup lang="ts">
/**
 * 編輯資料 Dialog（對應舊系統 saleOrderList 列內「編輯資料」）
 * — 欄位對照截圖 backend_得標清單4/5 並補齊舊系統編輯表單欄位：直播來源（唯讀）、類型、
 *   多購物車名稱/配送類型（類型為多購物車時）、得標者資料（唯讀）、場次、商品名稱/編號、
 *   規格/規格備註、產品照片（唯讀）＋初始/當前庫存、單價/數量/重量（已轉單鎖定）
 * — footer 對照舊系統：手動下標單／批次修改／儲存／返回
 * — 批次修改範圍對照舊系統：同商品＋同一批建立時間＋未轉單（跨頁、不受列表勾選影響）
 */
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useGlobalToast } from '@/admin/composables/useGlobalToast';
import { useGlobalDialog } from '@/admin/composables/useGlobalDialog';
import WinnerProfileDialog from './WinnerProfileDialog.vue';
import type { BidListRow } from '../composables/useBidListMock';
import { stripSpecPrefix } from '../utils/spec';

interface Props {
  visible: boolean;
  row: BidListRow | null;
}

interface Emits {
  (event: 'update:visible', value: boolean): void;
  (event: 'save'): void;
  (event: 'batchSave'): void;
  (event: 'manualBid'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const { t } = useI18n();
const { confirm } = useGlobalDialog();
const { showInfo } = useGlobalToast();

const localVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value),
});

type LiveSource = 'fb' | 'ig' | 'tiktok' | 'livebuy';
type BidType = 'multiCart' | 'preorder';

const liveSource = ref<LiveSource>('fb');
const bidType = ref<BidType>('multiCart');
const sessionName = ref('');
const unitPrice = ref<number>(0);
const quantity = ref<number>(1);
const specName = ref('');

const productName = ref('');
const productCode = ref('');
const weight = ref<number>(0);

/** 多購物車設定（類型為多購物車時顯示；對照舊系統 factory_name / logistics_type） */
type LogisticsType = 'normal' | 'cold';
const multiCartName = ref<string | null>(null);
const multiCartNewName = ref('');
const logisticsType = ref<LogisticsType>('normal');

/** mock 多購物車名稱選項：該列名稱 + 常見範例 */
const multiCartOptions = computed<string[]>(() => {
  const base = ['水果', '零食組', '社團 A'];
  const current = props.row?.multiCartName;
  return current && !base.includes(current) ? [current, ...base] : base;
});

const logisticsOptions = computed<Array<{ value: LogisticsType; label: string }>>(() => [
  { value: 'normal', label: t('bid_list.edit_bid.option.logistics_normal') },
  { value: 'cold', label: t('bid_list.edit_bid.option.logistics_cold') },
]);

/** 設定多購物車運費（mockup 僅示意） */
function handleSetFreight() {
  showInfo({ detail: t('bid_list.edit_bid.toast.freight_link_mock') });
}

/** 標單已轉單／已完成時鎖定金額欄位（對照舊系統「#標單已轉無法修改此欄位」） */
const isTransferred = computed(
  () =>
    props.row?.status === 'transferredToOrder' || props.row?.status === 'transferredToComplete',
);

/** mock 規格選項：該列規格（去「規格:」前綴，與表格一致）+ 常見尺寸 */
const specOptions = computed<string[]>(() => {
  const base = ['S', 'M', 'L', 'XL'];
  const current = stripSpecPrefix(props.row?.specNote);
  return current && !base.includes(current) ? [current, ...base] : base;
});

// ── 規格呈現分類：與主表格規格欄一致（組合→列子商品、待選→待選規格、無值→無規格、否則規格值） ──
/** 組合商品（有子商品清單）：規格改列子商品內容，不提供單一規格 Select */
const isComboSpec = computed(() => (props.row?.bundleItems?.length ?? 0) > 0);
/** 後選規格（買家先下標、規格待補選）：Select 以空值 + placeholder 呈現，供指派 */
const isPendingSpec = computed(() => props.row?.isSpecPending === true);
/** 去前綴後的具體規格值（無則空字串） */
const specConcreteValue = computed(() => stripSpecPrefix(props.row?.specNote));
/** 無規格（非組合、非待選、也無規格值）：唯讀顯示「無規格」 */
const isNoSpec = computed(
  () => !isComboSpec.value && !isPendingSpec.value && !specConcreteValue.value,
);
/** 當前庫存文字：具體規格顯示「XL：9」，組合／待選／無規格僅顯示數量 */
const currentStockText = computed(() =>
  !isComboSpec.value && !isPendingSpec.value && specConcreteValue.value
    ? `${specConcreteValue.value}：9`
    : '9',
);

const liveSourceOptions: Array<{ value: LiveSource; label: string }> = [
  { value: 'fb', label: 'Facebook' },
  { value: 'ig', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'livebuy', label: 'LiveBuy' },
];

// 類型僅提供多購物車／預購；一般購物車（facebookPage）標單為預設狀態，不列為可選項
const bidTypeOptions = computed<Array<{ value: BidType; label: string }>>(() => [
  { value: 'multiCart', label: t('bid_list.cart_type.multi') },
  { value: 'preorder', label: t('bid_list.cart_type.preorder') },
]);

/** 開啟時以該列資料初始化表單 */
watch(localVisible, (isOpen) => {
  if (!isOpen || !props.row) return;
  const row = props.row;
  liveSource.value =
    row.platform === 'instagram'
      ? 'ig'
      : row.platform === 'tiktok'
        ? 'tiktok'
        : row.platform === 'livebuy'
          ? 'livebuy'
          : 'fb';
  // 有預購 tag（isPreorder 或來源為預購）→ 預購；其餘一律預設多購物車
  const isPreorderAttribute = row.isPreorder === true || row.bidOriginType === 'preorder';
  bidType.value = isPreorderAttribute ? 'preorder' : 'multiCart';
  sessionName.value = row.sessionName;
  unitPrice.value = row.quantity > 0 ? Math.round(row.totalAmount / row.quantity) : row.totalAmount;
  quantity.value = row.quantity;
  // 待選規格 → 空值（顯示 placeholder 待指派）；一般 → 去前綴規格值；組合／無規格不顯示 Select，值不影響
  specName.value = row.isSpecPending ? '' : stripSpecPrefix(row.specNote) || 'XL';
  productName.value = row.productName;
  productCode.value = '';
  weight.value = 0;
  multiCartName.value = row.multiCartName ?? null;
  multiCartNewName.value = '';
  logisticsType.value = 'normal';
});

/** 得標人資料 dialog（點擊得標者區塊開啟） */
const isWinnerProfileOpen = ref(false);

function handleSave() {
  localVisible.value = false;
  emit('save');
}

/** 批次修改：先提示套用範圍（同商品＋同批建立＋未轉單，跨頁不受勾選影響）再送出 */
async function handleBatchSave() {
  const accepted = await confirm({
    message: t('bid_list.edit_bid.dialog.batch_scope_confirm'),
  });
  if (!accepted) return;
  localVisible.value = false;
  emit('batchSave');
}

function handleManualBid() {
  localVisible.value = false;
  emit('manualBid');
}
</script>

<template>
  <Dialog
    v-model:visible="localVisible"
    modal
    :header="t('bid_list.edit_bid.title')"
    :style="{ width: '46rem' }"
  >
    <div
      v-if="row"
      class="flex flex-col gap-4"
    >
      <!-- 收單方式（唯讀） -->
      <div class="flex items-center gap-3">
        <span class="text-sm font-medium text-slate-700 dark:text-slate-200">
          {{ t('bid_list.edit_bid.field.order_method') }}
        </span>
        <span class="text-sm text-slate-500 dark:text-slate-400">
          {{ t(`bid_list.filter.order_method.${row.orderMethod}`) }}
        </span>
      </div>

      <!-- 標單來源（唯讀，依 table 標單來源 icon／row.platform 顯示：FB／IG／TikTok／LiveBuy） -->
      <div class="flex flex-col gap-2">
        <label class="text-sm font-medium text-slate-700 dark:text-slate-200">
          {{ t('bid_list.edit_bid.field.live_source') }}
        </label>
        <div class="flex items-center gap-5">
          <label
            v-for="option in liveSourceOptions"
            :key="option.value"
            class="inline-flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400"
          >
            <RadioButton
              v-model="liveSource"
              :value="option.value"
              disabled
            />
            {{ option.label }}
          </label>
        </div>
      </div>

      <!-- 類型 -->
      <div class="flex flex-col gap-2">
        <label class="text-sm font-medium text-slate-700 dark:text-slate-200">
          {{ t('bid_list.cart_type.label') }}
        </label>
        <div class="flex items-center gap-5">
          <label
            v-for="option in bidTypeOptions"
            :key="option.value"
            class="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200 cursor-pointer"
          >
            <RadioButton
              v-model="bidType"
              :value="option.value"
            />
            {{ option.label }}
          </label>
        </div>
      </div>

      <!-- 多購物車設定（僅類型為多購物車時顯示） -->
      <div
        v-if="bidType === 'multiCart'"
        class="flex flex-col gap-4 rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-3"
      >
        <div class="flex flex-col gap-2">
          <label class="text-sm font-medium text-slate-700 dark:text-slate-200">
            {{ t('bid_list.edit_bid.field.multi_cart_name') }}
          </label>
          <div class="flex items-center gap-3">
            <Select
              v-model="multiCartName"
              :options="multiCartOptions"
              show-clear
              :placeholder="t('bid_list.edit_bid.placeholder.multi_cart_select')"
              class="flex-1"
            />
            <span class="text-sm text-slate-400 dark:text-slate-500">
              {{ t('bid_list.edit_bid.text.or') }}
            </span>
            <InputText
              v-model="multiCartNewName"
              :placeholder="t('bid_list.edit_bid.placeholder.multi_cart_new_name')"
              class="flex-1"
            />
          </div>
        </div>
        <div class="flex flex-col gap-2">
          <label class="text-sm font-medium text-slate-700 dark:text-slate-200">
            {{ t('bid_list.edit_bid.field.logistics_type') }}
          </label>
          <div class="flex items-center gap-5">
            <label
              v-for="option in logisticsOptions"
              :key="option.value"
              class="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200 cursor-pointer"
            >
              <RadioButton
                v-model="logisticsType"
                :value="option.value"
              />
              {{ option.label }}
            </label>
            <button
              type="button"
              class="ml-auto text-sm text-primary-500 dark:text-primary-400 hover:underline cursor-pointer"
              @click="handleSetFreight"
            >
              {{ t('bid_list.edit_bid.action.set_multi_cart_freight') }}
            </button>
          </div>
        </div>
      </div>

      <!-- 得標者資料（唯讀，點擊開得標人資料 dialog） -->
      <div class="flex flex-col gap-2">
        <label class="text-sm font-medium text-slate-700 dark:text-slate-200">
          {{ t('bid_list.edit_bid.section.winner_info') }}
        </label>
        <button
          type="button"
          class="group flex items-center gap-6 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 px-4 py-3 text-sm text-left transition-colors cursor-pointer"
          @click="isWinnerProfileOpen = true"
        >
          <div class="flex flex-col gap-1">
            <span class="text-xs text-slate-400 dark:text-slate-500">
              {{ t('bid_list.winner_profile.field.member_name') }}
            </span>
            <span class="text-slate-700 dark:text-slate-200">{{ row.winner.name }}</span>
          </div>
          <div class="flex flex-col gap-1">
            <span class="text-xs text-slate-400 dark:text-slate-500">
              {{ t('bid_list.winner_profile.field.facebook_id') }}
            </span>
            <span class="text-slate-700 dark:text-slate-200 tabular-nums">{{ row.winner.facebookId }}</span>
          </div>
          <span class="ml-auto inline-flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500 group-hover:text-primary-500 dark:group-hover:text-primary-400 transition-colors whitespace-nowrap">
            {{ t('bid_list.edit_bid.hint.winner_click') }}
            <FontAwesomeIcon :icon="['fas', 'chevron-right']" />
          </span>
        </button>
      </div>

      <!-- 無需更動提示 -->
      <p class="text-sm font-medium text-red-600 dark:text-red-400">
        {{ t('bid_list.edit_bid.hint.no_change') }}
      </p>

      <!-- 場次 -->
      <div class="flex flex-col gap-2">
        <label class="text-sm font-medium text-slate-700 dark:text-slate-200">
          {{ t('bid_list.edit_bid.field.session') }}
        </label>
        <InputText v-model="sessionName" />
      </div>

      <!-- 商品名稱／商品編號（可編輯；編號批次更新） -->
      <div class="grid grid-cols-2 gap-6">
        <div class="flex flex-col gap-2">
          <label class="text-sm font-medium text-slate-700 dark:text-slate-200">
            {{ t('bid_list.edit_bid.field.product_name') }}
          </label>
          <InputText v-model="productName" />
        </div>
        <div class="flex flex-col gap-2">
          <label class="text-sm font-medium text-slate-700 dark:text-slate-200">
            {{ t('bid_list.edit_bid.field.product_code') }}
          </label>
          <InputText v-model="productCode" />
        </div>
      </div>

      <!-- 規格（與主表格規格欄一致：組合→列子商品內容；待選→空值 Select + placeholder；無規格→唯讀；否則→可編輯 Select） -->
      <div class="grid grid-cols-2 gap-6">
        <div class="flex flex-col gap-2">
          <label class="text-sm font-medium text-slate-700 dark:text-slate-200">
            {{ t('bid_list.edit_bid.field.spec') }}
          </label>
          <ul
            v-if="isComboSpec"
            class="flex flex-col gap-1 text-sm text-slate-700 dark:text-slate-200"
          >
            <li
              v-for="(item, index) in row.bundleItems"
              :key="index"
              class="whitespace-nowrap"
            >
              {{ item.spec ? `${item.name} / ${item.spec}` : item.name }} ×{{ item.qty }}
            </li>
          </ul>
          <div
            v-else-if="isNoSpec"
            class="text-sm text-slate-500 dark:text-slate-400"
          >
            {{ t('bid_list.table.cell.spec_none') }}
          </div>
          <Select
            v-else
            v-model="specName"
            :options="specOptions"
            :placeholder="isPendingSpec ? t('bid_list.table.cell.spec_pending') : undefined"
            class="w-full"
          />
        </div>
      </div>

      <!-- 產品照片（唯讀）＋總庫存數（唯讀） -->
      <div class="flex items-center gap-4 rounded-lg bg-slate-50 dark:bg-slate-800 px-4 py-3 text-sm">
        <div class="flex flex-col items-center gap-2 shrink-0">
          <img
            v-if="row.productImage"
            :src="row.productImage"
            :alt="row.productName"
            class="w-20 h-20 object-cover rounded-lg border border-slate-200 dark:border-slate-700"
          />
          <div
            v-else
            class="w-20 h-20 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center px-1 text-center text-xs text-red-600 dark:text-red-400"
          >
            {{ t('bid_list.edit_bid.text.no_image') }}
          </div>
        </div>
        <div class="flex-1 grid grid-cols-2 gap-x-6 gap-y-3">
          <div class="flex flex-col gap-1">
            <span class="text-xs text-slate-400 dark:text-slate-500">
              {{ t('bid_list.edit_bid.field.initial_stock') }}
            </span>
            <span class="text-slate-700 dark:text-slate-200">10</span>
          </div>
          <div class="flex flex-col gap-1">
            <span class="text-xs text-slate-400 dark:text-slate-500">
              {{ t('bid_list.edit_bid.field.current_stock') }}
            </span>
            <span class="text-slate-700 dark:text-slate-200">{{ currentStockText }}</span>
          </div>
        </div>
      </div>

      <!-- 單價／數量／重量 -->
      <div class="grid grid-cols-3 gap-6">
        <div class="flex flex-col gap-2">
          <label class="text-sm font-medium text-slate-700 dark:text-slate-200">
            {{ t('bid_list.edit_bid.field.unit_price') }}
          </label>
          <InputNumber
            v-model="unitPrice"
            :min="0"
            :disabled="isTransferred"
            fluid
          />
          <span
            v-if="isTransferred"
            class="text-xs text-red-600 dark:text-red-400"
          >
            {{ t('bid_list.edit_bid.hint.transferred_locked') }}
          </span>
          <span
            v-else
            class="text-xs text-red-600 dark:text-red-400"
          >
            {{ t('bid_list.edit_bid.hint.batch_price_note') }}
          </span>
        </div>
        <div class="flex flex-col gap-2">
          <label class="text-sm font-medium text-slate-700 dark:text-slate-200">
            {{ t('bid_list.edit_bid.field.quantity') }}
            <span
              v-if="row.specNote"
              class="ml-1 text-xs font-normal text-red-600 dark:text-red-400"
            >
              {{ t('bid_list.edit_bid.hint.spec_stock_set') }}
            </span>
          </label>
          <InputNumber
            v-model="quantity"
            :min="1"
            show-buttons
            button-layout="horizontal"
            :disabled="isTransferred"
            fluid
          >
            <template #incrementbuttonicon>
              <FontAwesomeIcon :icon="['fas', 'plus']" />
            </template>
            <template #decrementbuttonicon>
              <FontAwesomeIcon :icon="['fas', 'minus']" />
            </template>
          </InputNumber>
          <span class="text-xs text-red-600 dark:text-red-400">
            {{ t('bid_list.edit_bid.hint.batch_qty_locked') }}
          </span>
        </div>
        <div class="flex flex-col gap-2">
          <label class="text-sm font-medium text-slate-700 dark:text-slate-200">
            {{ t('bid_list.edit_bid.field.weight') }}
          </label>
          <InputNumber
            v-model="weight"
            :min="0"
            :max-fraction-digits="2"
            :disabled="isTransferred"
            fluid
          />
          <span class="text-xs text-red-600 dark:text-red-400">
            {{ t('bid_list.edit_bid.hint.batch_weight_note') }}
          </span>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="flex items-center justify-between w-full">
        <Button
          type="button"
          severity="secondary"
          outlined
          :label="t('bid_list.edit_bid.button.manual_bid')"
          @click="handleManualBid"
        />
        <div class="flex items-center gap-2">
          <Button
            type="button"
            severity="secondary"
            variant="text"
            :label="t('bid_list.edit_bid.button.back')"
            @click="localVisible = false"
          />
          <Button
            type="button"
            severity="secondary"
            outlined
            :label="t('bid_list.edit_bid.button.batch_save')"
            @click="handleBatchSave"
          />
          <Button
            type="button"
            :label="t('bid_list.edit_bid.button.save')"
            @click="handleSave"
          />
        </div>
      </div>
    </template>
  </Dialog>

  <WinnerProfileDialog
    v-model:visible="isWinnerProfileOpen"
    :winner="row?.winner ?? null"
    :platform="row?.platform ?? null"
  />
</template>
