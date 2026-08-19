<script setup lang="ts">
/**
 * 通知紀錄視窗
 * - 批次通知模式（bidId = null）：以場次為單位列出每次通知的發送統計
 * - 單筆列動作（bidId 有值）：僅列出該筆標單自身的通知紀錄（建立時間、通知類型、通知管道、結果）
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

interface Props {
  visible: boolean;
  /** 單筆模式時傳入該筆標單 id；批次／場次模式為 null */
  bidId?: string | null;
}

interface Emits {
  (event: 'update:visible', value: boolean): void;
}

const props = withDefaults(defineProps<Props>(), {
  bidId: null,
});
const emit = defineEmits<Emits>();

const { t } = useI18n();

const localVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value),
});

/** 是否為單筆模式 */
const isSingleMode = computed(() => props.bidId !== null && props.bidId !== undefined);

/** 視窗標題：依模式切換 */
const dialogHeader = computed(() =>
  isSingleMode.value
    ? t('bid_list.notify_history.title_single', { bidId: props.bidId })
    : t('bid_list.notify_history.title'),
);

interface HistoryRow {
  id: number;
  createdAt: string;
  sessionName: string;
  /** 通知類型 i18n key（得標通知／結帳通知） */
  triggerKey: string;
  count: number;
  resultPending: number;
  resultSuccess: number;
  resultFail: number;
  resultError: number;
}

/**
 * 場次別 mock：一列一場次（批次通知情境）
 * 涵蓋不同場次、觸發類型（催單／得標通知）、多樣結果狀態組合，時間分散近 30 天。
 */
const sessionHistoryRows: HistoryRow[] = [
  {
    id: 1,
    createdAt: '2026-07-14 10:05:12',
    sessionName: '0114',
    triggerKey: 'bid_list.notify_history.trigger.bid_win',
    count: 8,
    resultPending: 4,
    resultSuccess: 4,
    resultFail: 0,
    resultError: 0,
  },
  {
    id: 2,
    createdAt: '2026-07-13 18:22:07',
    sessionName: '0114',
    triggerKey: 'bid_list.notify_history.trigger.cashout',
    count: 6,
    resultPending: 0,
    resultSuccess: 6,
    resultFail: 0,
    resultError: 0,
  },
  {
    id: 3,
    createdAt: '2026-07-12 20:15:44',
    sessionName: '0712 夜市',
    triggerKey: 'bid_list.notify_history.trigger.bid_win',
    count: 12,
    resultPending: 2,
    resultSuccess: 8,
    resultFail: 2,
    resultError: 0,
  },
  {
    id: 4,
    createdAt: '2026-07-11 21:40:29',
    sessionName: 'Test 0711-2',
    triggerKey: 'bid_list.notify_history.trigger.cashout',
    count: 3,
    resultPending: 0,
    resultSuccess: 3,
    resultFail: 0,
    resultError: 0,
  },
  {
    id: 5,
    createdAt: '2026-07-10 19:48:33',
    sessionName: '社團團購場',
    triggerKey: 'bid_list.notify_history.trigger.bid_win',
    count: 20,
    resultPending: 0,
    resultSuccess: 17,
    resultFail: 2,
    resultError: 1,
  },
  {
    id: 6,
    createdAt: '2026-07-09 15:03:16',
    sessionName: '0709 夏季特賣',
    triggerKey: 'bid_list.notify_history.trigger.bid_win',
    count: 5,
    resultPending: 0,
    resultSuccess: 4,
    resultFail: 0,
    resultError: 1,
  },
  {
    id: 7,
    createdAt: '2026-07-08 11:22:58',
    sessionName: 'LiveBuy 首頁',
    triggerKey: 'bid_list.notify_history.trigger.cashout',
    count: 1,
    resultPending: 1,
    resultSuccess: 0,
    resultFail: 0,
    resultError: 0,
  },
  {
    id: 8,
    createdAt: '2026-07-05 14:33:11',
    sessionName: '0705 預購場',
    triggerKey: 'bid_list.notify_history.trigger.cashout',
    count: 2,
    resultPending: 0,
    resultSuccess: 1,
    resultFail: 1,
    resultError: 0,
  },
  {
    id: 9,
    createdAt: '2026-07-02 09:14:20',
    sessionName: '0709 夏季特賣',
    triggerKey: 'bid_list.notify_history.trigger.cashout',
    count: 7,
    resultPending: 0,
    resultSuccess: 5,
    resultFail: 1,
    resultError: 1,
  },
  {
    id: 10,
    createdAt: '2026-06-30 13:35:02',
    sessionName: 'test0630',
    triggerKey: 'bid_list.notify_history.trigger.bid_win',
    count: 4,
    resultPending: 0,
    resultSuccess: 4,
    resultFail: 0,
    resultError: 0,
  },
  {
    id: 11,
    createdAt: '2026-06-23 02:47:41',
    sessionName: 'test-0623-1',
    triggerKey: 'bid_list.notify_history.trigger.cashout',
    count: 4,
    resultPending: 0,
    resultSuccess: 2,
    resultFail: 2,
    resultError: 0,
  },
];

