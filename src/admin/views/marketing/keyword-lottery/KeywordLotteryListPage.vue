<script setup lang="ts">
/**
 * 關鍵字抽獎列表頁（原型版）
 * — 三段式版型（design.md §6.7）：頁首列（標題 + 麵包屑，卡片外）／搜尋 Card（Tabs + 搜尋 + 頁首操作）／資料 Card
 * — 狀態 Tabs 即時篩選；關鍵字按「搜尋」才套用（pending → applied）
 * — 桌機 DataTable 凍結「操作」欄 + 左右捲動提示；手機 <md 改卡片列表（§7.5）
 * — 新增 / 編輯共用 KeywordLotteryFormDialog（參照 UAT 編輯頁）；原型階段資料存記憶體 ref，刪除尚未實作
 */
import { PaginationTable } from '@/admin/components/portal-ui';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { KeywordLotteryStatus, type KeywordLotteryRow } from './types';
import { mockKeywordLotteryList } from './mockData';
import KeywordLotteryFormDialog from './components/KeywordLotteryFormDialog.vue';
import { RouteName } from '@/admin/router';
import { useConfirm } from 'primevue/useconfirm';
import { useGlobalToast } from '@/admin/composables/useGlobalToast';

import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

const { t } = useI18n();
const router = useRouter();
const confirm = useConfirm();
const { showSuccess } = useGlobalToast();

type StatusFilter = 'all' | KeywordLotteryStatus;

// 關鍵字：keyword = 輸入框草稿；appliedKeyword = 按「搜尋」後才 commit 的過濾值
const keyword = ref('');
const appliedKeyword = ref('');
// 狀態頁籤：切換即時套用（不需按搜尋）
const statusTab = ref<StatusFilter>('all');

const rows = ref<KeywordLotteryRow[]>([...mockKeywordLotteryList]);

const statusTabs = computed<{ label: string; value: StatusFilter }[]>(() => [
  { label: t('keyword_lottery.status.all'), value: 'all' },
  { label: t('keyword_lottery.status.not_started'), value: KeywordLotteryStatus.NotStarted },
  { label: t('keyword_lottery.status.in_progress'), value: KeywordLotteryStatus.InProgress },
  { label: t('keyword_lottery.status.ended'), value: KeywordLotteryStatus.Ended },
  { label: t('keyword_lottery.status.drawn'), value: KeywordLotteryStatus.Drawn },
]);

// 全欄 nowrap；欄寬超過容器由 DataTable 橫向捲動，操作欄凍結在右
const columns = computed(() => [
  { field: 'sessionName', header: t('keyword_lottery.table.session_name'), slot: 'sessionName', nowrap: true },
  { field: 'drawSource', header: t('keyword_lottery.table.draw_source'), slot: 'drawSource', nowrap: true },
  { field: 'keyword', header: t('keyword_lottery.table.keyword'), slot: 'keyword', nowrap: true },
  { field: 'prizeContent', header: t('keyword_lottery.table.prize_content'), slot: 'prizeContent', nowrap: true },
  { field: 'winnerCount', header: t('keyword_lottery.table.winner_count'), nowrap: true },
  { field: 'period', header: t('keyword_lottery.table.period'), slot: 'period', nowrap: true },
  { field: 'status', header: t('keyword_lottery.table.status'), slot: 'status', nowrap: true },
  { field: 'createdAt', header: t('keyword_lottery.table.created_at'), slot: 'createdAt', nowrap: true, sortable: true },
  { field: 'actions', header: t('keyword_lottery.table.actions'), slot: 'actions', nowrap: true, frozen: true, alignFrozen: 'right' as const },
]);

const filteredList = computed<KeywordLotteryRow[]>(() => {
  const normalizedKeyword = appliedKeyword.value.trim().toLowerCase();

  return rows.value.filter((row) => {
    const matchKeyword
      = normalizedKeyword.length === 0
        || row.sessionName.toLowerCase().includes(normalizedKeyword)
        || row.keyword.toLowerCase().includes(normalizedKeyword);

    const matchStatus = statusTab.value === 'all' || statusOf(row) === statusTab.value;

    return matchKeyword && matchStatus;
  });
});

