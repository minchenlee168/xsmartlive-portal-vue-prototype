<script setup lang="ts">
import { ref, computed } from 'vue'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'

/**
 * 手動開立發票頁。
 *
 * 兩張 Card：
 * 1. 開立發票：稅別 / 品名 / 數量 / 金額 / 賣方統編 / 備註 / 發票種類 → 開立按鈕
 * 2. 已手動開立紀錄：歷史查詢 + 檔案上傳 + 批次列印 + DataTable
 */

const toast = useToast()
const confirm = useConfirm()

// ─── Card 1: 開立發票 表單 state ─────────────────
type TaxType = 'taxable' | 'tax_free'
const form = ref<{
  taxType: TaxType
  name: string
  qty: number
  amount: number
  sellerTaxId: string
  note: string
  invoiceType: 'paper' | 'electronic'
}>({
  taxType: 'taxable',
  name: '',
  qty: 1,
  amount: 0,
  sellerTaxId: '12345678',
  note: '',
  invoiceType: 'paper',
})

const sellerOptions = [
  { label: '12345678：直播管家股份有限公司', value: '12345678' },
]
const invoiceTypeOptions = [
  { label: '紙本發票',     value: 'paper' },
  { label: '電子發票',     value: 'electronic' },
]

const canIssue = computed(() => form.value.name.trim().length > 0 && form.value.qty > 0 && form.value.amount > 0)

/** 產生訂單編號 MANUAL-YYYYMMDDNNNN */
function generateOrderNo(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const n = String(records.value.length + 1).padStart(4, '0')
  return `MANUAL-${y}${m}${day}${n}`
}
/** 產生發票號碼（跟其他 Dialog 一致的 AB12345678 格式） */
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

function onIssue(): void {
  if (!canIssue.value) return
  const rec: ManualInvoiceRow = {
    id: String(Date.now()),
    createdAt: nowFormatted(),
    orderNo: generateOrderNo(),
    qty: form.value.qty,
    taxType: form.value.taxType,
    amount: form.value.amount,
    note: form.value.note,
    invoiceNumber: generateInvoiceNumber(),
    invoiceType: form.value.invoiceType,
    status: 'issued',
  }
  records.value.unshift(rec)
  toast.add({ severity: 'success', summary: `已開立發票 ${rec.invoiceNumber}`, life: 2000 })
  // Reset name + amount，保留 taxType / sellerTaxId / invoiceType 方便連續開立
  form.value.name = ''
  form.value.qty = 1
  form.value.amount = 0
  form.value.note = ''
}

// ─── Card 2: 已手動開立紀錄 ─────────────────
type InvoiceStatus = 'issued' | 'voided' | 'allowance'
interface ManualInvoiceRow {
  id: string
  createdAt: string
  orderNo: string
  qty: number
  taxType: TaxType
  amount: number
  note: string
  invoiceNumber: string
  invoiceType: 'paper' | 'electronic'
  status: InvoiceStatus
}

const records = ref<ManualInvoiceRow[]>([
  { id: '1', createdAt: '2026-05-10 09:15', orderNo: 'MANUAL-202605100001', qty: 1, taxType: 'taxable',  amount: 1500, note: '客戶補開',   invoiceNumber: 'AB12345600', invoiceType: 'paper',      status: 'issued' },
  { id: '2', createdAt: '2026-05-11 14:42', orderNo: 'MANUAL-202605110001', qty: 3, taxType: 'taxable',  amount: 4200, note: '',           invoiceNumber: 'AB12345601', invoiceType: 'electronic', status: 'issued' },
  { id: '3', createdAt: '2026-05-12 11:08', orderNo: 'MANUAL-202605120001', qty: 1, taxType: 'tax_free', amount:  980, note: '免稅商品',   invoiceNumber: 'AB12345602', invoiceType: 'paper',      status: 'issued' },
  { id: '4', createdAt: '2026-05-13 16:30', orderNo: 'MANUAL-202605130001', qty: 2, taxType: 'taxable',  amount: 3300, note: '加開',       invoiceNumber: 'AB12345603', invoiceType: 'paper',      status: 'issued' },
])

