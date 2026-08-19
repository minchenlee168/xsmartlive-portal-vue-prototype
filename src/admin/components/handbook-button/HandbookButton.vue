<script setup lang="ts">
/**
 * 頁面手冊 ? icon 按鈕（共用元件）。
 *
 * 用法：`<HandbookButton section="order_list" />`
 *
 * 點下後呼叫 `window.open('/handbook/{section}', '_blank')` 開新分頁。
 * `section` 為頁面 i18n key prefix，對應 `{section}.design_note.*` 內容。
 */
import { useHandbookWindow } from '@/admin/composables/useHandbookWindow';

defineProps<{
  /** 頁面 i18n key prefix，如 `mall_list`、`order_list` */
  section: string;
}>();

const openHandbook = useHandbookWindow();
</script>

<template>
  <Button
    v-tooltip.top="'頁面手冊（新分頁開啟）'"
    rounded
    text
    severity="secondary"
    size="small"
    aria-label="頁面手冊"
    @click="openHandbook(section)"
  >
    <template #icon>
      <FontAwesomeIcon
        :icon="['far', 'circle-question']"
        class="text-base text-slate-500 dark:text-slate-300"
      />
    </template>
  </Button>
</template>
