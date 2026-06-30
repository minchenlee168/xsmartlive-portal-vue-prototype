<script setup lang="ts">
import { ref, watch } from 'vue'

/**
 * 庫存數量問題提示彈窗：
 * 當商品本身或任一規格的 stock = 0 時，使用者按下「開始收單」前跳此彈窗，
 * 讓使用者選擇：啟用超賣 / 不賣 stock=0 規格 / 改去編輯商品。
 */

export type StockIssueChoice = 'oversell' | 'skip-zero'

interface Props {
  visible?: boolean
}
const props = withDefaults(defineProps<Props>(), { visible: false })

const emit = defineEmits<{
  'update:visible': [value: boolean]
  confirm: [choice: StockIssueChoice]
}>()

const choice = ref<StockIssueChoice>('oversell')

watch(() => props.visible, (v) => {
  if (v) choice.value = 'oversell'
})

function onCancel(): void {
  emit('update:visible', false)
}
function onConfirm(): void {
  emit('confirm', choice.value)
  emit('update:visible', false)
}
</script>

<template>
  <Dialog
    :visible="props.visible"
    modal
    :draggable="false"
    :closable="false"
    :style="{ width: 'min(480px, calc(100vw - 32px))' }"
    :pt="{
      header:  { style: 'padding: 17.5px' },
      content: { style: 'padding: 0 17.5px 17.5px' },
      footer:  { style: 'padding: 12px 17.5px' },
    }"
    @update:visible="(v) => emit('update:visible', v)"
  >
    <template #header>
      <span class="font-semibold text-[var(--p-text-color)]" style="font-size: 17.5px">
        發現庫存數量問題
      </span>
    </template>

    <div class="flex flex-col gap-4 pt-1">
      <p class="text-[14px] text-[var(--p-text-color)]">
        商品或一部分規格的庫存數量不足，請選擇處理方式。
      </p>
      <div class="flex flex-col gap-3">
        <label class="flex items-center gap-2 cursor-pointer text-[14px] text-[var(--p-text-color)]">
          <RadioButton v-model="choice" input-id="stock-oversell" value="oversell" />
          <span>啟用超賣選項進行銷售</span>
        </label>
        <label class="flex items-center gap-2 cursor-pointer text-[14px] text-[var(--p-text-color)]">
          <RadioButton v-model="choice" input-id="stock-skip-zero" value="skip-zero" />
          <span>庫存數量為 0 的規格不進行銷售</span>
        </label>
      </div>
    </div>

    <template #footer>
      <div class="flex justify-end gap-2 w-full">
        <Button label="取消" severity="secondary" variant="outlined" @click="onCancel" />
        <Button label="確定" @click="onConfirm" />
      </div>
    </template>
  </Dialog>
</template>
