<script setup lang="ts">
/**
 * 紅利點數活動「領取明細」Dialog（原型版，唯讀查閱）
 * — 三段式：篩選工具列（使用狀況 / 篩選類別 / 關鍵字 + 搜尋 + Excel 匯出）／活動摘要（唯讀 KV）／明細 DataTable
 * — 明細為示範取樣資料（createMockClaimRecords）；未領取欄位以「—」佔位
 * — 每列「複製領取連結」走 navigator.clipboard + toast；Excel 匯出於原型階段僅 toast 回饋
 */
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { useGlobalToast } from '@/admin/composables/useGlobalToast';
import { createMockClaimRecords } from '../mockData';
import {
  BonusClaimStatus,
  BonusRewardType,
  type BonusClaimRecord,
  type BonusPointsRow,
} from '../types';

const props = defineProps<{
  /** 要看明細的活動；為 null 時不載入 */
  row: BonusPointsRow | null;
}>();

const visible = defineModel<boolean>('visible', { required: true });

const { t } = useI18n();
const { showInfo } = useGlobalToast();

type StatusFilter = 'all' | BonusClaimStatus;
type CategoryFilter = 'member_name' | 'member_id' | 'claim_code';

const statusFilter = ref<StatusFilter>('all');
const category = ref<CategoryFilter>('member_name');
const keyword = ref('');
const appliedKeyword = ref('');

const records = ref<BonusClaimRecord[]>([]);

// 開窗時依活動產出示範明細；換活動或重開都重建，並重置篩選
watch([visible, () => props.row], ([isOpen]) => {
  if (!isOpen || !props.row) return;
  records.value = createMockClaimRecords(props.row);
  statusFilter.value = 'all';
  category.value = 'member_name';
  keyword.value = '';
  appliedKeyword.value = '';
});

const statusOptions = computed<{ label: string; value: StatusFilter }[]>(() => [
  { label: t('bonus_points.records.filter.status_all'), value: 'all' },
  { label: t('bonus_points.records.status_option.claimed'), value: BonusClaimStatus.Claimed },
  { label: t('bonus_points.records.status_option.unclaimed'), value: BonusClaimStatus.Unclaimed },
]);

const categoryOptions = computed<{ label: string; value: CategoryFilter }[]>(() => [
  { label: t('bonus_points.records.category_option.member_name'), value: 'member_name' },
  { label: t('bonus_points.records.category_option.member_id'), value: 'member_id' },
  { label: t('bonus_points.records.category_option.claim_code'), value: 'claim_code' },
]);

function onSearch() {
  appliedKeyword.value = keyword.value;
}

const filteredRecords = computed<BonusClaimRecord[]>(() => {
  const kw = appliedKeyword.value.trim().toLowerCase();
  return records.value.filter((r) => {
    const matchStatus = statusFilter.value === 'all' || r.status === statusFilter.value;
    if (!matchStatus) return false;
    if (kw.length === 0) return true;
    const field
      = category.value === 'member_name' ? r.memberName
        : category.value === 'member_id' ? r.memberId
          : r.claimCode;
    return (field ?? '').toLowerCase().includes(kw);
  });
});

// ---- 摘要呈現 ----
const EMPTY = computed(() => t('bonus_points.records.empty_value'));
const formatNumber = (value: number) => value.toLocaleString('en-US');

const rewardTypeLabel = computed(() =>
  props.row ? t(`bonus_points.reward_type.${props.row.rewardType}`) : '');

const rewardValueText = computed(() => {
  const r = props.row;
  if (!r) return '';
  if (r.rewardType === BonusRewardType.Percentage) {
    const cap = r.pointsCap !== null
      ? `・${t('bonus_points.value.points_cap', { value: formatNumber(r.pointsCap) })}`
      : '';
    return `${t('bonus_points.value.percent', { value: r.rewardValue })}${cap}`;
  }
  return t('bonus_points.value.points', { value: formatNumber(r.rewardValue) });
});

const minSpendText = computed(() => {
  const r = props.row;
  if (!r) return '';
  return r.minSpend > 0
    ? t('bonus_points.value.min_spend', { value: formatNumber(r.minSpend) })
    : t('bonus_points.value.no_threshold');
});

const claimLimitText = computed(() => {
  const r = props.row;
  if (!r) return '';
  return r.claimLimit === null ? t('bonus_points.value.unlimited') : formatNumber(r.claimLimit);
});

const isExpired = computed(() => {
  const r = props.row;
  if (!r) return false;
  return Date.now() > new Date(r.endAt.replace(' ', 'T')).getTime();
});

// §7.9 日期時間：YYYY/MM/DD HH:mm（不顯示秒）
const formatDateTime = (value: string) =>
  `${value.slice(0, 10).replace(/-/g, '/')} ${value.slice(11, 16)}`;

const header = computed(() =>
  props.row ? t('bonus_points.records.header', { name: props.row.name }) : '');