// ── 歷史紀錄查詢 ──
const queryStart = ref<Date | null>(null)
const queryEnd = ref<Date | null>(null)
const queryInvoiceType = ref<string>('all')
const queryInvoiceTypeOptions = [
  { label: '全部', value: 'all' },
  { label: '紙本發票',     value: 'paper' },
  { label: '電子發票',     value: 'electronic' },
]
const appliedQuery = ref<{ start: Date | null; end: Date | null; invoiceType: string }>({
  start: null, end: null, invoiceType: 'all',
})
function onQuery(): void {
  appliedQuery.value = { start: queryStart.value, end: queryEnd.value, invoiceType: queryInvoiceType.value }
}
function onClearQuery(): void {
  queryStart.value = null
  queryEnd.value = null
  queryInvoiceType.value = 'all'
  appliedQuery.value = { start: null, end: null, invoiceType: 'all' }
}
const filteredRecords = computed<ManualInvoiceRow[]>(() => {
  const q = appliedQuery.value
  let list = records.value
  if (q.invoiceType !== 'all') list = list.filter(r => r.invoiceType === q.invoiceType)
  if (q.start) list = list.filter(r => new Date(r.createdAt.replace(/\//g, '-')) >= q.start!)
  if (q.end) list = list.filter(r => new Date(r.createdAt.replace(/\//g, '-')) <= q.end!)
  return list
})

// ── 檔案上傳：用 PrimeVue Button 觸發隱藏 input，維持 Design.md 7.0 元件優先原則 ──
const uploadedFileName = ref<string>('')
const fileInputRef = ref<HTMLInputElement | null>(null)
function triggerFilePick(): void {
  fileInputRef.value?.click()
}
function onFileChange(event: Event): void {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  uploadedFileName.value = file.name
  toast.add({ severity: 'info', summary: `已選擇：${file.name}`, life: 2000 })
}

// ── 選取 + 批次列印 ──
const selectedRows = ref<ManualInvoiceRow[]>([])
function onBatchPrint(): void {
  if (selectedRows.value.length === 0) {
    toast.add({ severity: 'warn', summary: '請先勾選要列印的發票', life: 2000 })
    return
  }
  toast.add({ severity: 'success', summary: `批次列印 ${selectedRows.value.length} 張發票`, life: 2000 })
}

// ── 單筆操作：列印 / 作廢 / 折讓 / 寄送 Email ──
function onPrint(row: ManualInvoiceRow): void {
  toast.add({ severity: 'info', summary: `列印發票 ${row.invoiceNumber}`, life: 2000 })
}
function onVoid(row: ManualInvoiceRow): void {
  confirm.require({
    header: '作廢發票',
    message: `確定要作廢發票 ${row.invoiceNumber} 嗎？此動作無法復原。`,
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: '作廢',
    rejectLabel: '取消',
    acceptClass: 'p-button-danger',
    accept: () => {
      row.status = 'voided'
      toast.add({ severity: 'success', summary: `發票 ${row.invoiceNumber} 已作廢`, life: 2000 })
    },
  })
}
function onAllowance(row: ManualInvoiceRow): void {
  // Design.md 十：破壞性動作經二次確認（折讓會改動原發票金額）
  confirm.require({
    header: '開立折讓',
    message: `確定要對發票 ${row.invoiceNumber} 開立折讓嗎？此動作會影響發票金額。`,
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: '確認',
    rejectLabel: '取消',
    acceptClass: 'p-button-danger',
    accept: () => {
      row.status = 'allowance'
      toast.add({ severity: 'success', summary: `發票 ${row.invoiceNumber} 已開立折讓`, life: 2000 })
    },
  })
}
function onSendEmail(row: ManualInvoiceRow): void {
  toast.add({ severity: 'info', summary: `寄送 Email：${row.invoiceNumber}`, life: 2000 })
}
</script>

<template>
  <div class="flex flex-col gap-4 flex-1 min-h-0">
    <!-- 頁首：標題 + 說明 icon -->
    <div class="flex items-center gap-2">
      <h1 class="text-xl font-medium text-[var(--p-text-color)]">手動開立發票</h1>
      <i v-tooltip.right="'非訂單來源的發票可在此手動開立，並保留完整紀錄'" class="pi pi-question-circle text-[var(--p-text-muted-color)] cursor-help"></i>
    </div>

    <!-- ── Card 1: 開立發票 ── -->
    <Card :pt="{ root: { class: 'shrink-0' }, body: { class: 'p-0' }, content: { class: 'p-0' } }">
      <template #content>
        <div class="p-4 flex flex-col gap-4">
          <h2 class="text-base font-bold text-[var(--p-text-color)]">開立發票</h2>

          <!-- 稅別 -->
          <div class="flex flex-col gap-2">
            <label class="text-sm font-medium text-[var(--p-text-color)]">稅別</label>
            <div class="flex items-center gap-6">
              <label class="flex items-center gap-2 cursor-pointer">
                <RadioButton v-model="form.taxType" value="taxable" input-id="tax-taxable" />
                <span class="text-sm">應稅</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer">
                <RadioButton v-model="form.taxType" value="tax_free" input-id="tax-free" />
                <span class="text-sm">免稅</span>
              </label>
            </div>
          </div>

          <!-- 依 Figma 設計 3 欄 grid，Row 2 備註跨 2 欄；Row 3 發票種類自己 1 欄
               Design.md 7.8：所有列共用 grid + 上下欄寬對齊；stacked stepper 需 ≥ 200px 欄寬 -->
          <div class="grid grid-cols-1 md:[grid-template-columns:1fr_200px_200px] gap-6">
            <!-- Row 1: 品名 / 數量 / 金額 -->
            <div class="flex flex-col gap-2">
              <label class="text-sm font-medium text-[var(--p-text-color)]">品名 <span class="text-[#DC2626]">*</span></label>
              <InputText v-model="form.name" placeholder="請輸入品名" class="w-full" />
            </div>
            <div class="flex flex-col gap-2">
              <label class="text-sm font-medium text-[var(--p-text-color)]">數量 <span class="text-[#DC2626]">*</span></label>
              <!-- fluid：讓內部 input 撐滿 container 寬度 -->
              <InputNumber v-model="form.qty" :min="1" show-buttons button-layout="stacked" fluid />
            </div>
            <div class="flex flex-col gap-2">
              <label class="text-sm font-medium text-[var(--p-text-color)]">金額 <span class="text-[#DC2626]">*</span></label>
              <!-- 金額用一般 InputNumber（無 stepper），只保留 currency 格式 -->
              <InputNumber v-model="form.amount" mode="currency" currency="TWD" locale="zh-TW" :min="0" fluid />
            </div>

            <!-- Row 2: 賣方統編（col 1 = 品名寬）/ 備註（跨 col 2+3 = 數量+金額寬） -->
            <div class="flex flex-col gap-2">
              <label class="text-sm font-medium text-[var(--p-text-color)]">賣方統編</label>
              <Select v-model="form.sellerTaxId" :options="sellerOptions" option-label="label" option-value="value" class="w-full" />
            </div>
            <div class="flex flex-col gap-2 md:col-span-2">
              <label class="text-sm font-medium text-[var(--p-text-color)]">
                備註 <span class="text-xs text-[var(--p-text-muted-color)]">（選填）</span>
              </label>
              <InputText v-model="form.note" placeholder="請輸入備註" class="w-full" />
            </div>

            <!-- Row 3: 發票種類（col 1 = 品名寬） -->
            <div class="flex flex-col gap-2">
              <label class="text-sm font-medium text-[var(--p-text-color)]">發票種類</label>
              <Select v-model="form.invoiceType" :options="invoiceTypeOptions" option-label="label" option-value="value" class="w-full" />
            </div>
          </div>

          <!-- 開立按鈕 -->
          <div class="flex justify-end pt-2">
            <Button label="開立" icon="pi pi-plus" :disabled="!canIssue" @click="onIssue" />
          </div>
        </div>
      </template>
    </Card>

    <!-- ── Card 2: 已手動開立紀錄 ── -->
    <Card :pt="{ body: { class: 'p-0' }, content: { class: 'p-0' } }">
      <template #content>
        <div class="p-4 flex flex-col gap-4">
          <h2 class="text-base font-bold text-[var(--p-text-color)]">已手動開立紀錄</h2>

          <!-- 歷史紀錄查詢子卡 -->
          <div class="rounded-md border border-[var(--p-content-border-color)] bg-[var(--p-content-hover-background)] p-4 flex flex-col gap-3">
            <span class="text-sm font-medium text-[var(--p-text-color)]">歷史紀錄查詢</span>
            <!-- Design.md 7.8：相鄰 form 元件 gap ≥ 8px，DatePicker + Select 用 gap-4 (16px) 更安全 -->
            <div class="flex items-end gap-4 flex-wrap">
              <div class="flex flex-col gap-2">
                <label class="text-sm font-medium text-[var(--p-text-color)]">開始日期</label>
                <DatePicker v-model="queryStart" show-icon date-format="yy-mm-dd" class="w-[180px]" />
              </div>
              <div class="flex flex-col gap-2">
                <label class="text-sm font-medium text-[var(--p-text-color)]">結束日期</label>
                <DatePicker v-model="queryEnd" show-icon date-format="yy-mm-dd" class="w-[180px]" />
              </div>
              <div class="flex flex-col gap-2">
                <label class="text-sm font-medium text-[var(--p-text-color)]">發票種類</label>
                <Select v-model="queryInvoiceType" :options="queryInvoiceTypeOptions" option-label="label" option-value="value" class="w-[160px]" />
              </div>
              <Button label="搜尋" @click="onQuery" />
            </div>
          </div>

          <!-- 上傳檔案 + 批次列印（都用主色 filled；批次列印需勾選才能按） -->
          <div class="flex flex-col gap-3">
            <span class="text-sm font-medium text-[var(--p-text-color)]">上傳檔案</span>
            <div class="flex items-center gap-3 flex-wrap">
              <Button label="點擊或拖曳檔案至此處上傳" icon="pi pi-plus" @click="triggerFilePick" />
              <input ref="fileInputRef" type="file" class="hidden" @change="onFileChange" />
              <span class="text-sm text-[var(--p-text-muted-color)]">{{ uploadedFileName || '未選擇檔案' }}</span>
            </div>
            <div>
              <Button
                label="批次列印發票"
                icon="pi pi-print"
                :disabled="selectedRows.length === 0"
                v-tooltip.top="selectedRows.length === 0 ? '請先勾選要列印的發票' : ''"
                @click="onBatchPrint"
              />
            </div>
          </div>

          <!-- DataTable：手動開立發票紀錄 -->
          <DataTable
            v-model:selection="selectedRows"
            :value="filteredRecords"
            data-key="id"
            striped-rows
            paginator
            :rows="10"
            :rows-per-page-options="[10, 20, 50]"
            paginator-template="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown"
            class="w-full"
          >
            <Column selection-mode="multiple" header-style="width: 3rem" />
            <Column field="createdAt" header="建檔時間" />
            <Column field="orderNo" header="訂單編號" />
            <Column field="qty" header="數量" body-class="text-right" header-class="text-right" />
            <Column header="應稅 / 免稅">
              <template #body="{ data }">
                <Tag :value="data.taxType === 'taxable' ? '應稅' : '免稅'" :severity="data.taxType === 'taxable' ? 'info' : 'secondary'" />
              </template>
            </Column>
            <Column header="金額" body-class="text-right" header-class="text-right">
              <template #body="{ data }">NT$ {{ data.amount.toLocaleString() }}</template>
            </Column>
            <Column field="note" header="備註" />
            <Column field="invoiceNumber" header="發票號碼">
              <template #body="{ data }">
                <span :class="data.status === 'voided' ? 'line-through text-[var(--p-text-muted-color)]' : 'text-[var(--p-text-color)]'">
                  {{ data.invoiceNumber }}
                </span>
              </template>
            </Column>
            <Column header="操作">
              <!-- Design.md 7.5：Table 操作欄只放 icon + tooltip；每個功能用不同 icon 避免混淆
                   Design.md 四：按鈕群組間距用 gap-2（8px），避免 gap-1 過窄 -->
              <template #body="{ data }">
                <div class="flex items-center gap-2">
                  <Button
                    v-tooltip.top="'列印'"
                    icon="pi pi-print"
                    severity="secondary"
                    variant="text"
                    size="small"
                    rounded
                    @click="onPrint(data)"
                  />
                  <Button
                    v-tooltip.top="'作廢'"
                    icon="pi pi-ban"
                    severity="danger"
                    variant="text"
                    size="small"
                    rounded
                    :disabled="data.status === 'voided'"
                    @click="onVoid(data)"
                  />
                  <Button
                    v-tooltip.top="'折讓'"
                    icon="pi pi-file-edit"
                    severity="danger"
                    variant="text"
                    size="small"
                    rounded
                    :disabled="data.status === 'voided'"
                    @click="onAllowance(data)"
                  />
                  <Button
                    v-tooltip.top="'寄送 Email'"
                    icon="pi pi-envelope"
                    severity="secondary"
                    variant="text"
                    size="small"
                    rounded
                    @click="onSendEmail(data)"
                  />
                </div>
              </template>
            </Column>
            <template #empty>
              <div class="py-12 text-center text-sm text-[var(--p-text-muted-color)]">目前沒有符合條件的紀錄</div>
            </template>
          </DataTable>
        </div>
      </template>
    </Card>
  </div>
</template>
