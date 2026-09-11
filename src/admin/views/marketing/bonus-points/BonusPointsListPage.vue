<script setup lang="ts">
/**
 * 紅利點數活動列表頁（原型版）
 * — 三段式版型：頁首列（標題 + 麵包屑，卡片外）／搜尋 Card（Tabs + 搜尋 + 頁首操作）／資料 Card
 * — Tabs 依生命週期即時篩選；關鍵字按「搜尋」才套用（pending → applied）
 * — 完整 CRUD：新增 / 檢視 / 編輯（共用 FormDialog）、單筆刪除、批次刪除
 * — 原型階段：資料存本地 ref，儲存 / 刪除以 toast 回饋，不打後端
 */
import { PaginationTable } from '@/admin/components/portal-ui';
import { useConfirm } from 'primevue/useconfirm';
import { useGlobalToast } from '@/admin/composables/useGlobalToast';
import { BonusLifecycle, BonusRewardType, type BonusPointsRow } from './types';
import { mockBonusPointsList } from './mockData';
import BonusPointsFormDialog from './components/BonusPointsFormDialog.vue';
import BonusPointsRecordsDialog from './components/BonusPointsRecordsDialog.vue';

import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const confirm = useConfirm();
const { showSuccess } = useGlobalToast();

type StatusFilter = 'all' | BonusLifecycle;

// 關鍵字：keyword = 輸入框草稿；appliedKeyword = 按「搜尋」後才 commit 的過濾值
const keyword = ref('');
const appliedKeyword = ref('');
// 生命週期頁籤：切換即時套用
const statusTab = ref<StatusFilter>('all');

// 資料來源：原型階段以本地 ref 存放，CRUD 直接改這份
const rows = ref<BonusPointsRow[]>([...mockBonusPointsList]);

const statusTabs = computed<{ label: string; value: StatusFilter }[]>(() => [
  { label: t('bonus_points.status_tab.all'), value: 'all' },
  { label: t('bonus_points.status_tab.in_progress'), value: BonusLifecycle.InProgress },
  { label: t('bonus_points.status_tab.upcoming'), value: BonusLifecycle.Upcoming },
  { label: t('bonus_points.status_tab.ended'), value: BonusLifecycle.Ended },
]);

/** 由活動期間與「今天」推導生命週期（不落庫，與 enabled 開關獨立） */
function lifecycleOf(row: BonusPointsRow): BonusLifecycle {
  const now = Date.now();
  const start = new Date(row.startAt.replace(' ', 'T')).getTime();
  const end = new Date(row.endAt.replace(' ', 'T')).getTime();
  if (now < start) return BonusLifecycle.Upcoming;
  if (now > end) return BonusLifecycle.Ended;
  return BonusLifecycle.InProgress;
}

const columns = computed(() => [
  { field: 'name', header: t('bonus_points.table.name'), slot: 'name', nowrap: true },
  { field: 'rewardType', header: t('bonus_points.table.reward_type'), slot: 'rewardType', nowrap: true },
  { field: 'claimLimit', header: t('bonus_points.table.claim_limit'), slot: 'claimLimit', nowrap: true },
  { field: 'claimedCount', header: t('bonus_points.table.claimed_count'), slot: 'claimedCount', nowrap: true },
  { field: 'period', header: t('bonus_points.table.period'), slot: 'period', nowrap: true },
  { field: 'link', header: t('bonus_points.table.link'), slot: 'link', nowrap: true },
  { field: 'enabled', header: t('bonus_points.table.status'), slot: 'enabled', nowrap: true },
  { field: 'actions', header: t('bonus_points.table.actions'), slot: 'actions', nowrap: true },
]);

const filteredList = computed<BonusPointsRow[]>(() => {
  const normalizedKeyword = appliedKeyword.value.trim().toLowerCase();

  return rows.value.filter((row) => {
    const matchKeyword
      = normalizedKeyword.length === 0
        || row.name.toLowerCase().includes(normalizedKeyword);

    const matchStatus = statusTab.value === 'all' || lifecycleOf(row) === statusTab.value;

    return matchKeyword && matchStatus;
  });
});

function onSearch() {
  appliedKeyword.value = keyword.value;
}

// ---- 呈現輔助 ----
const rewardTypeLabel = (type: BonusRewardType) => t(`bonus_points.reward_type.${type}`);
const lifecycleLabel = (life: BonusLifecycle) => t(`bonus_points.lifecycle.${life}`);

const lifecycleSeverity = (life: BonusLifecycle): 'success' | 'warn' | 'secondary' => {
  if (life === BonusLifecycle.InProgress) return 'success';
  if (life === BonusLifecycle.Upcoming) return 'warn';
  return 'secondary';
};