function onSearch() {
  appliedKeyword.value = keyword.value;
}

// ---- 呈現輔助 ----
const statusLabel = (status: KeywordLotteryStatus) => t(`keyword_lottery.status.${status}`);

const statusSeverity = (status: KeywordLotteryStatus): 'success' | 'warn' | 'info' | 'secondary' => {
  if (status === KeywordLotteryStatus.InProgress) return 'success';
  if (status === KeywordLotteryStatus.NotStarted) return 'warn';
  if (status === KeywordLotteryStatus.Drawn) return 'info';
  return 'secondary';
};

/** 依 drawn + 活動日期推導狀態：已抽獎為明確狀態；否則未到 start=預約中、區間內=活動中、過 end=已結束 */
function statusOf(row: KeywordLotteryRow): KeywordLotteryStatus {
  if (row.drawn) return KeywordLotteryStatus.Drawn;
  const now = Date.now();
  const start = new Date(row.startAt.replace(' ', 'T')).getTime();
  const end = new Date(row.endAt.replace(' ', 'T')).getTime();
  if (now < start) return KeywordLotteryStatus.NotStarted;
  if (now > end) return KeywordLotteryStatus.Ended;
  return KeywordLotteryStatus.InProgress;
}

const prizeText = (row: KeywordLotteryRow) => t(`keyword_lottery.prize_format.${row.prizeType}`, { content: row.prizeContent });

/** 場次名稱顯示：未啟用 / 空白時顯示「（未命名）」fallback */
const sessionDisplayName = (row: KeywordLotteryRow) => row.sessionName || t('keyword_lottery.value.unnamed');

/** 抽獎來源顯示（依直播場次 / 活動區間），沿用彈窗的 draw_source i18n */
const drawSourceLabel = (row: KeywordLotteryRow) => t(`keyword_lottery.form_dialog.draw_source.${row.drawSource}`);

// 日期格式：破折號 YYYY-MM-DD，比照 BonusPointsListPage（依需求覆蓋 design.md §7.9 斜線）；時間到分不到秒
/** 'YYYY-MM-DD ...' → 'YYYY-MM-DD' */
const formatDate = (value: string) => value.slice(0, 10);
/** 'YYYY-MM-DD HH:mm:ss' → 'YYYY-MM-DD HH:mm'（不顯示秒） */
const formatDateTime = (value: string) => `${formatDate(value)} ${value.slice(11, 16)}`;

// ---- 新增 / 編輯共用彈窗 ----
const isFormDialogVisible = ref(false);
const formMode = ref<'create' | 'edit'>('create');
const editingRow = ref<KeywordLotteryRow | null>(null);

function handleCreate() {
  formMode.value = 'create';
  editingRow.value = null;
  isFormDialogVisible.value = true;
}

function handleEdit(row: KeywordLotteryRow) {
  formMode.value = 'edit';
  editingRow.value = row;
  isFormDialogVisible.value = true;
}

function handleDraw(row: KeywordLotteryRow) {
  const target = router.resolve({
    name: RouteName.BidGiftLotteryDraw,
    params: { id: row.id },
    query: { session: row.sessionName },
  });
  window.open(target.href, '_blank', 'noopener');
}

function handleDelete(row: KeywordLotteryRow) {
  confirm.require({
    header: t('keyword_lottery.confirm.delete_title'),
    message: t('keyword_lottery.confirm.delete_message', { name: sessionDisplayName(row) }),
    defaultFocus: 'reject',
    rejectProps: { label: t('keyword_lottery.confirm.reject'), severity: 'secondary', outlined: true },
    acceptProps: { label: t('keyword_lottery.confirm.accept'), severity: 'danger' },
    accept: () => {
      rows.value = rows.value.filter((r) => r.id !== row.id);
      showSuccess({ detail: t('keyword_lottery.toast.deleted') });
    },
  });
}

// ---- 批次刪除 ----
const batchMode = ref(false);
const selected = ref<KeywordLotteryRow[]>([]);

function enterBatchMode() {
  batchMode.value = true;
  selected.value = [];
}

