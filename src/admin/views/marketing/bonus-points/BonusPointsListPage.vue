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
import { BonusGiftType, BonusLifecycle, type BonusPointsRow } from './types';
import { mockBonusPointsList } from './mockData';
import BonusPointsFormDialog from './components/BonusPointsFormDialog.vue';
import BonusPointsRecordsDialog from './components/BonusPointsRecordsDialog.vue';

import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const confirm = useConfirm();
const { showSuccess } = useGlobalToast();

type StatusFilter = 'all' | BonusLifecycle;

// 關鍵字：keyword = 輸入框草稿；appliedKeyword = 按「搜尋」後才 commit 的過濾值
const keyword = ref('');
const appliedKeyword = ref('');
// 活動區間：dateRange = 草稿；appliedDateRange = 按「搜尋」後才 commit（查與此區間重疊的活動）
const dateRange = ref<[Date, Date] | null>(null);
const appliedDateRange = ref<[Date, Date] | null>(null);
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
  { field: 'source', header: t('bonus_points.table.reward_type'), slot: 'source', nowrap: true },
  { field: 'sendLimit', header: t('bonus_points.table.claim_limit'), slot: 'sendLimit', nowrap: true },
  { field: 'sentCount', header: t('bonus_points.table.claimed_count'), slot: 'sentCount', nowrap: true },
  { field: 'period', header: t('bonus_points.table.period'), slot: 'period', nowrap: true },
  { field: 'enabled', header: t('bonus_points.table.status'), slot: 'enabled', nowrap: true },
  { field: 'actions', header: t('bonus_points.table.actions'), slot: 'actions', nowrap: true, frozen: true, alignFrozen: 'right' as const },
]);

/** 活動是否與查詢區間重疊（活動起訖 ∩ 查詢起訖 ≠ ∅） */
function matchDateRange(row: BonusPointsRow): boolean {
  const range = appliedDateRange.value;
  if (!range || !range[0] || !range[1]) return true;
  const rangeStart = range[0].getTime();
  // 區間結束納入當天整日
  const rangeEnd = new Date(range[1]).setHours(23, 59, 59, 999);
  const rowStart = new Date(row.startAt.replace(' ', 'T')).getTime();
  const rowEnd = new Date(row.endAt.replace(' ', 'T')).getTime();
  return rowStart <= rangeEnd && rowEnd >= rangeStart;
}

const filteredList = computed<BonusPointsRow[]>(() => {
  const normalizedKeyword = appliedKeyword.value.trim().toLowerCase();

  return rows.value.filter((row) => {
    const matchKeyword
      = normalizedKeyword.length === 0
        || row.name.toLowerCase().includes(normalizedKeyword);

    const matchStatus = statusTab.value === 'all' || lifecycleOf(row) === statusTab.value;

    return matchKeyword && matchStatus && matchDateRange(row);
  });
});

function onSearch() {
  appliedKeyword.value = keyword.value;
  appliedDateRange.value = dateRange.value;
}

// ---- 呈現輔助 ----
const sourceLabel = (source: BonusPointsRow['source']) => t(`bonus_points.source.${source}`);
const lifecycleLabel = (life: BonusLifecycle) => t(`bonus_points.lifecycle.${life}`);

const lifecycleSeverity = (life: BonusLifecycle): 'success' | 'warn' | 'secondary' => {
  if (life === BonusLifecycle.InProgress) return 'success';
  if (life === BonusLifecycle.Upcoming) return 'warn';
  return 'secondary';
};

const formatNumber = (value: number) => value.toLocaleString('en-US');

/** 贈送主值：百分比 '5%'；現金 '100 點' */
const giftValueText = (row: BonusPointsRow) =>
  row.giftType === BonusGiftType.Percentage
    ? t('bonus_points.value.percent', { value: row.giftValue })
    : t('bonus_points.value.cash', { value: formatNumber(row.giftValue) });