const formatNumber = (value: number) => value.toLocaleString('en-US');

/** 回饋主值：比例制 '5%'；固定制 '100 點' */
const rewardValueText = (row: BonusPointsRow) =>
  row.rewardType === BonusRewardType.Percentage
    ? t('bonus_points.value.percent', { value: row.rewardValue })
    : t('bonus_points.value.points', { value: formatNumber(row.rewardValue) });

/** 回饋細節：門檻 + 上限（比例制才有上限） */
const rewardDetailText = (row: BonusPointsRow) => {
  const parts: string[] = [rewardValueText(row)];
  if (row.minSpend > 0) {
    parts.push(t('bonus_points.value.min_spend', { value: formatNumber(row.minSpend) }));
  } else {
    parts.push(t('bonus_points.value.no_threshold'));
  }
  if (row.rewardType === BonusRewardType.Percentage && row.pointsCap !== null) {
    parts.push(t('bonus_points.value.points_cap', { value: formatNumber(row.pointsCap) }));
  }
  return parts.join('・');
};

const claimLimitText = (row: BonusPointsRow) =>
  row.claimLimit === null ? t('bonus_points.value.unlimited') : formatNumber(row.claimLimit);

// 領取連結：一個活動一條（會員點此領取 / 分享用）
const CLAIM_LINK_BASE = 'https://live01.168money.com.tw/Center/receiveDividend/';
const claimLink = (row: BonusPointsRow) => `${CLAIM_LINK_BASE}${row.id}`;

async function handleCopyLink(row: BonusPointsRow) {
  try {
    await navigator.clipboard?.writeText(claimLink(row));
    showSuccess({ detail: t('bonus_points.toast.link_copied') });
  } catch {
    // 剪貼簿權限被拒時靜默略過（原型階段不阻斷流程）
  }
}

// §7.9：日期一律斜線 YYYY/MM/DD；區間用 ' - ' 分隔
const formatDate = (value: string) => value.slice(0, 10).replace(/-/g, '/');
const formatPeriod = (row: BonusPointsRow) => `${formatDate(row.startAt)} - ${formatDate(row.endAt)}`;

// ---- 新增 / 編輯 / 檢視共用彈窗 ----
const isFormDialogVisible = ref(false);
const formMode = ref<'create' | 'edit' | 'view' | 'copy'>('create');
const editingRow = ref<BonusPointsRow | null>(null);

function handleCreate() {
  formMode.value = 'create';
  editingRow.value = null;
  isFormDialogVisible.value = true;
}

function handleView(row: BonusPointsRow) {
  formMode.value = 'view';
  editingRow.value = row;
  isFormDialogVisible.value = true;
}

function handleEdit(row: BonusPointsRow) {
  formMode.value = 'edit';
  editingRow.value = row;
  isFormDialogVisible.value = true;
}

function handleCopy(row: BonusPointsRow) {
  formMode.value = 'copy';
  editingRow.value = row;
  isFormDialogVisible.value = true;
}

// ---- 領取明細清單 ----
const isRecordsDialogVisible = ref(false);
const recordsRow = ref<BonusPointsRow | null>(null);

function handleRecords(row: BonusPointsRow) {
  recordsRow.value = row;
  isRecordsDialogVisible.value = true;
}

function handleFormSubmit(row: BonusPointsRow) {
  if (formMode.value === 'edit') {
    rows.value = rows.value.map((r) => (r.id === row.id ? row : r));
    showSuccess({ detail: t('bonus_points.toast.updated') });
  } else {
    const nextId = String(
      rows.value.reduce((max, r) => Math.max(max, Number(r.id) || 0), 0) + 1,
    );
    rows.value = [{ ...row, id: nextId }, ...rows.value];
    showSuccess({ detail: t('bonus_points.toast.created') });
  }
}

function handleToggleEnabled(row: BonusPointsRow, value: boolean) {
  rows.value = rows.value.map((r) => (r.id === row.id ? { ...r, enabled: value } : r));
  showSuccess({
    detail: value
      ? t('bonus_points.toast.status_on', { name: row.name })
      : t('bonus_points.toast.status_off', { name: row.name }),
  });
}

// ---- 刪除（單筆）----
function handleDelete(row: BonusPointsRow) {
  confirm.require({
    header: t('bonus_points.confirm.delete_title'),
    message: t('bonus_points.confirm.delete_message', { name: row.name }),
    icon: 'pi pi-exclamation-triangle',
    defaultFocus: 'reject',
    rejectProps: { label: t('bonus_points.confirm.reject'), severity: 'secondary', outlined: true },
    acceptProps: { label: t('bonus_points.confirm.accept'), severity: 'danger' },
    accept: () => {
      rows.value = rows.value.filter((r) => r.id !== row.id);
      showSuccess({ detail: t('bonus_points.toast.deleted') });
    },
  });
}

