<script setup lang="ts">
/**
 * 批次作業下拉（頁面標題列右側）
 * — 對齊訂單管理「批次作業」樣式：主色按鈕 + 面板小標「選擇批次動作」+ 縱向清單
 * — 批次更新星等以互動星星呈現（與列內星等同款）；批次棄標為紅字破壞性動作
 */
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import RatingSelector from './RatingSelector.vue';

export type BidListBatchMenuAction =
  | 'batchTransferComplete'
  | 'batchPreorderArrival'
  | 'notifyCashout'
  | 'helperTransferOrder'
  | 'printBid'
  | 'orderModification'
  | 'batchDiscard';

interface Emits {
  (event: 'action', action: BidListBatchMenuAction): void;
  (event: 'ratingUpdate', value: number): void;
}

const emit = defineEmits<Emits>();

const { t } = useI18n();

const popover = ref();
/** 面板內星等目前選值；固定 0（未選），點選後即送出並歸零 */
const ratingValue = ref(0);

function toggle(event: Event) {
  popover.value?.toggle(event);
}

function handleAction(action: BidListBatchMenuAction) {
  popover.value?.hide();
  emit('action', action);
}

function handleRating(value: number) {
  popover.value?.hide();
  ratingValue.value = 0;
  emit('ratingUpdate', value);
}
</script>

<template>
  <Button
    type="button"
    severity="primary"
    aria-haspopup="true"
    @click="toggle"
  >
    <span>{{ t('bid_list.button.batch_menu') }}</span>
    <FontAwesomeIcon
      :icon="['fas', 'chevron-down']"
      class="text-xs"
    />
  </Button>

  <!--
    §6.7 例外：面板內含互動評星 RatingSelector（點 1–5 星直接送出），非單一命令式選單項，
    無法乾淨塞進 <Menu :popup> 的 item 模型，故沿用 Popover。
  -->
  <Popover ref="popover">
    <div class="flex flex-col w-60">
      <div class="px-2 pb-2 text-xs text-surface-500 dark:text-surface-400 border-b border-surface-200 dark:border-surface-700">
        {{ t('bid_list.action.batch_menu_title') }}
      </div>

      <button
        type="button"
        class="mt-1 px-2 py-2 rounded-md text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 text-left"
        @click="handleAction('batchDiscard')"
      >
        {{ t('bid_list.button.batch_discard') }}
      </button>

      <button
        type="button"
        class="px-2 py-2 rounded-md text-sm text-surface-700 dark:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-700 text-left"
        @click="handleAction('batchTransferComplete')"
      >
        {{ t('bid_list.button.batch_transfer_complete') }}
      </button>

      <button
        type="button"
        class="px-2 py-2 rounded-md text-sm text-surface-700 dark:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-700 text-left"
        @click="handleAction('batchPreorderArrival')"
      >
        {{ t('bid_list.button.batch_preorder_arrival') }}
      </button>

      <button
        type="button"
        class="px-2 py-2 rounded-md text-sm text-surface-700 dark:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-700 text-left"
        @click="handleAction('notifyCashout')"
      >
        {{ t('bid_list.button.batch_notify_cashout') }}
      </button>

      <div class="flex items-center justify-between gap-2 px-2 py-2">
        <span class="text-sm text-surface-700 dark:text-surface-200">
          {{ t('bid_list.button.batch_rating') }}
        </span>
        <RatingSelector
          :model-value="ratingValue"
          @update:model-value="handleRating"
        />
      </div>

      <button
        type="button"
        class="px-2 py-2 rounded-md text-sm text-surface-700 dark:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-700 text-left"
        @click="handleAction('helperTransferOrder')"
      >
        {{ t('bid_list.button.helper_transfer_order') }}
      </button>

      <button
        type="button"
        class="px-2 py-2 rounded-md text-sm text-surface-700 dark:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-700 text-left"
        @click="handleAction('printBid')"
      >
        {{ t('bid_list.button.print_bid') }}
      </button>

      <button
        type="button"
        class="px-2 py-2 rounded-md text-sm text-surface-700 dark:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-700 text-left"
        @click="handleAction('orderModification')"
      >
        {{ t('bid_list.button.batch_order_modification') }}
      </button>
    </div>
  </Popover>
</template>