function handleExport() {
  showInfo({ detail: t('bonus_points.records.toast.exported') });
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
            <label for="records-status-filter" class="text-xs text-surface-500 dark:text-surface-400">
              {{ $t('bonus_points.records.filter.status') }}
            </label>
            <Select
              v-model="statusFilter"
              input-id="records-status-filter"
              :options="statusOptions"
              option-label="label"
              option-value="value"
              class="w-36"
            />
          </div>
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
          icon="pi pi-file-export"
          severity="secondary"
          variant="outlined"
          @click="handleExport"
        />
      </div>

      <!-- 活動摘要（唯讀 KV） -->
      <div class="grid grid-cols-2 gap-x-6 gap-y-3 rounded-md bg-surface-50 px-4 py-3 md:grid-cols-4 dark:bg-surface-800">
        <div class="flex flex-col gap-1">
          <span class="text-xs text-surface-500 dark:text-surface-400">{{ $t('bonus_points.records.summary.reward_type') }}</span>
          <span class="text-sm">{{ rewardTypeLabel }}</span>
        </div>
        <div class="flex flex-col gap-1">
          <span class="text-xs text-surface-500 dark:text-surface-400">{{ $t('bonus_points.records.summary.reward_value') }}</span>
          <span class="text-sm">{{ rewardValueText }}</span>
        </div>
        <div class="flex flex-col gap-1">
          <span class="text-xs text-surface-500 dark:text-surface-400">{{ $t('bonus_points.records.summary.min_spend') }}</span>
          <span class="text-sm">{{ minSpendText }}</span>
        </div>
        <div class="flex flex-col gap-1">
          <span class="text-xs text-surface-500 dark:text-surface-400">{{ $t('bonus_points.records.summary.claim_limit') }}</span>
          <span class="text-sm">{{ claimLimitText }}</span>
        </div>
        <div class="flex flex-col gap-1">
          <span class="text-xs text-surface-500 dark:text-surface-400">{{ $t('bonus_points.records.summary.claimed_count') }}</span>
          <span class="text-sm">{{ formatNumber(row.claimedCount) }}</span>
        </div>
        <div class="flex flex-col gap-1">
          <span class="text-xs text-surface-500 dark:text-surface-400">{{ $t('bonus_points.records.summary.start_at') }}</span>
          <span class="text-sm">{{ formatDateTime(row.startAt) }}</span>
        </div>
        <div class="flex flex-col gap-1 md:col-span-2">
          <span class="text-xs text-surface-500 dark:text-surface-400">{{ $t('bonus_points.records.summary.end_at') }}</span>
          <span class="flex items-center gap-2 text-sm">
            {{ formatDateTime(row.endAt) }}
            <Tag
              v-if="isExpired"
              severity="secondary"
              :value="$t('bonus_points.records.expired_badge')"
            />
          </span>
        </div>
      </div>

      <!-- 共 N 筆 -->
      <div class="flex justify-end">
        <span class="text-sm text-[var(--p-text-muted-color)]">
          {{ $t('common.pagination.total_records', { count: filteredRecords.length }) }}
        </span>
      </div>

      <!-- 明細表 -->
      <DataTable
        :value="filteredRecords"
        data-key="claimCode"
        striped-rows
        size="small"
        paginator
        scrollable
        :rows="10"
        :rows-per-page-options="[10, 20, 50]"
      >
        <Column field="claimCode" :header="$t('bonus_points.records.table.claim_code')" />
        <Column :header="$t('bonus_points.records.table.member_name')">
          <template #body="{ data }">{{ data.memberName ?? EMPTY }}</template>
        </Column>
        <Column :header="$t('bonus_points.records.table.claimed_at')">
          <template #body="{ data }">
            {{ data.claimedAt ? formatDateTime(data.claimedAt) : EMPTY }}
          </template>
        </Column>
        <Column :header="$t('bonus_points.records.table.points')">
          <template #body="{ data }">
            {{ data.points === null ? EMPTY : formatNumber(data.points) }}
          </template>
        </Column>
        <Column :header="$t('bonus_points.records.table.member_id')">
          <template #body="{ data }">{{ data.memberId ?? EMPTY }}</template>
        </Column>
        <Column :header="$t('bonus_points.records.table.used_by_id')">
          <template #body="{ data }">{{ data.usedById ?? EMPTY }}</template>
        </Column>
        <Column :header="$t('bonus_points.records.table.order_no')">
          <template #body="{ data }">{{ data.orderNo ?? EMPTY }}</template>
        </Column>
        <Column :header="$t('bonus_points.records.table.status')">
          <template #body="{ data }">
            <Tag
              :value="$t(`bonus_points.records.status.${data.status}`)"
              :severity="data.status === BonusClaimStatus.Claimed ? 'success' : 'secondary'"
            />
          </template>
        </Column>

        <template #empty>
          <div class="py-12 text-center text-color-secondary">
            {{ $t('bonus_points.records.empty_state') }}
          </div>
        </template>
      </DataTable>
    </div>

    <template #footer>
      <Button
        :label="$t('bonus_points.records.close')"
        severity="secondary"
        outlined
        @click="visible = false"
      />
    </template>
  </Dialog>
</template>