/** 贈送細節：贈送值 + 門檻 + 上限（百分比才有上限） */
const giftDetailText = (row: BonusPointsRow) => {
  const parts: string[] = [giftValueText(row)];
  if (row.minSpend > 0) {
    parts.push(t('bonus_points.value.min_spend', { value: formatNumber(row.minSpend) }));
  } else {
    parts.push(t('bonus_points.value.no_threshold'));
  }
  if (row.giftType === BonusGiftType.Percentage && row.giftCap !== null) {
    parts.push(t('bonus_points.value.points_cap', { value: formatNumber(row.giftCap) }));
  }
  return parts.join('・');
};

const sendLimitText = (row: BonusPointsRow) =>
  row.sendLimit === null ? t('bonus_points.value.unlimited') : formatNumber(row.sendLimit);

/** 已領取人數是否已達領取人數上限（額滿） */
const isFull = (row: BonusPointsRow) =>
  row.sendLimit !== null && row.sentCount >= row.sendLimit;

// §7.9：日期一律斜線 YYYY/MM/DD；區間用 ' - ' 分隔
const formatDate = (value: string) => value.slice(0, 10);

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

// ── 桌機表格橫向捲動提示：資料還沒捲到底時，在凍結操作欄左側顯示漸層 + 可點 chevron ──
const tableScrollWrap = ref<HTMLElement | null>(null);
const canScrollLeft = ref(false);
const canScrollRight = ref(false);
const overlayTop = ref(0);
const overlayHeight = ref(0);
const frozenColWidth = ref(0);
let scrollEl: HTMLElement | null = null;

function updateScrollState(): void {
  if (!scrollEl) return;
  canScrollLeft.value = scrollEl.scrollLeft > 1;
  // 扣掉 scrollbar-gutter / 常駐捲軸保留的 ~16px 殘差，避免捲到底仍顯示
  canScrollRight.value = scrollEl.scrollWidth - (scrollEl.scrollLeft + scrollEl.clientWidth) > 16;
}
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
function scrollTableBy(dir: 1 | -1): void {
  scrollEl?.scrollBy({ left: dir * Math.round((scrollEl.clientWidth || 400) * 0.6), behavior: 'smooth' });
}

let tableRO: ResizeObserver | null = null;
onMounted(async () => {
  await nextTick();
  measureTable();
  scrollEl?.addEventListener('scroll', updateScrollState, { passive: true });
  tableRO = new ResizeObserver(() => measureTable());
  if (tableScrollWrap.value) tableRO.observe(tableScrollWrap.value);
});
onBeforeUnmount(() => {
  scrollEl?.removeEventListener('scroll', updateScrollState);
  tableRO?.disconnect();
});
// 資料 / 篩選改變後欄寬可能變，重新量測
watch(filteredList, () => nextTick().then(measureTable));

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
watch([statusTab, appliedKeyword, appliedDateRange], () => {
  selected.value = [];
});

