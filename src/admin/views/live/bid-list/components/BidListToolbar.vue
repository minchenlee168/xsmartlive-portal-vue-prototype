<script setup lang="ts">
/**
 * 得標清單頁工具列（僅預購顯示模式渲染）
 * — 綠色「預購到貨」icon 按鈕；其餘動作皆已移至頁面標題列
 * — 「+ 新增空白標單」移至頁面標題列「批次作業」旁
 */
import { useI18n } from 'vue-i18n';

export type BidListToolbarAction =
  | 'liveProductSales'
  | 'preorderArrival';

interface Emits {
  (event: 'action', action: BidListToolbarAction): void;
}

const emit = defineEmits<Emits>();

const { t } = useI18n();
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <!-- 預購到貨（success 綠） -->
    <Button
      v-tooltip.top="t('bid_list.button.preorder_arrival')"
      type="button"
      size="small"
      severity="success"
      :aria-label="t('bid_list.button.preorder_arrival')"
      @click="emit('action', 'preorderArrival')"
    >
      <FontAwesomeIcon :icon="['fas', 'truck']" />
    </Button>
  </div>
</template>