function exitBatchMode() {
  batchMode.value = false;
  selected.value = [];
}

// 切換頁籤 / 重新搜尋改變可見清單，清空勾選避免「勾了但已不在畫面上」的幽靈選取
watch([statusTab, appliedKeyword], () => {
  selected.value = [];
});

function handleBatchDelete() {
  const count = selected.value.length;
  if (count === 0) return;
  confirm.require({
    header: t('keyword_lottery.confirm.delete_title'),
    message: t('keyword_lottery.confirm.batch_delete_message', { count }),
    defaultFocus: 'reject',
    rejectProps: { label: t('keyword_lottery.confirm.reject'), severity: 'secondary', outlined: true },
    acceptProps: { label: t('keyword_lottery.confirm.accept'), severity: 'danger' },
    accept: () => {
      const ids = new Set(selected.value.map((r) => r.id));
      rows.value = rows.value.filter((r) => !ids.has(r.id));
      showSuccess({ detail: t('keyword_lottery.toast.batch_deleted', { count }) });
      exitBatchMode();
    },
  });
}

/** 產生新場次的建立時間字串 'YYYY-MM-DD HH:mm:ss' */
function nowStamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} `
    + `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** 彈窗送出：編輯 = 依 id 覆蓋；新增 = 補 id/createdAt 後插到最前 */
function handleFormSubmit(row: KeywordLotteryRow) {
  if (formMode.value === 'edit') {
    rows.value = rows.value.map((r) => (r.id === row.id ? row : r));
  } else {
    const nextId = String(
      rows.value.reduce((max, r) => Math.max(max, Number(r.id) || 0), 0) + 1,
    );
    rows.value = [{ ...row, id: nextId, createdAt: nowStamp() }, ...rows.value];
  }
}

// ── 桌機表格橫向捲動提示：資料還沒捲到底時，在凍結操作欄左側顯示漸層 + 可點 chevron（§7.5）──
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
  // 扣掉常駐捲軸保留的 ~16px 殘差，避免捲到底仍顯示
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
watch(filteredList, () => nextTick().then(measureTable));
</script>

