<script setup lang="ts">
/**
 * 發票資訊卡：發票狀態可編輯（下拉只開放從目前狀態走得通的值，如已開立只能改已作廢）。
 * 對齊正式專案 OrderInvoiceCard：發票狀態機自成一塊，選取當下即寫回 order（彈窗底部「儲存」照樣捕捉到）。
 */
import { computed, ref } from 'vue'
import { useToast } from 'primevue/usetoast'
import type { InvoiceStatus, OrderRow } from '../orderTypes'
import type { TagSeverity } from '../orderLabels'

const props = defineProps<{
  order: OrderRow
  /** 原始訂單檢視 / 已取消訂單：唯讀，不可編輯、不顯示發票狀態。 */
  readOnly?: boolean
}>()

const toast = useToast()

const INVOICE_STATUS_OPTIONS: Array<{ label: string; value: InvoiceStatus }> = [
  { label: '尚未開立', value: 'not_issued' },
  { label: '已開立', value: 'issued' },
  { label: '不需開立', value: 'not_required' },
  { label: '已作廢', value: 'voided' },
  { label: '開立失敗', value: 'issue_failed' },
  { label: '作廢失敗', value: 'void_failed' },
]
/** mock 沒設 invoiceStatus 時，依 invoiceNumber 推「已開立 / 尚未開立」。 */
const invoiceStatusValue = computed<InvoiceStatus>(() =>
  props.order.invoiceStatus ?? (props.order.invoiceNumber ? 'issued' : 'not_issued'),
)
function invoiceStatusMeta(s: InvoiceStatus): { label: string; severity: TagSeverity } {
  const map: Record<InvoiceStatus, { label: string; severity: TagSeverity }> = {
    not_issued: { label: '尚未開立', severity: 'warn' },
    issued: { label: '已開立', severity: 'success' },
    not_required: { label: '不需開立', severity: 'secondary' },
    voided: { label: '已作廢', severity: 'danger' },
    issue_failed: { label: '開立失敗', severity: 'danger' },
    void_failed: { label: '作廢失敗', severity: 'danger' },
  }
  return map[s]
}
/** 從目前狀態走得通的目標（含自己）；開立後只能作廢、作廢後可重開，其餘依規範。 */
function invoiceReachable(s: InvoiceStatus): InvoiceStatus[] {
  const map: Record<InvoiceStatus, InvoiceStatus[]> = {
    issued: ['issued', 'voided'],
    voided: ['voided', 'issued'],
    not_issued: ['not_issued', 'issued', 'not_required'],
    not_required: ['not_required', 'issued'],
    issue_failed: ['issue_failed', 'issued', 'not_required'],
    void_failed: ['void_failed', 'voided', 'issued'],
  }
  return map[s]
}
const editingInvoice = ref(false)
/** 進入編輯時記下原始狀態：供「(目前)」標記與可切換規則判斷。 */
const invoiceStatusBeforeEdit = ref<InvoiceStatus>('issued')
/** Select 直接綁定 order：選了就即時寫入（彈窗底部「儲存」才寫回列表）。 */
const editInvoiceStatus = computed<InvoiceStatus>({
  get: () => invoiceStatusValue.value,
  set: (v) => {
    props.order.invoiceStatus = v
    // 由尚未開立 → 已開立:補一組 mock 號碼與時間(prototype)
    if (v === 'issued' && !props.order.invoiceNumber) {
      props.order.invoiceNumber = `IV-${props.order.orderNo.replace(/\D/g, '').slice(-8)}`
      props.order.invoiceIssuedAt = props.order.createdAt
    }
  },
})
function startEditInvoice(): void {
  invoiceStatusBeforeEdit.value = invoiceStatusValue.value
  editingInvoice.value = true
}
function invoiceOptionDisabled(opt: { value: InvoiceStatus }): boolean {
  return !invoiceReachable(invoiceStatusBeforeEdit.value).includes(opt.value)
}
/** 下拉中不可選項目的原因說明。 */
function invoiceDisabledReason(v: InvoiceStatus): string {
  switch (v) {
    case 'issue_failed':
    case 'void_failed': return '由系統回報'
    case 'voided': return '要先開立過'
    case 'issued': return '要先開立'
    case 'not_issued': return '不可倒回'
    case 'not_required': return '目前狀態不適用'
    default: return ''
  }
}
function commitInvoice(): void {
  editingInvoice.value = false
  toast.add({ severity: 'success', summary: `訂單 ${props.order.orderNo} 發票狀態已更新為「${invoiceStatusMeta(invoiceStatusValue.value).label}」`, life: 2000 })
}
</script>