// ---- 批次刪除 ----
const batchMode = ref(false);
const selected = ref<BonusPointsRow[]>([]);

function enterBatchMode() {
  batchMode.value = true;
  selected.value = [];
}

function exitBatchMode() {
  batchMode.value = false;
  selected.value = [];
}

// 切換頁籤 / 重新搜尋會改變可見清單，清空勾選避免「勾了但已不在畫面上」的幽靈選取
watch([statusTab, appliedKeyword], () => {
  selected.value = [];
});

function handleBatchDelete() {
  const count = selected.value.length;
  if (count === 0) return;

  confirm.require({
    header: t('bonus_points.confirm.delete_title'),
    message: t('bonus_points.confirm.batch_delete_message', { count }),
    icon: 'pi pi-exclamation-triangle',
    defaultFocus: 'reject',
    rejectProps: { label: t('bonus_points.confirm.reject'), severity: 'secondary', outlined: true },
    acceptProps: { label: t('bonus_points.confirm.accept'), severity: 'danger' },
    accept: () => {
      const ids = new Set(selected.value.map((r) => r.id));
      rows.value = rows.value.filter((r) => !ids.has(r.id));
      showSuccess({ detail: t('bonus_points.toast.batch_deleted', { count }) });
      exitBatchMode();
    },
  });
}
</script>

