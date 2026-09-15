<script setup lang="ts">
/**
 * 紅利點數活動「發送紀錄」Dialog（原型版，唯讀查閱）
 * — 三段式：篩選工具列（使用狀況 / 篩選類別 / 關鍵字 + 搜尋 + Excel 匯出）／活動摘要（唯讀 KV）／明細 DataTable
 * — 明細為示範取樣資料（createMockSendRecords）；未發送欄位以「—」佔位
 * — Excel 匯出於原型階段僅 toast 回饋
 */
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { useGlobalToast } from '@/admin/composables/useGlobalToast';
import { createMockSendRecords } from '../mockData';
import {
  BonusGiftType,
  type BonusPointsRow,
  type BonusSendRecord,
} from '../types';
import BonusOrderItemsDialog from './BonusOrderItemsDialog.vue';

const props = defineProps<{
  /** 要看明細的活動；為 null 時不載入 */
  row: BonusPointsRow | null;
}>();

const visible = defineModel<boolean>('visible', { required: true });

const { t } = useI18n();
const { showInfo } = useGlobalToast();

type CategoryFilter = 'member_name' | 'member_id' | 'order_no';

const category = ref<CategoryFilter>('member_name');
const appliedCategory = ref<CategoryFilter>('member_name');
const keyword = ref('');
const appliedKeyword = ref('');

const records = ref<BonusSendRecord[]>([]);

// 分頁（訂單卡片列表，client 端分頁）
const ROWS = 10;
const currentPage = ref(1);

// 開窗時依活動產出示範明細；換活動或重開都重建，並重置篩選
watch([visible, () => props.row], ([isOpen]) => {
  if (!isOpen || !props.row) return;
  records.value = createMockSendRecords(props.row);
  category.value = 'member_name';
  appliedCategory.value = 'member_name';
  keyword.value = '';
  appliedKeyword.value = '';
  currentPage.value = 1;
});

const categoryOptions = computed<{ label: string; value: CategoryFilter }[]>(() => [
  { label: t('bonus_points.records.category_option.member_name'), value: 'member_name' },
  { label: t('bonus_points.records.category_option.member_id'), value: 'member_id' },
  { label: t('bonus_points.records.category_option.order_no'), value: 'order_no' },
]);

function onSearch() {
  appliedCategory.value = category.value;
  appliedKeyword.value = keyword.value;
  currentPage.value = 1;
}

const filteredRecords = computed<BonusSendRecord[]>(() => {
  const kw = appliedKeyword.value.trim().toLowerCase();
  return records.value.filter((r) => {
    if (kw.length === 0) return true;
    const field
      = appliedCategory.value === 'member_name' ? r.memberName
        : appliedCategory.value === 'member_id' ? r.memberRef
          : r.orderNo;
    return field.toLowerCase().includes(kw);
  });
});

// 當前頁資料
const pagedRecords = computed<BonusSendRecord[]>(() =>
  filteredRecords.value.slice((currentPage.value - 1) * ROWS, currentPage.value * ROWS));

// 訂單摘要：筆數與訂單總金額（已抵扣金額加總）
const orderCount = computed(() => filteredRecords.value.length);
const totalAmount = computed(() =>
  filteredRecords.value.reduce((sum, r) => sum + r.amountAfterDeduction, 0));

// 篩選結果變動 → 回第一頁
watch(filteredRecords, () => { currentPage.value = 1; });

function onPage(event: { page: number }) {
  currentPage.value = event.page + 1;
}

// ---- 摘要呈現 ----
const formatNumber = (value: number) => value.toLocaleString('en-US');
/** 頭像文字：取會員名稱首字 */
const avatarText = (name: string) => name.charAt(0);

const sourceLabel = computed(() =>
  props.row ? t(`bonus_points.source.${props.row.source}`) : '');

