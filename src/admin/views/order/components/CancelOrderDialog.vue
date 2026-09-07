<script setup lang="ts">
import { computed, ref, watch } from 'vue'

/**
 * 取消訂單確認 Dialog。
 *
 * 破壞性操作:取消後訂單標記為「已取消」、停止後續出貨。
 * - 已付款:付款狀態轉「待退款」,需手動辦理退款;處理方式只能「作廢此訂單」(退回重新結帳不適用)。
 * - 未付款:可選退回重新結帳 or 作廢。
 * 需填「取消原因」後才能確認(confirm 按鈕在填原因前 disabled)。
 */
interface Props {
  visible: boolean
  orderNo: string
  amount: number
  /** 是否已收款(已付款) */
  isPaid: boolean
}
const props = defineProps<Props>()
const emit = defineEmits<{
  'update:visible': [v: boolean]
  confirm: [payload: { reason: string; method: 'return' | 'void' }]
}>()

type Method = 'return' | 'void'
const reason = ref<string>('')
const method = ref<Method>('void')

// 每次開啟:清空原因;已付款預設「作廢」(退回重新結帳不適用),未付款預設「退回重新結帳」
watch(() => props.visible, (v) => {
  if (!v) return
  reason.value = ''
  method.value = props.isPaid ? 'void' : 'return'
})

const canConfirm = computed(() => reason.value.trim().length > 0)
function confirm(): void {
  if (!canConfirm.value) return
  emit('confirm', { reason: reason.value.trim(), method: method.value })
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
        <span>取消後此訂單將:</span>
        <span>· 標記為「已取消」,停止後續出貨</span>
        <span v-if="isPaid" class="font-bold text-red-600 dark:text-red-400">· 已收款 NT$ {{ amount.toLocaleString() }},付款狀態將轉為「待退款」,需手動辦理退款</span>
        <span v-else>· 尚未收款,取消後直接結案,無需退款</span>
      </div>

      <!-- 不可復原警示 -->
      <div class="rounded-md border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-3 py-2 flex items-center gap-2 text-xs font-bold text-red-600 dark:text-red-400">
        <i class="pi pi-exclamation-triangle"></i>
        <span>一旦取消將無法復原,請確認後再執行。</span>
      </div>

      <!-- 處理方式 -->
      <div class="flex flex-col gap-2">
        <span class="text-sm font-medium text-[var(--p-text-color)]">處理方式</span>
        <!-- 退回重新結帳:已付款不適用(disabled) -->
        <button
          type="button"
          :disabled="isPaid"
          class="text-left rounded-md border px-3 py-2.5 flex items-start gap-2 transition-colors"
          :class="[
            method === 'return' ? 'border-[var(--p-primary-color)] bg-[var(--p-primary-50)]' : 'border-[var(--p-content-border-color)]',
            isPaid ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer',
          ]"
          @click="!isPaid && (method = 'return')"
        >
          <span
            class="mt-0.5 size-4 shrink-0 rounded-full border-2 flex items-center justify-center"
            :style="{ borderColor: method === 'return' ? 'var(--p-primary-color)' : 'var(--p-content-border-color)' }"
          >
            <span v-if="method === 'return'" class="size-2 rounded-full" style="background: var(--p-primary-color)"></span>
          </span>
          <span class="flex flex-col gap-1">
            <span class="text-sm font-medium text-[var(--p-text-color)]">退回重新結帳</span>
            <span class="text-xs text-[var(--p-text-muted-color)]">
              {{ isPaid
                ? '此訂單已付款,退回購物車後客人需再付一次,不適用。請選擇作廢並辦理退款。'
                : '退回購物車,客人可重新結帳。' }}
            </span>
          </span>
        </button>
        <!-- 作廢此訂單 -->
        <button
          type="button"
          class="text-left rounded-md border px-3 py-2.5 flex items-start gap-2 cursor-pointer transition-colors"
          :class="method === 'void' ? 'border-[var(--p-primary-color)] bg-[var(--p-primary-50)]' : 'border-[var(--p-content-border-color)]'"
          @click="method = 'void'"
        >
          <span
            class="mt-0.5 size-4 shrink-0 rounded-full border-2 flex items-center justify-center"
            :style="{ borderColor: method === 'void' ? 'var(--p-primary-color)' : 'var(--p-content-border-color)' }"
          >
            <span v-if="method === 'void'" class="size-2 rounded-full" style="background: var(--p-primary-color)"></span>
          </span>
          <span class="flex flex-col gap-1">
            <span class="text-sm font-medium text-[var(--p-text-color)]">作廢此訂單</span>
            <span class="text-xs text-[var(--p-text-muted-color)]">訂單與標單一起作廢,商品不退回購物車,客人無法重新結帳。</span>
          </span>
        </button>
      </div>

      <!-- 取消原因(自由輸入) -->
      <div class="flex flex-col gap-2">
        <label class="text-sm font-medium text-[var(--p-text-color)]">
          取消原因 <span class="text-[#DC2626]">*</span>
        </label>
        <Textarea v-model="reason" placeholder="請輸入取消原因" rows="3" class="w-full resize-none" />
      </div>
    </div>

    <template #footer>
      <div class="flex items-center justify-end gap-2 w-full">
        <Button label="返回" severity="secondary" variant="outlined" @click="emit('update:visible', false)" />
        <Button label="確認" severity="danger" :disabled="!canConfirm" @click="confirm" />
      </div>
    </template>
  </Dialog>
</template>