<template>
  <div class="flex flex-1 flex-col gap-4 min-h-0">
    <!-- 頁首：標題 + 麵包屑，獨立一行（卡片外，見 design.md §6.7） -->
    <div class="flex flex-wrap items-center gap-3">
      <h2 class="text-2xl font-bold text-neutral-700 dark:text-neutral-100">
        {{ $t('bonus_points.title') }}
      </h2>
      <div class="ml-auto flex items-center gap-2 text-sm">
        <span class="text-color-secondary">{{ $t('bonus_points.breadcrumb.parent') }}</span>
        <i class="pi pi-chevron-right text-color-secondary" style="font-size: 10px"></i>
        <span class="text-primary cursor-default">{{ $t('bonus_points.title') }}</span>
      </div>
    </div>

    <!-- 內容卡片 -->
    <Card>
      <template #content>
        <!-- 生命週期頁籤：切換即時套用 -->
        <Tabs
          :value="statusTab"
          class="mb-4"
          @update:value="(v) => statusTab = String(v) as StatusFilter"
        >
          <TabList>
            <Tab
              v-for="s in statusTabs"
              :key="s.value"
              :value="s.value"
            >
              {{ s.label }}
            </Tab>
          </TabList>
        </Tabs>

        <!-- 副標 + 換算比例資訊（左）── 頁首操作鈕（右） -->
        <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div class="flex flex-wrap items-center gap-2">
            <p class="text-sm text-[var(--p-text-muted-color)]">
              {{ $t('bonus_points.subtitle') }}
            </p>
            <Tag
              severity="info"
              :value="$t('bonus_points.conversion_badge')"
            />
          </div>
          <div class="flex items-center gap-2">
            <Button
              v-if="!batchMode"
              severity="danger"
              variant="outlined"
              size="small"
              icon="pi pi-trash"
              :label="$t('bonus_points.button.batch_delete')"
              @click="enterBatchMode"
            />
            <Button
              icon="pi pi-plus"
              :label="$t('bonus_points.button.create')"
              @click="handleCreate"
            />
          </div>
        </div>

        <!-- 批次模式 banner -->
        <div
          v-if="batchMode"
          class="mb-4 flex flex-wrap items-center gap-3 rounded-md bg-[var(--p-primary-50)] px-4 py-2"
        >
          <span class="text-sm font-medium text-[var(--p-primary-color)]">
            {{ selected.length > 0
              ? $t('bonus_points.batch.selected', { count: selected.length })
              : $t('bonus_points.batch.none_selected') }}
          </span>
          <div class="ml-auto flex items-center gap-2">
            <Button
              severity="secondary"
              outlined
              size="small"
              :label="$t('bonus_points.button.batch_cancel')"
              @click="exitBatchMode"
            />
            <Button
              severity="danger"
              size="small"
              :disabled="selected.length === 0"
              :label="$t('bonus_points.button.batch_delete_confirm')"
              @click="handleBatchDelete"
            />
          </div>
        </div>

        <!-- 搜尋列（左，按「搜尋」或 Enter 才套用）── 共 N 筆（右） -->
        <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <InputText
              v-model="keyword"
              :placeholder="$t('bonus_points.form.placeholder.search')"
              class="w-56 sm:w-80"
              @keyup.enter="onSearch"
            />
            <Button
              class="shrink-0"
              :label="$t('bonus_points.button.search')"
              @click="onSearch"
            />
          </div>
          <span class="text-sm text-[var(--p-text-muted-color)] whitespace-nowrap">
            {{ $t('common.pagination.total_records', { count: filteredList.length }) }}
          </span>
        </div>

        <PaginationTable
          v-model:selection="selected"
          :data="filteredList"
          :columns="columns"
          :show-selection-column="batchMode"
        >
          <template #name="{ data }">
            <div class="flex flex-col gap-1">
              <span class="font-medium">{{ data.name }}</span>
              <Tag
                :value="lifecycleLabel(lifecycleOf(data))"
                :severity="lifecycleSeverity(lifecycleOf(data))"
                class="w-fit"
              />
            </div>
          </template>

          <template #rewardType="{ data }">
            <div class="flex flex-col gap-1">
              <Tag
                :value="rewardTypeLabel(data.rewardType)"
                severity="secondary"
                class="w-fit"
              />
              <span class="text-xs text-surface-500 dark:text-surface-400">
                {{ rewardDetailText(data) }}
              </span>
            </div>
          </template>

          <template #claimLimit="{ data }">
            {{ claimLimitText(data) }}
          </template>

          <template #claimedCount="{ data }">
            {{ formatNumber(data.claimedCount) }}
          </template>

          <template #period="{ data }">
            {{ formatPeriod(data) }}
          </template>

          <template #link="{ data }">
            <div class="flex items-center gap-2">
              <span class="max-w-[10rem] truncate text-xs text-surface-500 dark:text-surface-400">
                {{ claimLink(data) }}
              </span>
              <Button
                v-tooltip.top="$t('bonus_points.button.copy_link')"
                :aria-label="$t('bonus_points.button.copy_link')"
                icon="pi pi-copy"
                text
                rounded
                size="small"
                severity="secondary"
                @click="handleCopyLink(data)"
              />
            </div>
          </template>

          <template #enabled="{ data }">
            <div class="flex items-center gap-2">
              <ToggleSwitch
                :model-value="data.enabled"
                :aria-label="$t('bonus_points.status_switch.aria', { name: data.name })"
                @update:model-value="(v) => handleToggleEnabled(data, v)"
              />
              <span class="text-sm text-surface-600 dark:text-surface-300">
                {{ data.enabled
                  ? $t('bonus_points.status_switch.enabled')
                  : $t('bonus_points.status_switch.disabled') }}
              </span>
            </div>
          </template>

          <template #actions="{ data }">
            <div class="flex items-center gap-1">
              <Button
                v-tooltip.top="$t('bonus_points.button.view')"
                :aria-label="$t('bonus_points.button.view')"
                icon="pi pi-eye"
                rounded
                text
                size="small"
                severity="secondary"
                @click="handleView(data)"
              />
              <Button
                v-tooltip.top="$t('bonus_points.button.edit')"
                :aria-label="$t('bonus_points.button.edit')"
                icon="pi pi-pen-to-square"
                rounded
                text
                size="small"
                @click="handleEdit(data)"
              />
              <Button
                v-tooltip.top="$t('bonus_points.button.copy')"
                :aria-label="$t('bonus_points.button.copy')"
                icon="pi pi-copy"
                rounded
                text
                size="small"
                severity="secondary"
                @click="handleCopy(data)"
              />
              <Button
                v-tooltip.top="$t('bonus_points.button.records')"
                :aria-label="$t('bonus_points.button.records')"
                icon="pi pi-list"
                rounded
                text
                size="small"
                severity="secondary"
                @click="handleRecords(data)"
              />
              <Button
                v-tooltip.top="$t('bonus_points.button.delete')"
                :aria-label="$t('bonus_points.button.delete')"
                icon="pi pi-trash"
                rounded
                text
                size="small"
                severity="danger"
                @click="handleDelete(data)"
              />
            </div>
          </template>
        </PaginationTable>
      </template>
    </Card>

    <BonusPointsFormDialog
      v-model:visible="isFormDialogVisible"
      :mode="formMode"
      :row="editingRow"
      @submit="handleFormSubmit"
    />

    <BonusPointsRecordsDialog
      v-model:visible="isRecordsDialogVisible"
      :row="recordsRow"
    />
  </div>
</template>