const giftValueText = computed(() => {
  const r = props.row;
  if (!r) return '';
  if (r.giftType === BonusGiftType.Percentage) {
    const cap = r.giftCap !== null
      ? `・${t('bonus_points.value.points_cap', { value: formatNumber(r.giftCap) })}`
      : '';
    return `${t('bonus_points.value.percent', { value: r.giftValue })}${cap}`;
  }
  return t('bonus_points.value.cash', { value: formatNumber(r.giftValue) });
});

const minSpendText = computed(() => {
  const r = props.row;
  if (!r) return '';
  return r.minSpend > 0
    ? t('bonus_points.value.min_spend', { value: formatNumber(r.minSpend) })
    : t('bonus_points.value.no_threshold');
});

const sendLimitText = computed(() => {
  const r = props.row;
  if (!r) return '';
  return r.sendLimit === null ? t('bonus_points.value.unlimited') : formatNumber(r.sendLimit);
});

const statusText = computed(() => {
  const r = props.row;
  if (!r) return '';
  return r.enabled
    ? t('bonus_points.status_switch.enabled')
    : t('bonus_points.status_switch.disabled');
});

/** 已發送人數是否已達發送人數上限（額滿） */
const isFull = computed(() =>
  !!props.row && props.row.sendLimit !== null && props.row.sentCount >= props.row.sendLimit);

const isExpired = computed(() => {
  const r = props.row;
  if (!r) return false;
  return Date.now() > new Date(r.endAt.replace(' ', 'T')).getTime();
});

// §7.9 日期時間：YYYY/MM/DD HH:mm（不顯示秒）
const formatDateTime = (value: string) =>
  `${value.slice(0, 10)} ${value.slice(11, 16)}`;

const header = computed(() =>
  props.row ? t('bonus_points.records.header', { name: props.row.name }) : '');

function handleExport() {
  showInfo({ detail: t('bonus_points.records.toast.exported') });
}

