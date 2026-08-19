<script setup lang="ts">
/**
 * 批次模式列（對齊訂單管理「批次取號模式」樣式）
 * — 左側：模式名稱｜已選 X 筆 · 可選 N 筆（依目前篩選）
 * — 右側：全選可選／下一步（未選取時 disabled）／取消
 */
import { useI18n } from 'vue-i18n';

interface Props {
  title: string;
  selectedCount: number;
  selectableCount: number;
  nextLabel: string;
}

interface Emits {
  (event: 'selectAll'): void;
  (event: 'next'): void;
  (event: 'cancel'): void;
}

defineProps<Props>();
const emit = defineEmits<Emits>();

const { t } = useI18n();
</script>

<template>
  <div class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary-200 dark:border-primary-800 bg-primary-50 dark:bg-primary-900/20 px-4 py-3">
    <div class="flex flex-wrap items-center gap-3 text-sm">
      <span class="font-semibold text-primary-700 dark:text-primary-300">
        {{ title }}
      </span>
      <span class="text-primary-200 dark:text-primary-700">|</span>
      <span class="text-primary-600 dark:text-primary-400">
        {{ t('bid_list.batch_mode.summary', { selected: selectedCount, selectable: selectableCount }) }}
      </span>
    </div>

    <div class="flex items-center gap-2">
      <Button
        type="button"
        size="small"
        severity="secondary"
        outlined
        :label="t('bid_list.batch_mode.button.select_all')"
        @click="emit('selectAll')"
      />
      <Button
        type="button"
        size="small"
        :disabled="selectedCount === 0"
        :label="nextLabel"
        @click="emit('next')"
      />
      <Button
        type="button"
        size="small"
        severity="secondary"
        variant="text"
        :label="t('bid_list.batch_mode.button.cancel')"
        @click="emit('cancel')"
      />
    </div>
  </div>
</template>
