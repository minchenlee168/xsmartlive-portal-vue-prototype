<script setup lang="ts">
import { computed } from 'vue'
import { useToast } from 'primevue/usetoast'

/**
 * 開立發票確認 Dialog：跳出前先讓使用者確認訂單資訊 + 發票類型，confirm 後產生發票號碼與開立時間。
 * 訂單列表表格「開立發票」與 OrderRowDetail 的「開立發票」按鈕共用。
 */

interface OrderLite {
  orderNo: string
  buyerName: string
  amount: number
  invoiceNumber?: string
  invoiceIssuedAt?: string
}
interface Props {
  visible: boolean
  order: OrderLite | null
  /** 發票類型顯示文字，例：「電子發票（會員載具）」 */
  invoiceType?: string
}
const props = withDefaults(defineProps<Props>(), { invoiceType: '電子發票（會員載具）' })
const emit = defineEmits<{
  'update:visible': [v: boolean]
  /** confirm 帶出「發票號碼 + 開立時間」，讓外層寫回訂單 */
  confirm: [payload: { number: string; time: string }]
}>()

const toast = useToast()

const alreadyIssued = computed(() => !!props.order?.invoiceNumber)

/** 發票號碼：2 碼英文 + 8 碼數字（比照 mock 格式 AB12345678） */
function generateInvoiceNumber(): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const l1 = letters.charAt(Math.floor(Math.random() * letters.length))
  const l2 = letters.charAt(Math.floor(Math.random() * letters.length))
  const digits = String(Math.floor(Math.random() * 1e8)).padStart(8, '0')
  return `${l1}${l2}${digits}`
}
function nowFormatted(): string {
  const d = new Date()
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
function confirm(): void {
  const number = generateInvoiceNumber()
  const time = nowFormatted()
  emit('confirm', { number, time })
  toast.add({ severity: 'success', summary: `發票已開立：${number}`, life: 2000, closable: true })
  emit('update:visible', false)
}
</script>

<template>
  <Dialog
    :visible="visible"
    modal
    :draggable="false"
    :style="{ width: 'min(420px, calc(100vw - 32px))' }"
    @update:visible="(v) => emit('update:visible', v)"
  >
    <template #header>
      <div class="flex items-center gap-3">
        <div class="size-10 shrink-0 rounded-full bg-[var(--p-primary-50)] flex items-center justify-center">
          <i class="pi pi-file text-[var(--p-primary-color)] text-lg"></i>
        </div>
        <div class="flex flex-col gap-1">
          <span class="text-base font-bold text-[var(--p-text-color)]">開立發票</span>
          <span v-if="order" class="text-xs text-[var(--p-text-muted-color)]">訂單 {{ order.orderNo }} · {{ order.buyerName }}</span>
        </div>
      </div>
    </template>

    <div class="flex flex-col gap-3">
      <!-- 已開立提示 -->
      <div
        v-if="alreadyIssued"
        class="rounded-md border border-yellow-400 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-950/40 px-3 py-2 flex items-start gap-2 text-sm text-[var(--p-text-color)]"
      >
        <i class="pi pi-info-circle text-yellow-600 dark:text-yellow-400 mt-1 text-sm"></i>
        <div class="flex flex-col gap-1">
          <span>此訂單已開立發票：<span class="font-bold">{{ order?.invoiceNumber }}</span></span>
          <span class="text-xs text-[var(--p-text-muted-color)]">開立時間：{{ order?.invoiceIssuedAt }}</span>
        </div>
      </div>

      <!-- 發票類型（唯讀，依欄位字典 order.invoice） -->
      <div class="flex flex-col gap-2">
        <label class="text-sm font-medium text-[var(--p-text-color)]">發票類型</label>
        <div class="rounded-md border border-[var(--p-content-border-color)] px-3 py-2 flex items-center gap-2 text-sm text-[var(--p-text-color)]">
          <i class="pi pi-id-card text-sm text-[var(--p-text-muted-color)]"></i>
          {{ invoiceType }}
        </div>
      </div>

      <!-- 金額（唯讀） -->
      <div class="flex items-center justify-between text-sm">
        <span class="text-[var(--p-text-muted-color)]">開立金額</span>
        <span class="font-bold text-[var(--p-primary-color)]">${{ order?.amount.toLocaleString() ?? 0 }}</span>
      </div>

      <p v-if="!alreadyIssued" class="text-sm text-[var(--p-text-color)] leading-snug">
        確定要為此訂單開立電子發票嗎？系統將產生發票號碼並紀錄開立時間。
      </p>
    </div>

    <template #footer>
      <Button label="取消" severity="secondary" variant="outlined" @click="emit('update:visible', false)" />
      <Button label="確定開立" :disabled="alreadyIssued" @click="confirm" />
    </template>
  </Dialog>
</template>
