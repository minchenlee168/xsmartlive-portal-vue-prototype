<script setup lang="ts">
import { ref, watch } from 'vue'

/**
 * 取消訂單確認 Dialog。
 *
 * 破壞性操作：取消後訂單標記為「已取消」、停止後續出貨，金流/發票需人工善後。
 * 需選填「取消原因」後才能確認（confirm 按鈕在選原因前 disabled）。
 */
interface Props {
  visible: boolean
  orderNo: string
  amount: number
}
const props = defineProps<Props>()
const emit = defineEmits<{
  'update:visible': [v: boolean]
  confirm: [reason: string]
}>()

const reasonOptions = [
  { label: '買家取消下單',     value: '買家取消下單' },
  { label: '商品缺貨',         value: '商品缺貨' },
  { label: '地址錯誤無法寄送', value: '地址錯誤無法寄送' },
  { label: '付款逾期',         value: '付款逾期' },
  { label: '其他',             value: '其他' },
]
const reason = ref<string>('')

// 每次開啟時清空原因
watch(() => props.visible, (v) => { if (v) reason.value = '' })

function confirm(): void {
  if (!reason.value) return
  emit('confirm', reason.value)
  emit('update:visible', false)
}
</script>

<template>
  <Dialog
    :visible="visible"
    modal
    :draggable="false"
    :style="{ width: 'min(440px, calc(100vw - 32px))' }"
    @update:visible="(v) => emit('update:visible', v)"
  >
    <template #header>
      <div class="flex items-center gap-3">
        <div class="size-10 shrink-0 rounded-full bg-red-100 dark:bg-red-950/50 flex items-center justify-center">
          <i class="pi pi-ban text-red-600 dark:text-red-400 text-lg"></i>
        </div>
        <div class="flex flex-col gap-1">
          <span class="text-base font-bold text-[var(--p-text-color)]">取消訂單</span>
          <span class="text-xs text-[var(--p-text-muted-color)]">
            訂單 {{ orderNo }} · NT$ {{ amount.toLocaleString() }}
          </span>
        </div>
      </div>
    </template>

    <div class="flex flex-col gap-4">
      <!-- 取消後果說明 -->
      <div class="rounded-md bg-[var(--p-content-hover-background)] px-3 py-2.5 text-xs text-[var(--p-text-muted-color)] flex flex-col gap-1">
        <span>取消後此訂單將：</span>
        <span>· 標記為「已取消」，停止後續出貨</span>
        <span>· 金流如已付款，需手動處理退款</span>
        <span>· 發票如已開立，需手動作廢</span>
      </div>

      <!-- 不可復原警示 -->
      <div class="rounded-md border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-3 py-2 flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
        <i class="pi pi-exclamation-triangle"></i>
        <span>一旦取消將無法復原，請確認後再執行。</span>
      </div>

      <!-- 取消原因 -->
      <div class="flex flex-col gap-2">
        <label class="text-sm font-medium text-[var(--p-text-color)]">
          取消原因 <span class="text-[#DC2626]">*</span>
        </label>
        <Select
          v-model="reason"
          :options="reasonOptions"
          option-label="label"
          option-value="value"
          placeholder="請選擇..."
          class="w-full"
        />
      </div>
    </div>

    <template #footer>
      <div class="flex items-center justify-end gap-2 w-full">
        <Button label="取消" severity="secondary" variant="outlined" @click="emit('update:visible', false)" />
        <Button label="確認取消訂單" severity="danger" :disabled="!reason" @click="confirm" />
      </div>
    </template>
  </Dialog>
</template>