<template>
  <div class="rounded-lg border border-[var(--p-content-border-color)] bg-[var(--p-content-background)] p-4 flex flex-col gap-2">
    <!-- 標題 + 編輯鉛筆(編輯入口放標題旁) -->
    <div class="flex items-center gap-2">
      <span class="text-sm font-bold text-[var(--p-text-color)]">發票資訊</span>
      <Button v-if="!readOnly && !editingInvoice" v-tooltip.top="'編輯'" aria-label="編輯發票資訊" icon="pi pi-pencil" severity="secondary" variant="text" size="small" rounded @click="startEditInvoice" />
      <Button v-else-if="editingInvoice" v-tooltip.top="'確認'" aria-label="確認發票資訊" icon="pi pi-check" severity="secondary" variant="text" size="small" rounded @click="commitInvoice" />
    </div>
    <!-- 發票狀態:原始訂單檢視 / 已取消訂單隱藏 -->
    <div v-if="!readOnly" class="flex items-center justify-between text-sm">
      <span class="text-[var(--p-text-muted-color)]">發票狀態</span>
      <Tag v-if="!editingInvoice" :value="invoiceStatusMeta(invoiceStatusValue).label" :severity="invoiceStatusMeta(invoiceStatusValue).severity" />
      <!-- 編輯模式：Select(走不通的值 disabled,標「(目前)」與原因) -->
      <Select
        v-else
        v-model="editInvoiceStatus"
        :options="INVOICE_STATUS_OPTIONS"
        option-label="label"
        option-value="value"
        :option-disabled="invoiceOptionDisabled"
        size="small"
        class="!w-[160px]"
        scroll-height="auto"
        @click.stop
      >
        <template #option="{ option }">
          <span class="inline-flex items-center gap-1">
            <span>{{ option.label }}</span>
            <span v-if="option.value === invoiceStatusBeforeEdit" class="text-xs text-[var(--p-text-muted-color)]">（目前）</span>
            <span v-else-if="invoiceOptionDisabled(option)" class="text-xs text-[var(--p-text-muted-color)]">— {{ invoiceDisabledReason(option.value) }}</span>
          </span>
        </template>
      </Select>
    </div>
    <div class="flex items-center gap-2 text-sm text-[var(--p-text-color)]">
      <i class="pi pi-id-card text-sm text-[var(--p-text-muted-color)]"></i>
      電子發票（會員載具）
    </div>
    <!-- 有發票號碼(已開立 / 已作廢)：顯示號碼 + 開立時間；否則橘字提示 -->
    <div v-if="order.invoiceNumber" class="flex flex-col gap-1 pt-2 border-t border-[var(--p-content-border-color)] text-sm">
      <div class="flex items-center justify-between">
        <span class="text-[var(--p-text-muted-color)]">發票號碼</span>
        <span class="font-medium text-[var(--p-text-color)]">{{ order.invoiceNumber }}</span>
      </div>
      <div class="flex items-center justify-between">
        <span class="text-[var(--p-text-muted-color)]">開立時間</span>
        <span class="text-xs text-[var(--p-text-muted-color)]">{{ order.invoiceIssuedAt }}</span>
      </div>
    </div>
    <!-- 尚未開立提示:原始訂單檢視 / 已取消訂單不顯示 -->
    <div v-else-if="!readOnly" class="pt-2 border-t border-[var(--p-content-border-color)]">
      <span class="inline-flex items-center gap-1 text-xs text-yellow-600 dark:text-yellow-400">
        <i class="pi pi-exclamation-circle text-sm"></i>
        尚未開立
      </span>
    </div>
  </div>
</template>