<template>
  <div class="flex flex-1 flex-col gap-4 min-h-0">
    <!-- 頁首：標題 + 麵包屑，獨立一行（卡片外，見 design.md §6.7） -->
    <div class="flex flex-wrap items-center gap-3">
      <h2 class="text-2xl font-bold text-neutral-700 dark:text-neutral-100">
        {{ $t('keyword_lottery.title') }}
      </h2>
      <div class="ml-auto flex items-center gap-2 text-sm">
        <span class="text-muted-color">{{ $t('keyword_lottery.breadcrumb.parent') }}</span>
        <FontAwesomeIcon :icon="['far', 'chevron-right']" class="text-muted-color text-xs" />
        <span class="text-primary cursor-default">{{ $t('keyword_lottery.title') }}</span>
      </div>
    </div>

    <!-- 內容卡片 -->
    <Card>
      <template #content>
        <!-- 狀態頁籤：切換即時套用 -->
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

        <!-- 搜尋（左，按「搜尋」或 Enter 才套用）＋ 新增（右） -->
        <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <InputText
              v-model="keyword"
              :placeholder="$t('keyword_lottery.form.placeholder.search')"
              class="w-56 sm:w-72"
              @keyup.enter="onSearch"
            />
            <Button
              class="shrink-0"
              :label="$t('keyword_lottery.button.search')"
              @click="onSearch"
            />
          </div>
          <div v-if="!batchMode" class="flex items-center gap-2">
            <Button
              severity="danger"
              variant="outlined"
              :label="$t('keyword_lottery.button.batch_delete')"
              @click="enterBatchMode"
            >
              <template #icon>
                <FontAwesomeIcon :icon="['far', 'trash']" />
              </template>
            </Button>
            <Button
              :label="$t('keyword_lottery.button.create')"
              @click="handleCreate"
            >
              <template #icon>
                <FontAwesomeIcon :icon="['fas', 'plus']" />
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
              ? $t('keyword_lottery.batch.selected', { count: selected.length })
              : $t('keyword_lottery.batch.none_selected') }}
          </span>
          <div class="ml-auto flex items-center gap-2">
            <Button
              severity="secondary"
              outlined
              :label="$t('keyword_lottery.button.batch_cancel')"
              @click="exitBatchMode"
            />
            <Button
              severity="danger"
              :disabled="selected.length === 0"
              :label="$t('keyword_lottery.button.batch_delete_confirm')"
              @click="handleBatchDelete"
            />
          </div>
        </div>

        <!-- 共 N 筆（篩選列最右，§6.7） -->
        <div class="mb-4 flex justify-end">
          <span class="text-sm text-[var(--p-text-muted-color)] whitespace-nowrap">
            {{ $t('common.pagination.total_records', { count: filteredList.length }) }}
          </span>
        </div>

        <!-- 桌機表格：欄多會橫向捲動，凍結「操作」欄 + 左右捲動提示（§7.5） -->
        <div ref="tableScrollWrap" class="relative hidden md:block">
          <PaginationTable
            v-model:selection="selected"
            :data="filteredList"
            :columns="columns"
            :show-selection-column="batchMode"
            class="kw-main-table"
          >
            <template #sessionName="{ data }">
              <span :class="{ 'text-surface-400 dark:text-surface-500': !data.sessionName }">
                {{ sessionDisplayName(data) }}
              </span>
            </template>

            <template #drawSource="{ data }">
              {{ drawSourceLabel(data) }}
            </template>

            <template #keyword="{ data }">
              <Tag
                :value="data.keyword"
                severity="secondary"
              />
            </template>

            <template #period="{ data }">
              <div class="whitespace-nowrap">
                <div>{{ formatDateTime(data.startAt) }}</div>
                <div>~ {{ formatDateTime(data.endAt) }}</div>
              </div>
            </template>

            <template #prizeContent="{ data }">
              {{ prizeText(data) }}
            </template>

            <template #status="{ data }">
              <Tag
                :value="statusLabel(statusOf(data))"
                :severity="statusSeverity(statusOf(data))"
              />
            </template>

            <template #createdAt="{ data }">
              {{ formatDateTime(data.createdAt) }}
            </template>

            <template #actions="{ data }">
              <div class="flex items-center gap-1">
                <Button
                  v-tooltip.top="$t('keyword_lottery.button.draw')"
                  :aria-label="$t('keyword_lottery.button.draw')"
                  rounded
                  text
                  size="small"
                  severity="secondary"
                  @click="handleDraw(data)"
                >
                  <template #icon>
                    <FontAwesomeIcon :icon="['far', 'circle-play']" />
                  </template>
                </Button>
                <Button
                  v-tooltip.top="$t('keyword_lottery.button.edit')"
                  :aria-label="$t('keyword_lottery.button.edit')"
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
                  v-tooltip.top="$t('keyword_lottery.button.delete')"
                  :aria-label="$t('keyword_lottery.button.delete')"
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

        <!-- 手機（<md）：卡片列表（§7.5：divide-y 分隔、分層資訊、操作鈕帶文字） -->
        <div class="md:hidden divide-y divide-[var(--p-content-border-color)]">
          <div
            v-for="row in filteredList"
            :key="row.id"
            class="flex flex-col gap-2 px-1 py-3"
          >
            <!-- 主要識別（名稱 + 關鍵字 Tag）＋ 狀態 -->
            <div class="flex items-start justify-between gap-2">
              <div class="flex min-w-0 flex-col gap-1">
                <span
                  class="text-sm font-semibold break-words"
                  :class="{ 'text-surface-400 dark:text-surface-500': !row.sessionName }"
                >{{ sessionDisplayName(row) }}</span>
                <Tag
                  :value="row.keyword"
                  severity="secondary"
                  class="w-fit"
                />
              </div>
              <Tag
                :value="statusLabel(statusOf(row))"
                :severity="statusSeverity(statusOf(row))"
                class="shrink-0"
              />
            </div>

            <!-- 次要資訊（收為一底色區塊，每筆加 label） -->
            <div class="flex flex-col gap-1 rounded-md bg-surface-50 px-2 py-2 text-sm dark:bg-surface-800/40">
              <div class="flex gap-2">
                <span class="shrink-0 text-surface-400 dark:text-surface-500">{{ $t('keyword_lottery.table.draw_source') }}</span>
                <span>{{ drawSourceLabel(row) }}</span>
              </div>
              <div class="flex gap-2">
                <span class="shrink-0 text-surface-400 dark:text-surface-500">{{ $t('keyword_lottery.table.period') }}</span>
                <span class="break-words">{{ formatDateTime(row.startAt) }} ~ {{ formatDateTime(row.endAt) }}</span>
              </div>
              <div class="flex gap-2">
                <span class="shrink-0 text-surface-400 dark:text-surface-500">{{ $t('keyword_lottery.table.prize_content') }}</span>
                <span class="break-words">{{ prizeText(row) }}</span>
              </div>
              <div class="flex gap-2">
                <span class="shrink-0 text-surface-400 dark:text-surface-500">{{ $t('keyword_lottery.table.winner_count') }}</span>
                <span>{{ row.winnerCount }}</span>
              </div>
              <div class="flex gap-2">
                <span class="shrink-0 text-surface-400 dark:text-surface-500">{{ $t('keyword_lottery.table.created_at') }}</span>
                <span>{{ formatDateTime(row.createdAt) }}</span>
              </div>
            </div>

            <!-- 操作列（帶文字 label；開始抽獎排最左） -->
            <div class="flex flex-wrap justify-end gap-2">
              <Button :label="$t('keyword_lottery.button.draw')" text size="small" severity="secondary" @click="handleDraw(row)">
                <template #icon><FontAwesomeIcon :icon="['far', 'circle-play']" /></template>
              </Button>
              <Button :label="$t('keyword_lottery.button.edit')" text size="small" @click="handleEdit(row)">
                <template #icon><FontAwesomeIcon :icon="['far', 'edit']" /></template>
              </Button>
              <Button :label="$t('keyword_lottery.button.delete')" text size="small" severity="danger" @click="handleDelete(row)">
                <template #icon><FontAwesomeIcon :icon="['far', 'trash']" /></template>
              </Button>
            </div>
          </div>

          <div v-if="!filteredList.length" class="py-12 text-center text-muted-color">
            {{ $t('common.no_data') }}
          </div>
        </div>
      </template>
    </Card>

    <KeywordLotteryFormDialog
      v-model:visible="isFormDialogVisible"
      :mode="formMode"
      :row="editingRow"
      @submit="handleFormSubmit"
    />
  </div>
