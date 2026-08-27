<script setup lang="ts">
import { PaginationTable } from '@/admin/components/portal-ui';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { LotteryStatus, PrizeType, type BidGiftLotteryRow } from './types';
import { loadLotteryRows, saveLotteryRows } from './lotteryStore';
import BidGiftLotteryFormDialog from './components/BidGiftLotteryFormDialog.vue';

import { RouteName } from '@/admin/router';

import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

const { t } = useI18n();
const router = useRouter();

type StatusFilter = 'all' | LotteryStatus;

// 關鍵字：keyword = 輸入框草稿；appliedKeyword = 按下「搜尋」後才 commit 的實際過濾值
const keyword = ref('');
const appliedKeyword = ref('');
// 狀態頁籤：切換即時套用（不需按搜尋）
const statusTab = ref<StatusFilter>('all');

const statusTabs = computed<{ label: string; value: StatusFilter }[]>(() => [
  { label: t('bid_gift_lottery.status.all'), value: 'all' },
  { label: t('bid_gift_lottery.status.in_progress'), value: LotteryStatus.InProgress },
  { label: t('bid_gift_lottery.status.ended'), value: LotteryStatus.Ended },
]);

/** 按下「搜尋」（或輸入框 Enter）才把草稿關鍵字 commit 到 applied 觸發過濾 */
function onSearch() {
  appliedKeyword.value = keyword.value;
}

// 場次資料：原型階段存 localStorage（lotteryStore），讓「開始抽獎」另開分頁也讀得到最新設定
const rows = ref<BidGiftLotteryRow[]>(loadLotteryRows());

// 全欄 nowrap：表頭與內容都撐到自然寬度、不逐字斷行；欄位總寬超過容器時由 DataTable 橫向捲動
const columns = computed(() => [
  { field: 'createdAt', header: t('bid_gift_lottery.table.created_at'), slot: 'createdAt', nowrap: true },
  { field: 'sessionName', header: t('bid_gift_lottery.table.session_name'), nowrap: true },
  { field: 'searchDate', header: t('bid_gift_lottery.table.search_date'), slot: 'searchDate', nowrap: true },
  { field: 'prizeType', header: t('bid_gift_lottery.table.prize_type'), slot: 'prizeType', nowrap: true },
  { field: 'prizeContent', header: t('bid_gift_lottery.table.prize_content'), nowrap: true },
  { field: 'requiredAmount', header: t('bid_gift_lottery.table.required_amount'), slot: 'requiredAmount', nowrap: true },
  { field: 'starFilter', header: t('bid_gift_lottery.table.star_filter'), slot: 'starFilter', nowrap: true },
  { field: 'status', header: t('bid_gift_lottery.table.status'), slot: 'status', nowrap: true },
  { field: 'actions', header: t('bid_gift_lottery.table.actions'), slot: 'actions', nowrap: true },
]);

const filteredList = computed<BidGiftLotteryRow[]>(() => {
  const normalizedKeyword = appliedKeyword.value.trim().toLowerCase();

  return rows.value.filter((row) => {
    const matchKeyword
      = normalizedKeyword.length === 0
        || row.sessionName.toLowerCase().includes(normalizedKeyword)
        || row.prizeContent.toLowerCase().includes(normalizedKeyword);

    const matchStatus = statusTab.value === 'all' || row.status === statusTab.value;

    return matchKeyword && matchStatus;
  });
});

const prizeTypeLabel = (prizeType: PrizeType) => t(`bid_gift_lottery.prize_type.${prizeType}`);
const statusLabel = (status: LotteryStatus) => t(`bid_gift_lottery.status.${status}`);

const formatAmount = (value: number | null) => (
  value === null
    ? t('bid_gift_lottery.value.unlimited')
    : t('bid_gift_lottery.value.amount', { value })
);

const formatStars = (value: number | null) => (
  value === null ? t('bid_gift_lottery.value.unlimited') : String(value)
);

// §7.9 日期時間格式：日期一律斜線 YYYY/MM/DD；日期+時間到分不到秒；日期區間用 ' - ' 分隔
/** 'YYYY-MM-DD ...' → 'YYYY/MM/DD' */
const formatDate = (value: string) => value.slice(0, 10).replace(/-/g, '/');
/** 'YYYY-MM-DD HH:mm:ss' → 'YYYY/MM/DD HH:mm'（不顯示秒） */
const formatDateTime = (value: string) => `${formatDate(value)} ${value.slice(11, 16)}`;
/** 搜尋日期區間（純日期）→ 'YYYY/MM/DD - YYYY/MM/DD' */
const formatSearchRange = (start: string, end: string) => `${formatDate(start)} - ${formatDate(end)}`;

const statusSeverity = (status: LotteryStatus) => (
  status === LotteryStatus.InProgress ? 'success' : 'secondary'
);