function handleBatchDelete() {
  const count = selected.value.length;
  if (count === 0) return;

  confirm.require({
    header: t('bonus_points.confirm.delete_title'),
    message: t('bonus_points.confirm.batch_delete_message', { count }),
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
        <span class="text-muted-color">{{ $t('bonus_points.breadcrumb.parent') }}</span>
        <FontAwesomeIcon :icon="['far', 'chevron-right']" class="text-muted-color text-xs" />
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
          <!-- 桌機：操作鈕在副標右側（手機移到共 N 筆下方獨立一列） -->
          <div class="hidden items-center gap-2 md:flex">
            <Button
              v-if="!batchMode"
              severity="danger"
              variant="outlined"
              size="small"
              :label="$t('bonus_points.button.batch_delete')"
              @click="enterBatchMode"
            >
              <template #icon>
                <FontAwesomeIcon :icon="['far', 'trash']" class="mr-2" />
              </template>
            </Button>
            <Button
              size="small"
              :label="$t('bonus_points.button.create')"
              @click="handleCreate"
            >
              <template #icon>
                <FontAwesomeIcon :icon="['fas', 'plus']" class="mr-2" />
              </template>
            </Button>
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
          <div class="flex flex-wrap items-center gap-2">
            <InputText
              v-model="keyword"
              :placeholder="$t('bonus_points.form.placeholder.search')"
              class="w-56 sm:w-72"
              @keyup.enter="onSearch"
            />
            <!-- 活動區間（搜尋日期選取為 YYYY-MM-DD 例外，維持斜線格式） -->
            <DatePicker
              v-model="dateRange"
              selection-mode="range"
              date-format="yy/mm/dd"
              show-icon
              icon-display="input"
              :manual-input="false"
              :placeholder="$t('bonus_points.form.placeholder.date_range')"
              class="w-64"
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

        <!-- 手機：批次刪除 + 新增 獨立一列（放在共 N 筆下方） -->
        <div class="mb-4 flex gap-2 md:hidden">
          <Button
            v-if="!batchMode"
            class="flex-1"
            severity="danger"
            variant="outlined"
            size="small"
            :label="$t('bonus_points.button.batch_delete')"
            @click="enterBatchMode"
          >
            <template #icon>
              <FontAwesomeIcon :icon="['far', 'trash']" class="mr-2" />
            </template>
          </Button>
          <Button
            class="flex-1"
            size="small"
            :label="$t('bonus_points.button.create')"
            @click="handleCreate"
          >
            <template #icon>
              <FontAwesomeIcon :icon="['fas', 'plus']" class="mr-2" />
            </template>
          </Button>
        </div>

        <!-- 桌機表格：欄多會橫向捲動，凍結「操作」欄 + 左右捲動提示（design.md §7.5） -->
        <div ref="tableScrollWrap" class="relative hidden md:block">
        <PaginationTable
          v-model:selection="selected"
          :data="filteredList"
          :columns="columns"
          :show-selection-column="batchMode"
          class="bonus-main-table"
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

          <template #source="{ data }">
            <div class="flex flex-col gap-1">
              <Tag
                :value="sourceLabel(data.source)"
                severity="secondary"
                class="w-fit"
              />
              <span class="text-xs text-surface-500 dark:text-surface-400">
                {{ giftDetailText(data) }}
              </span>
            </div>
          </template>

          <template #sendLimit="{ data }">
            {{ sendLimitText(data) }}
          </template>

          <template #sentCount="{ data }">
            <span v-if="isFull(data)" class="font-medium text-[var(--p-red-500)]">
              {{ $t('bonus_points.value.full') }}
            </span>
            <span v-else>{{ formatNumber(data.sentCount) }}</span>
          </template>

          <template #period="{ data }">
            <div class="whitespace-nowrap">
              <div>{{ formatDate(data.startAt) }}</div>
              <div>~ {{ formatDate(data.endAt) }}</div>
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
                rounded
                text
                size="small"
                severity="secondary"
                @click="handleView(data)"
              >
                <template #icon>
                  <FontAwesomeIcon :icon="['far', 'eye']" />
                </template>
              </Button>
              <Button
                v-tooltip.top="$t('bonus_points.button.edit')"
                :aria-label="$t('bonus_points.button.edit')"
                rounded
                text
                size="small"
                @click="handleEdit(data)"
              >
                <template #icon>
                  <FontAwesomeIcon :icon="['far', 'edit']" />
                </template>
              </Button>
              <Button
                v-tooltip.top="$t('bonus_points.button.copy')"
                :aria-label="$t('bonus_points.button.copy')"
                rounded
                text
                size="small"
                severity="secondary"
                @click="handleCopy(data)"
              >
                <template #icon>
                  <FontAwesomeIcon :icon="['far', 'copy']" />
                </template>
              </Button>
              <Button
                v-tooltip.top="$t('bonus_points.button.records')"
                :aria-label="$t('bonus_points.button.records')"
                rounded
                text
                size="small"
                severity="secondary"
                @click="handleRecords(data)"
              >
                <template #icon>
                  <FontAwesomeIcon :icon="['far', 'clipboard-list']" />
                </template>
              </Button>
              <Button
                v-tooltip.top="$t('bonus_points.button.delete')"
                :aria-label="$t('bonus_points.button.delete')"
                rounded
                text
                size="small"
                severity="danger"
                @click="handleDelete(data)"
              >
                <template #icon>
                  <FontAwesomeIcon :icon="['far', 'trash']" />
                </template>
              </Button>
            </div>
          </template>
        </PaginationTable>

          <!-- 左側捲動提示：已向右捲動時出現，點擊往回捲 -->
          <div
            v-show="canScrollLeft"
            class="pointer-events-none absolute z-10 flex items-start justify-start pl-1"
            :style="{ top: overlayTop + 'px', height: overlayHeight + 'px', left: '0px', width: '56px', background: 'linear-gradient(to left, transparent, var(--p-content-background))' }"
          >
            <button
              type="button"
              class="pointer-events-auto mt-3 size-7 rounded-full bg-[var(--p-content-background)] border border-[var(--p-content-border-color)] shadow flex items-center justify-center text-[var(--p-text-color)] hover:bg-[var(--p-content-hover-background)]"
              aria-label="向左捲動"
              @click="scrollTableBy(-1)"
            >
              <FontAwesomeIcon :icon="['far', 'chevron-left']" class="text-xs" />
            </button>
          </div>

          <!-- 右側捲動提示：資料尚未捲到底時出現，貼在固定操作欄左側 -->
          <div
            v-show="canScrollRight"
            class="pointer-events-none absolute z-10 flex items-start justify-end pr-1"
            :style="{ top: overlayTop + 'px', height: overlayHeight + 'px', right: frozenColWidth + 'px', width: '56px', background: 'linear-gradient(to right, transparent, var(--p-content-background))' }"
          >
            <button
              type="button"
              class="pointer-events-auto mt-3 size-7 rounded-full bg-[var(--p-content-background)] border border-[var(--p-content-border-color)] shadow flex items-center justify-center text-[var(--p-text-color)] hover:bg-[var(--p-content-hover-background)]"
              aria-label="向右捲動查看更多欄位"
              @click="scrollTableBy(1)"
            >
              <FontAwesomeIcon :icon="['far', 'chevron-right']" class="text-xs" />
            </button>
          </div>
        </div>

        <!-- 手機（<md）：卡片列表（design.md §7.5：divide-y 分隔、分層資訊、操作鈕帶文字） -->
        <div class="md:hidden divide-y divide-[var(--p-content-border-color)]">
          <div
            v-for="row in filteredList"
            :key="row.id"
            class="flex flex-col gap-2 px-1 py-3"
          >
            <!-- 主要識別 + 狀態 -->
            <div class="flex items-start justify-between gap-2">
              <div class="flex min-w-0 flex-col gap-1">
                <span class="text-sm font-semibold break-words">{{ row.name }}</span>
                <Tag
                  :value="lifecycleLabel(lifecycleOf(row))"
                  :severity="lifecycleSeverity(lifecycleOf(row))"
                  class="w-fit"
                />
              </div>
              <div class="flex shrink-0 items-center gap-2">
                <ToggleSwitch
                  :model-value="row.enabled"
                  :aria-label="$t('bonus_points.status_switch.aria', { name: row.name })"
                  @update:model-value="(v) => handleToggleEnabled(row, v)"
                />
                <span class="text-sm text-surface-600 dark:text-surface-300">
                  {{ row.enabled
                    ? $t('bonus_points.status_switch.enabled')
                    : $t('bonus_points.status_switch.disabled') }}
                </span>
              </div>
            </div>

            <!-- 次要資訊（收為一底色區塊，每筆加 label） -->
            <div class="flex flex-col gap-1 rounded-md bg-surface-50 px-2 py-2 text-sm dark:bg-surface-800/40">
              <div class="flex gap-2">
                <span class="shrink-0 text-surface-400 dark:text-surface-500">{{ $t('bonus_points.table.reward_type') }}</span>
                <span>{{ sourceLabel(row.source) }}・{{ giftDetailText(row) }}</span>
              </div>
              <div class="flex gap-2">
                <span class="shrink-0 text-surface-400 dark:text-surface-500">{{ $t('bonus_points.table.claim_limit') }}</span>
                <span>{{ sendLimitText(row) }}</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="shrink-0 text-surface-400 dark:text-surface-500">{{ $t('bonus_points.table.claimed_count') }}</span>
                <span v-if="isFull(row)" class="font-medium text-[var(--p-red-500)]">{{ $t('bonus_points.value.full') }}</span>
                <span v-else>{{ formatNumber(row.sentCount) }}</span>
              </div>
              <div class="flex gap-2">
                <span class="shrink-0 text-surface-400 dark:text-surface-500">{{ $t('bonus_points.table.period') }}</span>
                <span>{{ formatDate(row.startAt) }} ~ {{ formatDate(row.endAt) }}</span>
              </div>
            </div>

            <!-- 操作列（帶文字 label） -->
            <div class="flex flex-wrap justify-end gap-2">
              <Button :label="$t('bonus_points.button.view')" text size="small" severity="secondary" @click="handleView(row)">
                <template #icon><FontAwesomeIcon :icon="['far', 'eye']" class="mr-1" /></template>
              </Button>
              <Button :label="$t('bonus_points.button.edit')" text size="small" @click="handleEdit(row)">
                <template #icon><FontAwesomeIcon :icon="['far', 'edit']" class="mr-1" /></template>
              </Button>
              <Button :label="$t('bonus_points.button.copy')" text size="small" severity="secondary" @click="handleCopy(row)">
                <template #icon><FontAwesomeIcon :icon="['far', 'copy']" class="mr-1" /></template>
              </Button>
              <Button :label="$t('bonus_points.button.records')" text size="small" severity="secondary" @click="handleRecords(row)">
                <template #icon><FontAwesomeIcon :icon="['far', 'clipboard-list']" class="mr-1" /></template>
              </Button>
              <Button :label="$t('bonus_points.button.delete')" text size="small" severity="danger" @click="handleDelete(row)">
                <template #icon><FontAwesomeIcon :icon="['far', 'trash']" class="mr-1" /></template>
              </Button>
            </div>
          </div>

          <div v-if="!filteredList.length" class="py-12 text-center text-muted-color">
            {{ $t('common.pagination.total_records', { count: 0 }) }}
          </div>
        </div>
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

<style scoped>
/* 橫向捲軸常駐可見，提示右側還有欄位可看（design.md §7.5） */
:deep(.bonus-main-table .p-datatable-table-container) {
  overflow-x: scroll !important;
  scrollbar-gutter: stable;
}
:deep(.bonus-main-table .p-datatable-table-container::-webkit-scrollbar) {
  height: 12px !important;
}
:deep(.bonus-main-table .p-datatable-table-container::-webkit-scrollbar-track) {
  background: var(--p-surface-100) !important;
  border-radius: 6px !important;
}
:deep(.bonus-main-table .p-datatable-table-container::-webkit-scrollbar-thumb) {
  background: var(--p-surface-400) !important;
  border-radius: 6px !important;
  border: 2px solid var(--p-surface-100) !important;
}
/* 凍結「操作」欄補不透明底色，避免橫向捲動時內容透出 */
:deep(.bonus-main-table .p-datatable-tbody > tr > td.p-datatable-frozen-column),
:deep(.bonus-main-table .p-datatable-thead > tr > th.p-datatable-frozen-column) {
  background: var(--p-content-background);
  z-index: 3;
}
:deep(.bonus-main-table .p-datatable-tbody > tr:nth-child(even) > td.p-datatable-frozen-column) {
  background: var(--p-datatable-row-striped-background, var(--p-content-background));
}
:deep(.bonus-main-table .p-datatable-tbody > tr:hover > td.p-datatable-frozen-column) {
  background: var(--p-datatable-row-hover-background, var(--p-content-background));
}
</style>