interface SingleHistoryRow {
  id: number;
  /** 對應的標單 id */
  bidId: string;
  createdAt: string;
  /** 通知類型 i18n key */
  notifyTypeKey: string;
  /** 通知管道 i18n key */
  channelKey: string;
  /** 結果狀態 i18n key */
  statusKey: string;
}

/**
 * 單筆標單專屬 mock：依 bidId 對應多筆通知紀錄。
 * bidId 均對齊 useBidListMock.ts 中實際存在的標單 id；
 * 未列出的 bidId 開啟視窗時走 empty state（保留驗證空狀態能力）。
 * 每個 bidId 內部依 createdAt 由新到舊排序。
 */
const singleHistoryRows: SingleHistoryRow[] = [
  // ---- 20260714-001（0114 場次 × 米色外衣，未完成）— 4 筆 ----
  {
    id: 1,
    bidId: '20260714-001',
    createdAt: '2026-07-14 10:05:12',
    notifyTypeKey: 'bid_list.notify_cashout.notify_type.urge',
    channelKey: 'bid_list.notify_cashout.channel.line',
    statusKey: 'bid_list.notify_history.status.success',
  },
  {
    id: 2,
    bidId: '20260714-001',
    createdAt: '2026-07-13 21:12:44',
    notifyTypeKey: 'bid_list.notify_cashout.notify_type.bid_win',
    channelKey: 'bid_list.notify_cashout.channel.messenger',
    statusKey: 'bid_list.notify_history.status.success',
  },
  {
    id: 3,
    bidId: '20260714-001',
    createdAt: '2026-07-13 09:00:03',
    notifyTypeKey: 'bid_list.notify_cashout.notify_type.bid_win',
    channelKey: 'bid_list.notify_cashout.channel.line',
    statusKey: 'bid_list.notify_history.status.fail',
  },
  {
    id: 4,
    bidId: '20260714-001',
    createdAt: '2026-07-12 15:22:10',
    notifyTypeKey: 'bid_list.notify_cashout.notify_type.bid_win',
    channelKey: 'bid_list.notify_cashout.channel.sms',
    statusKey: 'bid_list.notify_history.status.pending',
  },
  // ---- 20260714-001b（0114 場次 × 米色外衣，未完成）— 3 筆 ----
  {
    id: 5,
    bidId: '20260714-001b',
    createdAt: '2026-07-14 11:02:47',
    notifyTypeKey: 'bid_list.notify_cashout.notify_type.urge',
    channelKey: 'bid_list.notify_cashout.channel.line',
    statusKey: 'bid_list.notify_history.status.pending',
  },
  {
    id: 6,
    bidId: '20260714-001b',
    createdAt: '2026-07-14 09:32:19',
    notifyTypeKey: 'bid_list.notify_cashout.notify_type.bid_win',
    channelKey: 'bid_list.notify_cashout.channel.line',
    statusKey: 'bid_list.notify_history.status.success',
  },
  {
    id: 7,
    bidId: '20260714-001b',
    createdAt: '2026-07-14 09:24:55',
    notifyTypeKey: 'bid_list.notify_cashout.notify_type.bid_win',
    channelKey: 'bid_list.notify_cashout.channel.messenger',
    statusKey: 'bid_list.notify_history.status.success',
  },
  // ---- 20260714-001c（0114 場次 × 米色外衣，已轉單）— 4 筆 ----
  {
    id: 8,
    bidId: '20260714-001c',
    createdAt: '2026-07-14 12:44:31',
    notifyTypeKey: 'bid_list.notify_cashout.notify_type.urge',
    channelKey: 'bid_list.notify_cashout.channel.messenger',
    statusKey: 'bid_list.notify_history.status.success',
  },
  {
    id: 9,
    bidId: '20260714-001c',
    createdAt: '2026-07-14 10:18:02',
    notifyTypeKey: 'bid_list.notify_cashout.notify_type.urge',
    channelKey: 'bid_list.notify_cashout.channel.sms',
    statusKey: 'bid_list.notify_history.status.fail',
  },
  {
    id: 10,
    bidId: '20260714-001c',
    createdAt: '2026-07-14 09:41:11',
    notifyTypeKey: 'bid_list.notify_cashout.notify_type.bid_win',
    channelKey: 'bid_list.notify_cashout.channel.line',
    statusKey: 'bid_list.notify_history.status.success',
  },
  {
    id: 11,
    bidId: '20260714-001c',
    createdAt: '2026-07-14 09:36:00',
    notifyTypeKey: 'bid_list.notify_cashout.notify_type.bid_win',
    channelKey: 'bid_list.notify_cashout.channel.messenger',
    statusKey: 'bid_list.notify_history.status.success',
  },
  // ---- 20260711-002（Test 0711-2 × ooo111，未完成）— 2 筆 ----
  {
    id: 12,
    bidId: '20260711-002',
    createdAt: '2026-07-12 18:45:22',
    notifyTypeKey: 'bid_list.notify_cashout.notify_type.urge',
    channelKey: 'bid_list.notify_cashout.channel.sms',
    statusKey: 'bid_list.notify_history.status.pending',
  },
  {
    id: 13,
    bidId: '20260711-002',
    createdAt: '2026-07-12 11:30:07',
    notifyTypeKey: 'bid_list.notify_cashout.notify_type.bid_win',
    channelKey: 'bid_list.notify_cashout.channel.line',
    statusKey: 'bid_list.notify_history.status.success',
  },
  // ---- 20260711-003（Test 0711-2 × go，已轉單）— 2 筆 ----
  {
    id: 14,
    bidId: '20260711-003',
    createdAt: '2026-07-12 09:05:38',
    notifyTypeKey: 'bid_list.notify_cashout.notify_type.urge',
    channelKey: 'bid_list.notify_cashout.channel.line',
    statusKey: 'bid_list.notify_history.status.success',
  },
  {
    id: 15,
    bidId: '20260711-003',
    createdAt: '2026-07-11 22:05:14',
    notifyTypeKey: 'bid_list.notify_cashout.notify_type.bid_win',
    channelKey: 'bid_list.notify_cashout.channel.messenger',
    statusKey: 'bid_list.notify_history.status.fail',
  },
  // ---- 20260711-003b（Test 0711-2 × go，未完成）— 2 筆 ----
  {
    id: 16,
    bidId: '20260711-003b',
    createdAt: '2026-07-13 10:20:47',
    notifyTypeKey: 'bid_list.notify_cashout.notify_type.urge',
    channelKey: 'bid_list.notify_cashout.channel.line',
    statusKey: 'bid_list.notify_history.status.success',
  },
  {
    id: 17,
    bidId: '20260711-003b',
    createdAt: '2026-07-11 22:08:52',
    notifyTypeKey: 'bid_list.notify_cashout.notify_type.bid_win',
    channelKey: 'bid_list.notify_cashout.channel.line',
    statusKey: 'bid_list.notify_history.status.success',
  },
  // ---- 20260623-004（test-0623-1 × 精華液安瓶，已轉完成單）— 1 筆 ----
  {
    id: 18,
    bidId: '20260623-004',
    createdAt: '2026-06-23 02:32:18',
    notifyTypeKey: 'bid_list.notify_cashout.notify_type.bid_win',
    channelKey: 'bid_list.notify_cashout.channel.line',
    statusKey: 'bid_list.notify_history.status.success',
  },
  // ---- 20260711-P01（Test 0711-2 × go 預購，未完成）— 1 筆 ----
  {
    id: 19,
    bidId: '20260711-P01',
    createdAt: '2026-07-11 22:00:31',
    notifyTypeKey: 'bid_list.notify_cashout.notify_type.bid_win',
    channelKey: 'bid_list.notify_cashout.channel.messenger',
    statusKey: 'bid_list.notify_history.status.pending',
  },
];

