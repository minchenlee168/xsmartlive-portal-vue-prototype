<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { BidListRow } from '../composables/useBidListMock';

interface Props {
  visible: boolean;
  /** 由批次模式帶入的已勾選列（供顯示筆數與預覽） */
  selectedRows?: BidListRow[];
}

interface Emits {
  (event: 'update:visible', value: boolean): void;
  /**
   * 打開通知紀錄。
   * - `isSingle=true`：由單筆列動作開啟（selectedRows.length === 1），`bidId` 為該列 id
   * - `isSingle=false`：由批次通知開啟，`bidId` 為 null
   */
  (event: 'open-history', payload: { isSingle: boolean; bidId: string | null }): void;
  (event: 'send', payload: { notifyType: 'bid_win' | 'urge'; channel: string }): void;
}

const props = withDefaults(defineProps<Props>(), {
  selectedRows: () => [],
});
const emit = defineEmits<Emits>();

const { t } = useI18n();

const localVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value),
});

/** 標題：單筆列動作開啟（僅 1 列）為「通知」，批次通知為「批次通知」 */
const dialogTitle = computed(() =>
  props.selectedRows.length === 1
    ? t('bid_list.notify.title_single')
    : t('bid_list.notify.title_cashout'),
);

/** 通知類型：得標通知（bid_win）／催單（urge），預設催單 */
const notifyType = ref<'bid_win' | 'urge'>('urge');
const notifyTypeOptions = computed(() => [
  { value: 'urge', label: t('bid_list.notify_cashout.notify_type.urge') },
  { value: 'bid_win', label: t('bid_list.notify_cashout.notify_type.bid_win') },
]);

/** 通知管道：LINE / Messenger / 簡訊 */
const cashoutChannel = ref<'line' | 'messenger' | 'sms'>('line');
const cashoutChannelOptions = computed(() => [
  { value: 'line', label: t('bid_list.notify_cashout.channel.line') },
  { value: 'messenger', label: t('bid_list.notify_cashout.channel.messenger') },
  { value: 'sms', label: t('bid_list.notify_cashout.channel.sms') },
]);

watch(localVisible, (open) => {
  if (open) {
    notifyType.value = 'urge';
    cashoutChannel.value = 'line';
  }
});

function handleSend() {
  emit('send', {
    notifyType: notifyType.value,
    channel: cashoutChannel.value,
  });
}

/** 由批次模式帶入的筆數 */
const cashoutRowCount = computed(() => props.selectedRows.length);

/** send 是否可按（有帶入列即可） */
const canSendCashout = computed(() => cashoutRowCount.value > 0);

/** 打開通知紀錄：依帶入列數判斷單筆／批次情境 */
function handleOpenHistory() {
  const isSingle = props.selectedRows.length === 1;
  const bidId = isSingle ? props.selectedRows[0].id : null;
  emit('open-history', { isSingle, bidId });
}
</script>

<template>
  <Dialog
    v-model:visible="localVisible"
    modal
    :header="dialogTitle"
    :style="{ width: '48rem' }"
  >
    <div class="flex flex-col gap-4">
      <div class="flex items-center gap-3 flex-wrap">
        <label class="text-sm text-slate-600 dark:text-slate-300">
          {{ t('bid_list.notify_cashout.notify_type_label') }}
        </label>
        <SelectButton
          v-model="notifyType"
          :options="notifyTypeOptions"
          option-label="label"
          option-value="value"
          :allow-empty="false"
        />
      </div>

      <div class="flex items-center justify-between gap-3 flex-wrap">
        <div class="flex items-center gap-3 flex-wrap">
          <label class="text-sm text-slate-600 dark:text-slate-300">
            {{ t('bid_list.notify_cashout.channel_label') }}
          </label>
          <SelectButton
            v-model="cashoutChannel"
            :options="cashoutChannelOptions"
            option-label="label"
            option-value="value"
            :allow-empty="false"
          />
        </div>
        <Button
          severity="primary"
          outlined
          @click="handleOpenHistory"
        >
          {{ t('bid_list.notify_cashout.button.history') }}
        </Button>
      </div>

      <div class="text-xs text-slate-500 dark:text-slate-400">
        {{ t('bid_list.notify_cashout.hint.line_unbound') }}
      </div>

      <div class="border border-slate-200 dark:border-slate-700 rounded p-3 bg-slate-50 dark:bg-slate-900">
        <div class="text-sm text-slate-700 dark:text-slate-200 font-medium mb-2">
          {{ t('bid_list.notify_cashout.summary.title', { count: cashoutRowCount }) }}
        </div>
        <div
          v-if="cashoutRowCount === 0"
          class="text-sm text-slate-400"
        >
          {{ t('bid_list.notify_cashout.summary.empty') }}
        </div>
        <ul
          v-else
          class="flex flex-col gap-1 max-h-72 overflow-auto"
        >
          <li
            v-for="row in props.selectedRows"
            :key="row.id"
            class="text-sm text-slate-700 dark:text-slate-200 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 py-1 last:border-b-0"
          >
            <span class="truncate">
              {{ row.winner.name || row.winner.facebookId }} · {{ row.sessionName }} · {{ row.productName }}
            </span>
            <span class="ml-2 shrink-0 text-slate-500 dark:text-slate-400">
              {{ row.bidNumber }}
            </span>
          </li>
        </ul>
      </div>
    </div>

    <template #footer>
      <Button
        severity="secondary"
        outlined
        @click="localVisible = false"
      >
        {{ t('bid_list.notify.button.cancel') }}
      </Button>
      <Button
        severity="primary"
        :disabled="!canSendCashout"
        @click="handleSend"
      >
        {{ t('bid_list.notify_cashout.button.send') }}
      </Button>
    </template>
  </Dialog>
</template>