// 查看商品項目彈窗
const isItemsDialogVisible = ref(false);
const itemsRecord = ref<BonusSendRecord | null>(null);
function openItems(rec: BonusSendRecord) {
  itemsRecord.value = rec;
  isItemsDialogVisible.value = true;
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :draggable="false"
    :header="header"
    :style="{ width: '75rem', maxWidth: '96vw' }"
  >
    <div v-if="row" class="flex flex-col gap-4">
      <!-- 篩選工具列 -->
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div class="flex flex-wrap items-end gap-2">
          <div class="flex flex-col gap-1">
            <label for="records-category-filter" class="text-xs text-surface-500 dark:text-surface-400">
              {{ $t('bonus_points.records.filter.category') }}
            </label>
            <Select
              v-model="category"
              input-id="records-category-filter"
              :options="categoryOptions"
              option-label="label"
              option-value="value"
              class="w-36"
            />
          </div>
          <div class="flex flex-col gap-1">
            <label for="records-keyword" class="text-xs text-surface-500 dark:text-surface-400">
              {{ $t('bonus_points.records.filter.keyword') }}
            </label>
            <InputText
              id="records-keyword"
              v-model="keyword"
              :placeholder="$t('bonus_points.records.filter.keyword_placeholder')"
              class="w-full sm:w-64"
              @keyup.enter="onSearch"
            />
          </div>
          <Button
            :label="$t('bonus_points.records.filter.search')"
            @click="onSearch"
          />
        </div>
        <Button
          :label="$t('bonus_points.records.filter.export')"
          severity="secondary"
          variant="outlined"
          @click="handleExport"
        >
          <template #icon>
            <FontAwesomeIcon :icon="['far', 'file-export']" class="mr-2" />
          </template>
        </Button>
      </div>

      <!-- 活動摘要（唯讀 KV；label = Label 14px、值 = Body 16px，見 design.md §三 字級階梯） -->
      <div class="grid grid-cols-2 gap-x-6 gap-y-3 rounded-md bg-surface-50 px-4 py-3 md:grid-cols-4 dark:bg-surface-800">
        <div class="flex flex-col gap-1">
          <span class="text-sm text-surface-500 dark:text-surface-400">{{ $t('bonus_points.records.summary.source') }}</span>
          <span class="text-base">{{ sourceLabel }}</span>
        </div>
        <div class="flex flex-col gap-1">
          <span class="text-sm text-surface-500 dark:text-surface-400">{{ $t('bonus_points.records.summary.gift') }}</span>
          <span class="text-base">{{ giftValueText }}</span>
        </div>
        <div class="flex flex-col gap-1">
          <span class="text-sm text-surface-500 dark:text-surface-400">{{ $t('bonus_points.records.summary.min_spend') }}</span>
          <span class="text-base">{{ minSpendText }}</span>
        </div>
        <div class="flex flex-col gap-1">
          <span class="text-sm text-surface-500 dark:text-surface-400">{{ $t('bonus_points.records.summary.send_limit') }}</span>
          <span class="text-base">{{ sendLimitText }}</span>
        </div>
        <div class="flex flex-col gap-1">
          <span class="text-sm text-surface-500 dark:text-surface-400">{{ $t('bonus_points.records.summary.sent_count') }}</span>
          <span v-if="isFull" class="text-base font-medium text-[var(--p-red-500)]">{{ $t('bonus_points.value.full') }}</span>
          <span v-else class="text-base">{{ formatNumber(row.sentCount) }}</span>
        </div>
        <div class="flex flex-col gap-1">
          <span class="text-sm text-surface-500 dark:text-surface-400">{{ $t('bonus_points.records.summary.start_at') }}</span>
          <span class="text-base">{{ formatDateTime(row.startAt) }}</span>
        </div>
        <div class="flex flex-col gap-1">
          <span class="text-sm text-surface-500 dark:text-surface-400">{{ $t('bonus_points.records.summary.end_at') }}</span>
          <span class="flex items-center gap-2 text-base">
            {{ formatDateTime(row.endAt) }}
            <Tag
              v-if="isExpired"
              severity="secondary"
              :value="$t('bonus_points.records.expired_badge')"
            />
          </span>
        </div>
        <div class="flex flex-col gap-1">
          <span class="text-sm text-surface-500 dark:text-surface-400">{{ $t('bonus_points.records.summary.status') }}</span>
          <span class="text-base">{{ statusText }}</span>
        </div>
      </div>

      <!-- 訂單摘要列：訂單數（左）+ 訂單總金額（右） -->
      <div class="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--p-content-border-color)] pb-3">
        <span class="text-base font-semibold">
          {{ $t('bonus_points.records.order_count') }}
          <span class="text-primary">{{ formatNumber(orderCount) }}</span>
        </span>
        <span class="text-base font-semibold">
          {{ $t('bonus_points.records.order_total') }}
          <span class="text-primary">{{ formatNumber(totalAmount) }}</span>
        </span>
      </div>

      <!-- 桌機：訂單 DataTable（依 design.md §6.8：唯讀分頁資料列用 DataTable） -->
      <DataTable
        :value="pagedRecords"
        data-key="orderNo"
        striped-rows
        size="small"
        class="hidden md:block"
      >
        <Column :header="$t('bonus_points.records.table.member')">
          <template #body="{ data }">
            <div class="flex items-center gap-3">
              <span class="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-200 text-sm font-medium text-surface-700 dark:bg-surface-700 dark:text-surface-200">
                {{ avatarText(data.memberName) }}
              </span>
              <div class="flex min-w-0 flex-col">
                <span class="font-medium">{{ data.memberName }}</span>
                <span class="text-xs break-all text-surface-500 dark:text-surface-400">{{ data.memberRef }}</span>
              </div>
            </div>
          </template>
        </Column>
        <Column field="orderNo" :header="$t('bonus_points.records.table.order_no')" />
        <Column :header="$t('bonus_points.records.table.ordered_at')">
          <template #body="{ data }">{{ formatDateTime(data.orderedAt) }}</template>
        </Column>
        <Column :header="$t('bonus_points.records.table.points_used')">
          <template #body="{ data }"><span class="font-semibold text-primary">{{ formatNumber(data.pointsUsed) }}</span></template>
        </Column>
        <Column :header="$t('bonus_points.records.table.amount')">
          <template #body="{ data }"><span class="font-semibold text-primary">{{ formatNumber(data.amountAfterDeduction) }}</span></template>
        </Column>
        <Column :header="$t('bonus_points.records.table.items')">
          <template #body="{ data }">
            <a class="cursor-pointer text-primary hover:underline" @click="openItems(data)">{{ $t('bonus_points.records.view_detail') }}</a>
          </template>
        </Column>
        <template #empty>
          <div class="py-12 text-center text-muted-color">{{ $t('bonus_points.records.empty_state') }}</div>
        </template>
      </DataTable>

      <!-- 手機（<768px）：卡片列表（design.md §7.5） -->
      <div class="divide-y divide-[var(--p-content-border-color)] md:hidden">
        <div v-for="rec in pagedRecords" :key="rec.orderNo" class="flex flex-col gap-2 px-1 py-3">
          <div class="flex items-center gap-3">
            <span class="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-200 text-sm font-medium text-surface-700 dark:bg-surface-700 dark:text-surface-200">
              {{ avatarText(rec.memberName) }}
            </span>
            <div class="flex min-w-0 flex-col">
              <span class="text-sm font-semibold">{{ rec.memberName }}</span>
              <span class="text-xs break-all text-surface-500 dark:text-surface-400">{{ rec.memberRef }}</span>
            </div>
          </div>
          <div class="flex flex-col gap-1 rounded-md bg-surface-50 px-2 py-2 text-sm dark:bg-surface-800/40">
            <div class="flex gap-2">
              <span class="shrink-0 text-surface-400 dark:text-surface-500">{{ $t('bonus_points.records.table.order_no') }}</span>
              <span>{{ rec.orderNo }}</span>
            </div>
            <div class="flex gap-2">
              <span class="shrink-0 text-surface-400 dark:text-surface-500">{{ $t('bonus_points.records.table.ordered_at') }}</span>
              <span>{{ formatDateTime(rec.orderedAt) }}</span>
            </div>
            <div class="flex gap-2">
              <span class="shrink-0 text-surface-400 dark:text-surface-500">{{ $t('bonus_points.records.table.points_used') }}</span>
              <span class="font-semibold text-primary">{{ formatNumber(rec.pointsUsed) }}</span>
            </div>
            <div class="flex gap-2">
              <span class="shrink-0 text-surface-400 dark:text-surface-500">{{ $t('bonus_points.records.table.amount') }}</span>
              <span class="font-semibold text-primary">{{ formatNumber(rec.amountAfterDeduction) }}</span>
            </div>
          </div>
          <div class="flex justify-end">
            <a class="cursor-pointer text-sm text-primary hover:underline" @click="openItems(rec)">{{ $t('bonus_points.records.view_detail') }}</a>
          </div>
        </div>
        <div v-if="!filteredRecords.length" class="py-12 text-center text-muted-color">
          {{ $t('bonus_points.records.empty_state') }}
        </div>
      </div>

      <!-- 分頁 -->
      <Paginator
        v-if="filteredRecords.length > ROWS"
        :rows="ROWS"
        :total-records="filteredRecords.length"
        :first="(currentPage - 1) * ROWS"
        @page="onPage"
      />
    </div>

    <template #footer>
      <Button
        :label="$t('bonus_points.records.close')"
        severity="secondary"
        outlined
        @click="visible = false"
      />
    </template>

    <BonusOrderItemsDialog
      v-model:visible="isItemsDialogVisible"
      :record="itemsRecord"
    />
  </Dialog>
</template>