</template>

<style scoped>
/* 橫向捲軸常駐可見，提示右側還有欄位可看（design.md §7.5） */
:deep(.kw-main-table .p-datatable-table-container) {
  overflow-x: scroll !important;
  scrollbar-gutter: stable;
}
:deep(.kw-main-table .p-datatable-table-container::-webkit-scrollbar) {
  height: 12px !important;
}
:deep(.kw-main-table .p-datatable-table-container::-webkit-scrollbar-track) {
  background: var(--p-surface-100) !important;
  border-radius: 6px !important;
}
:deep(.kw-main-table .p-datatable-table-container::-webkit-scrollbar-thumb) {
  background: var(--p-surface-400) !important;
  border-radius: 6px !important;
  border: 2px solid var(--p-surface-100) !important;
}
/* 凍結「操作」欄補不透明底色，避免橫向捲動時內容透出 */
:deep(.kw-main-table .p-datatable-tbody > tr > td.p-datatable-frozen-column),
:deep(.kw-main-table .p-datatable-thead > tr > th.p-datatable-frozen-column) {
  background: var(--p-content-background);
  z-index: 3;
}
:deep(.kw-main-table .p-datatable-tbody > tr:nth-child(even) > td.p-datatable-frozen-column) {
  background: var(--p-datatable-row-striped-background, var(--p-content-background));
}
:deep(.kw-main-table .p-datatable-tbody > tr:hover > td.p-datatable-frozen-column) {
  background: var(--p-datatable-row-hover-background, var(--p-content-background));
}
</style>