// 新增 / 編輯共用同一彈窗；mode 決定 header 與帶入資料
const isFormDialogVisible = ref(false);
const formMode = ref<'create' | 'edit'>('create');
const editingRow = ref<BidGiftLotteryRow | null>(null);

function handleCreate() {
  formMode.value = 'create';
  editingRow.value = null;
  isFormDialogVisible.value = true;
}

function handleDraw(row: BidGiftLotteryRow) {
  const target = router.resolve({ name: RouteName.BidGiftLotteryDraw, params: { id: row.id } });
  window.open(target.href, '_blank', 'noopener');
}

function handleEdit(row: BidGiftLotteryRow) {
  formMode.value = 'edit';
  editingRow.value = row;
  isFormDialogVisible.value = true;
}

function handleDelete(_row: BidGiftLotteryRow) {
  // 原型階段：尚未實作刪除流程
}

/** 產生新場次的建立時間字串 'YYYY-MM-DD HH:mm:ss' */
function nowStamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} `
    + `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** 彈窗送出：編輯 = 依 id 覆蓋；新增 = 補 id/createdAt 後插到最前。寫回 localStorage 供開獎頁分頁讀取 */
function handleFormSubmit(row: BidGiftLotteryRow) {
  if (formMode.value === 'edit') {
    rows.value = rows.value.map((r) => (r.id === row.id ? row : r));
  } else {
    const nextId = String(
      rows.value.reduce((max, r) => Math.max(max, Number(r.id) || 0), 0) + 1,
    );
    rows.value = [{ ...row, id: nextId, createdAt: nowStamp() }, ...rows.value];
  }
  saveLotteryRows(rows.value);
}
</script>

<template>
  <div class="flex flex-1 flex-col gap-4 min-h-0">
    <!-- 頁首：標題 + 麵包屑，獨立一行（卡片外） -->
    <div class="flex flex-wrap items-center gap-3">
      <h2 class="text-2xl font-bold text-neutral-700 dark:text-neutral-100">
        {{ $t('bid_gift_lottery.title') }}
      </h2>
      <div class="ml-auto flex items-center gap-2 text-sm">
        <span class="text-color-secondary">{{ $t('bid_gift_lottery.breadcrumb.parent') }}</span>
        <i class="pi pi-chevron-right text-color-secondary" style="font-size: 10px"></i>
        <span class="text-primary cursor-default">{{ $t('bid_gift_lottery.title') }}</span>
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
              :placeholder="$t('bid_gift_lottery.form.placeholder.search')"
              class="w-56 sm:w-80"
              @keyup.enter="onSearch"
            />
            <Button
              class="shrink-0"
              :label="$t('bid_gift_lottery.button.search')"
              @click="onSearch"
            />
          </div>
          <Button
            :label="$t('bid_gift_lottery.button.create')"
            @click="handleCreate"
          >
            <template #icon>
              <FontAwesomeIcon :icon="['fas', 'plus']" class="mr-2" />
            </template>
          </Button>
        </div>

        <PaginationTable
          :data="filteredList"
          :columns="columns"
        >
      <template #createdAt="{ data }">
        {{ formatDateTime(data.createdAt) }}
      </template>

      <template #searchDate="{ data }">
        {{ formatSearchRange(data.searchStartAt, data.searchEndAt) }}
      </template>

      <template #prizeType="{ data }">
        {{ prizeTypeLabel(data.prizeType) }}
      </template>

      <template #requiredAmount="{ data }">
        {{ formatAmount(data.requiredAmount) }}
      </template>

      <template #starFilter="{ data }">
        {{ formatStars(data.starFilter) }}
      </template>

      <template #status="{ data }">
        <Tag
          :value="statusLabel(data.status)"
          :severity="statusSeverity(data.status)"
        />
      </template>

      <template #actions="{ data }">
        <div class="flex items-center gap-1">
          <Button
            v-tooltip.top="$t('bid_gift_lottery.button.draw')"
            :aria-label="$t('bid_gift_lottery.button.draw')"
            icon="pi pi-play"
            rounded
            text
            size="small"
            severity="success"
            @click="handleDraw(data)"
          />
          <Button
            v-tooltip.top="$t('bid_gift_lottery.button.edit')"
            :aria-label="$t('bid_gift_lottery.button.edit')"
            icon="pi pi-pen-to-square"
            rounded
            text
            size="small"
            @click="handleEdit(data)"
          />
          <Button
            v-tooltip.top="$t('bid_gift_lottery.button.delete')"
            :aria-label="$t('bid_gift_lottery.button.delete')"
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

    <BidGiftLotteryFormDialog
      v-model:visible="isFormDialogVisible"
      :mode="formMode"
      :row="editingRow"
      @submit="handleFormSubmit"
    />
  </div>
</template>