/** 單筆模式下要顯示的資料（依 bidId 過濾；不在 mock 中則走 empty state） */
const filteredSingleRows = computed(() =>
  props.bidId ? singleHistoryRows.filter((row) => row.bidId === props.bidId) : [],
);

/** 單筆結果狀態 → Tag severity（成功／失敗／待處理） */
function statusSeverity(statusKey: string): 'success' | 'danger' | 'warn' | 'secondary' {
  if (statusKey.endsWith('.success')) return 'success';
  if (statusKey.endsWith('.fail')) return 'danger';
  if (statusKey.endsWith('.pending')) return 'warn';
  return 'secondary';
}
</script>

<template>
  <Dialog
    v-model:visible="localVisible"
    modal
    :header="dialogHeader"
    :style="{ width: '60rem' }"
  >
    <!-- 單筆模式：該筆標單的通知紀錄（§7.5：DataTable） -->
    <DataTable
      v-if="isSingleMode"
      :value="filteredSingleRows"
      data-key="id"
      striped-rows
      class="text-sm"
    >
      <Column
        header="#"
        header-style="width: 3rem"
      >
        <template #body="{ index }">
          {{ index + 1 }}
        </template>
      </Column>
      <Column
        :header="t('bid_list.notify_history.column.created_at')"
        field="createdAt"
        body-class="whitespace-nowrap"
      />
      <Column
        :header="t('bid_list.notify_history.column.notify_type')"
        body-class="whitespace-nowrap"
      >
        <template #body="{ data }: { data: SingleHistoryRow }">
          {{ t(data.notifyTypeKey) }}
        </template>
      </Column>
      <Column
        :header="t('bid_list.notify_history.column.channel')"
        body-class="whitespace-nowrap"
      >
        <template #body="{ data }: { data: SingleHistoryRow }">
          {{ t(data.channelKey) }}
        </template>
      </Column>
      <Column :header="t('bid_list.notify_history.column.status')">
        <template #body="{ data }: { data: SingleHistoryRow }">
          <Tag
            :value="t(data.statusKey)"
            :severity="statusSeverity(data.statusKey)"
          />
        </template>
      </Column>
      <template #empty>
        <div class="py-8 text-center text-sm text-surface-500 dark:text-surface-400">
          {{ t('bid_list.notify_history.empty_single') }}
        </div>
      </template>
    </DataTable>

    <!-- 場次彙總模式：一列一場次（§7.5：DataTable） -->
    <DataTable
      v-else
      :value="sessionHistoryRows"
      data-key="id"
      striped-rows
      class="text-sm"
    >
      <Column
        header="#"
        header-style="width: 3rem"
      >
        <template #body="{ index }">
          {{ index + 1 }}
        </template>
      </Column>
      <Column
        :header="t('bid_list.notify_history.column.created_at')"
        field="createdAt"
        body-class="whitespace-nowrap"
      />
      <Column
        :header="t('bid_list.notify_history.column.sessions')"
        field="sessionName"
        body-class="whitespace-nowrap"
      />
      <Column
        :header="t('bid_list.notify_history.column.trigger')"
        body-class="whitespace-nowrap"
      >
        <template #body="{ data }: { data: HistoryRow }">
          {{ t(data.triggerKey) }}
        </template>
      </Column>
      <Column
        :header="t('bid_list.notify_history.column.count')"
        field="count"
        header-class="text-right"
        body-class="text-right"
      />
      <Column :header="t('bid_list.notify_history.column.result')">
        <template #body="{ data }: { data: HistoryRow }">
          <div class="flex flex-col gap-1 text-xs">
            <span
              v-if="data.resultPending"
              class="text-amber-600 dark:text-amber-400"
            >
              {{ t('bid_list.notify_history.result.pending', { count: data.resultPending }) }}
            </span>
            <span
              v-if="data.resultSuccess"
              class="text-emerald-600 dark:text-emerald-400"
            >
              {{ t('bid_list.notify_history.result.success', { count: data.resultSuccess }) }}
            </span>
            <span
              v-if="data.resultFail"
              class="text-red-600 dark:text-red-400"
            >
              {{ t('bid_list.notify_history.result.fail', { count: data.resultFail }) }}
            </span>
            <span
              v-if="data.resultError"
              class="text-red-600 dark:text-red-400"
            >
              {{ t('bid_list.notify_history.result.error', { count: data.resultError }) }}
            </span>
          </div>
        </template>
      </Column>
    </DataTable>
    <template #footer>
      <Button
        severity="secondary"
        outlined
        @click="localVisible = false"
      >
        {{ t('bid_list.notify_history.button.close') }}
      </Button>
    </template>
  </Dialog>
</template>
