<script setup lang="ts">
import { computed, ref } from 'vue'

/**
 * 電子發票 → 發票作業頁。
 *
 * 區塊：
 * - 頁首 Card：標題（含說明 (?) icon）+ 系統操作說明連結 + 兩個 toggle（發票明細 / 前台發票顯示）
 *   + 最近三個月發票總額統計表（每家公司一列、3 個月份欄、當期剩餘總數）
 * - 訂單類型分頁（一般訂單 / 儲值回饋禮）：用紫色 SelectButton 樣式區隔
 * - 搜尋 Card：發票查詢，7 個篩選欄位 → 含「清空」按鈕（依 Design.md 7.6 條件 > 4 個）
 * - 結果 Card：
 *   - 狀態頁籤（未分類 / 開立發票 / 已開發票 / 作廢/折讓 / 不開發票 / 全部發票）
 *   - 右上批次動作：3 種「變更為」的 radio + 變更狀態 / 一鍵分類至開立發票 按鈕
 *   - DataTable：建檔時間 / 多購物車 / 訂單編號 / 訂購人 / 金額 / 支付方式、物流方式 /
 *     商品數量 / 每列的發票類別 + 狀態 radio
 *
 * 本頁走 mock，所有篩選、按鈕動作只 toast 或在 client 端 reactive 切換。
 */

// ── 頁首區：toggle ───────────────────────────────────
const printInvoiceDetail = ref(true)
const showFrontInvoice = ref(false)

// ── 統計表 mock ──────────────────────────────────────
interface MonthlyRow {
  taxId: string
  companyName: string
  m1: number
  m2: number
  m3: number
  remaining: number
}
const monthlyHeaders = ['2026/03', '2026/04', '2026/05']
const monthlyRows: MonthlyRow[] = [
  { taxId: '12345678', companyName: '直播管家股份有限公司', m1: 256_800, m2: 312_450, m3: 188_900, remaining: 1_245 },
  { taxId: '87654321', companyName: '示範分公司',           m1:  98_500, m2: 110_200, m3:  74_300, remaining: 35 },
]

// ── 訂單類型分頁（一般訂單 / 儲值回饋禮） ──────────────
type OrderKind = 'normal' | 'reward'
const orderKind = ref<OrderKind>('normal')
const orderKindOptions: Array<{ label: string; value: OrderKind }> = [
  { label: '一般訂單',   value: 'normal' },
  { label: '儲值回饋禮', value: 'reward' },
]

// ── 篩選欄位（草稿值 → 按搜尋才會 commit） ─────────────
interface Option { label: string; value: string }
const orderNoTypeOptions: Option[] = [
  { label: '訂單編號', value: 'orderNo' },
  { label: '發票號碼', value: 'invoiceNo' },
  { label: '訂購人',   value: 'buyer' },
]
const orderDateTypeOptions: Option[] = [
  { label: '訂單日期', value: 'orderDate' },
  { label: '建檔時間', value: 'createdAt' },
  { label: '出貨時間', value: 'shippedAt' },
]
const carrierOptions: Option[] = [
  { label: '所有載具類型',   value: '' },
  { label: '手機條碼',       value: 'mobile' },
  { label: '自然人憑證',     value: 'citizen' },
  { label: '會員載具',       value: 'member' },
  { label: '紙本發票',       value: 'paper' },
  { label: '統一編號（公司）', value: 'corp' },
  { label: '捐贈',           value: 'donation' },
]
const paymentLogisticOptions: Option[] = [
  { label: '不篩選金物流狀態', value: '' },
  { label: '已付款 + 已出貨',   value: 'paid_shipped' },
  { label: '已付款 + 未出貨',   value: 'paid_unship' },
  { label: '未付款',           value: 'unpaid' },
]
const sellerOptions: Option[] = [
  { label: '12345678：直播管家股份有限公司', value: '12345678' },
  { label: '87654321：示範分公司',           value: '87654321' },
]
const multiCartOptions: Option[] = [
  { label: '全部',     value: '' },
  { label: '主購物車', value: 'main' },
  { label: '副購物車', value: 'sub' },
]

const filterOrderField = ref<string>('orderNo')
const filterKeyword    = ref<string>('')
const filterDateField  = ref<string>('orderDate')
const filterDateRange  = ref<Date[] | null>(null)
const filterCarrier    = ref<string>('')
const filterPaymentLogistic = ref<string>('')
const filterSeller     = ref<string>('12345678')
const filterMultiCart  = ref<string>('')

function onSearch(): void {
  /* eslint-disable no-console */
  console.info('[invoice] search', {
    orderField: filterOrderField.value,
    keyword:    filterKeyword.value,
    dateField:  filterDateField.value,
    dateRange:  filterDateRange.value,
    carrier:    filterCarrier.value,
    payLog:     filterPaymentLogistic.value,
    seller:     filterSeller.value,
    multiCart:  filterMultiCart.value,
  })
}
function onClear(): void {
  filterOrderField.value = 'orderNo'
  filterKeyword.value    = ''
  filterDateField.value  = 'orderDate'
  filterDateRange.value  = null
  filterCarrier.value    = ''
  filterPaymentLogistic.value = ''
  filterSeller.value     = '12345678'
  filterMultiCart.value  = ''
}

// ── 狀態頁籤 ──────────────────────────────────────
type StatusTab = 'unsorted' | 'to_issue' | 'issued' | 'voided' | 'no_issue' | 'all'
const statusTab = ref<StatusTab>('unsorted')
const statusTabs: Array<{ key: StatusTab; label: string }> = [
  { key: 'unsorted', label: '未分類' },
  { key: 'to_issue', label: '開立發票' },
  { key: 'issued',   label: '已開發票' },
  { key: 'voided',   label: '作廢 / 折讓' },
  { key: 'no_issue', label: '不開發票' },
  { key: 'all',      label: '全部發票' },
]

// ── 批次動作 ──────────────────────────────────────
type RowStatus = 'unsorted' | 'to_issue' | 'no_issue'
const bulkTargetStatus = ref<RowStatus>('unsorted')
const bulkTargetOptions: Array<{ label: string; value: RowStatus }> = [
  { label: '未分類',   value: 'unsorted' },
  { label: '開立發票', value: 'to_issue' },
  { label: '不開發票', value: 'no_issue' },
]

// ── Table mock ───────────────────────────────────
interface InvoiceRow {
  id: string
  createdAt: string
  cart: string
  orderNo: string
  buyerName: string
  amount: number
  paymentMethod: string
  shippingMethod: string
  itemCount: number
  invoiceKind: string       // 紙本發票 / 電子發票 / 統一編號
  rowStatus: RowStatus
}
const rows = ref<InvoiceRow[]>([
  { id: '1', createdAt: '2026/05/12 09:21', cart: '主購物車', orderNo: 'LV202605120001', buyerName: '王小明',  amount: 1280, paymentMethod: '轉帳匯款',   shippingMethod: '宅配',     itemCount: 3, invoiceKind: '紙本發票',         rowStatus: 'unsorted' },
  { id: '2', createdAt: '2026/05/12 11:08', cart: '主購物車', orderNo: 'LV202605120002', buyerName: '陳怡君',  amount: 2480, paymentMethod: '信用卡一次',  shippingMethod: '7-11 取貨', itemCount: 5, invoiceKind: '會員載具',         rowStatus: 'unsorted' },
  { id: '3', createdAt: '2026/05/12 14:32', cart: '副購物車', orderNo: 'LV202605120003', buyerName: '林志豪',  amount:  890, paymentMethod: 'LINE Pay',    shippingMethod: '全家取貨', itemCount: 1, invoiceKind: '手機條碼',         rowStatus: 'unsorted' },
  { id: '4', createdAt: '2026/05/13 09:55', cart: '主購物車', orderNo: 'LV202605130001', buyerName: '黃曉萱',  amount: 3650, paymentMethod: 'Apple Pay',   shippingMethod: '宅配',     itemCount: 4, invoiceKind: '統一編號（公司）', rowStatus: 'unsorted' },
  { id: '5', createdAt: '2026/05/13 16:40', cart: '主購物車', orderNo: 'LV202605130002', buyerName: '張庭瑋',  amount:  590, paymentMethod: '貨到付款',    shippingMethod: '宅配',     itemCount: 1, invoiceKind: '紙本發票',         rowStatus: 'unsorted' },
])
const selectedIds = ref<Set<string>>(new Set())
function isSelected(id: string): boolean { return selectedIds.value.has(id) }
function toggleSelect(id: string): void {
  const next = new Set(selectedIds.value)
  next.has(id) ? next.delete(id) : next.add(id)
  selectedIds.value = next
}
const allSelected = computed(() =>
  filteredRows.value.length > 0
  && filteredRows.value.every((r) => selectedIds.value.has(r.id)),
)
function toggleAll(): void {
  if (allSelected.value) {
    selectedIds.value = new Set()
  } else {
    selectedIds.value = new Set(filteredRows.value.map((r) => r.id))
  }
}

/** 依當前 statusTab 過濾顯示 row（all → 全部）。 */
const filteredRows = computed<InvoiceRow[]>(() => {
  if (statusTab.value === 'all') return rows.value
  if (statusTab.value === 'voided' || statusTab.value === 'issued') return []
  return rows.value.filter((r) => r.rowStatus === statusTab.value)
})

/** 對勾選列套用「批次目標狀態」。 */
function applyBulkStatus(): void {
  if (selectedIds.value.size === 0) return
  rows.value.forEach((r) => {
    if (selectedIds.value.has(r.id)) r.rowStatus = bulkTargetStatus.value
  })
  selectedIds.value = new Set()
}
/** 一鍵把目前 tab 看到的所有 row 都標為「開立發票」。 */
function quickClassifyToIssue(): void {
  filteredRows.value.forEach((r) => { r.rowStatus = 'to_issue' })
}
</script>

<template>
  <!-- 不使用 flex-1 min-h-0：本頁多個 Card 垂直堆疊，需用自然高度，由 DefaultLayout
       外層 overflow-y-auto 處理滾動；否則 Card 之間會因 flex-shrink 競爭高度，搭配
       Card 的 overflow-hidden 圓角裁切，造成頁籤切換時內容被切掉。 -->
  <div class="flex flex-col gap-4">

    <!-- ── 頁首 Card：標題 + 操作說明 + Toggle + 統計表 ── -->
    <Card
      :pt="{
        root: { class: 'w-full overflow-hidden' },
        body: { class: 'p-0' },
        content: { class: 'p-0' },
      }"
    >
      <template #content>
        <!-- 標題列：標題 + (?) + 系統操作說明 link + 兩個 toggle -->
        <div class="flex items-center gap-6 px-5 pt-5 pb-3 flex-wrap">
          <div class="flex items-center gap-2">
            <h1 class="text-[22px] font-bold text-[var(--p-text-color)]">發票作業</h1>
            <i
              v-tooltip.top="'本頁集中處理電子發票的開立、作廢與分類'"
              class="pi pi-info-circle text-[var(--p-text-muted-color)] cursor-help"
              style="font-size: 15px"
            ></i>
          </div>

          <a
            href="https://docs.168money.com.tw/dian-zi-fa-piao-guan-li/fa-piao-zuo-ye"
            target="_blank"
            rel="noopener noreferrer"
            class="flex items-center gap-1.5 text-[14px] font-medium text-[#2563EB] hover:underline cursor-pointer"
          >
            <i class="pi pi-book" style="font-size: 14px"></i>
            系統操作說明
          </a>

          <div class="flex items-center gap-2">
            <span class="text-[14px] text-[var(--p-text-color)]">發票明細：</span>
            <span class="text-[13px] text-[var(--p-text-muted-color)]">不印</span>
            <ToggleSwitch v-model="printInvoiceDetail" />
            <span class="text-[13px] text-[var(--p-text-muted-color)]">印</span>
          </div>

          <div class="flex items-center gap-2">
            <span class="text-[14px] text-[var(--p-text-color)]">前台發票顯示：</span>
            <span class="text-[13px] text-[var(--p-text-muted-color)]">關</span>
            <ToggleSwitch v-model="showFrontInvoice" />
            <span class="text-[13px] text-[var(--p-text-muted-color)]">開</span>
          </div>
        </div>

        <!-- 統計表：每家公司一列、3 個月份欄、當期剩餘總數
             依 Design.md 7.5：DataTable + striped-rows + Aura 預設樣式，不寫 :pt 客製 -->
        <div class="px-5 pb-5">
          <DataTable :value="monthlyRows" data-key="taxId" striped-rows class="w-full">
            <Column header="最近三個月發票總額">
              <template #body="{ data }">{{ data.taxId }} {{ data.companyName }}</template>
            </Column>
            <Column :header="monthlyHeaders[0]" body-class="text-right" header-class="text-right">
              <template #body="{ data }">{{ data.m1.toLocaleString() }}</template>
            </Column>
            <Column :header="monthlyHeaders[1]" body-class="text-right" header-class="text-right">
              <template #body="{ data }">{{ data.m2.toLocaleString() }}</template>
            </Column>
            <Column :header="monthlyHeaders[2]" body-class="text-right" header-class="text-right">
              <template #body="{ data }">{{ data.m3.toLocaleString() }}</template>
            </Column>
            <Column header="當期發票剩餘總數" body-class="text-right" header-class="text-right">
              <template #body="{ data }">
                <span :class="data.remaining < 100 ? 'font-semibold text-[#EF4444]' : ''">{{ data.remaining.toLocaleString() }}</span>
              </template>
            </Column>
          </DataTable>
        </div>
      </template>
    </Card>

    <!-- ── 訂單類型頁籤：一般訂單 / 儲值回饋禮 ──
         依 Design.md 6.6：Table 上方分類功能一律用頁籤 → PrimeVue Tabs 元件 -->
    <Tabs :value="orderKind" @update:value="(v) => orderKind = v as OrderKind">
      <TabList>
        <Tab v-for="opt in orderKindOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</Tab>
      </TabList>
    </Tabs>

    <!-- ── 搜尋 Card：發票查詢 ── -->
    <Card
      :pt="{
        root: { class: 'w-full overflow-hidden' },
        body: { class: 'p-0' },
        content: { class: 'p-0' },
      }"
    >
      <template #content>
        <div class="p-5 flex flex-col gap-4">
          <h2 class="text-[16px] font-semibold text-[var(--p-text-color)]">發票查詢</h2>

          <!-- Row 1：訂單欄位 / 關鍵字 / 訂單日期欄位 / DatePicker / 載具 -->
          <!-- 5 欄篩選：手機 stack 成 1 欄、≥ md 才回到 5 欄 -->
          <div class="grid gap-3 grid-cols-1 md:[grid-template-columns:140px_1fr_140px_1fr_1fr]">
            <Select v-model="filterOrderField" :options="orderNoTypeOptions" option-label="label" option-value="value" />
            <InputText v-model="filterKeyword" placeholder="請輸入關鍵字搜尋" />
            <Select v-model="filterDateField" :options="orderDateTypeOptions" option-label="label" option-value="value" />
            <DatePicker
              v-model="filterDateRange"
              selection-mode="range"
              show-icon
              date-format="yy/mm/dd"
              placeholder="年 / 月 / 日  至  年 / 月 / 日"
            />
            <Select v-model="filterCarrier" :options="carrierOptions" option-label="label" option-value="value" placeholder="所有載具類型" />
          </div>

          <!-- Row 2：金物流狀態 / 賣方統編 / 多購物車 -->
          <!-- 3 欄篩選：手機 stack、≥ md 才回 3 欄 -->
          <div class="grid gap-3 grid-cols-1 md:grid-cols-3">
            <Select v-model="filterPaymentLogistic" :options="paymentLogisticOptions" option-label="label" option-value="value" placeholder="不篩選金物流狀態" />
            <div class="flex items-center gap-2">
              <span class="text-[14px] text-[var(--p-text-color)] shrink-0">賣方統編：</span>
              <Select v-model="filterSeller" :options="sellerOptions" option-label="label" option-value="value" class="flex-1" />
            </div>
            <div class="flex items-center gap-2">
              <span class="text-[14px] text-[var(--p-text-color)] shrink-0">多購物車選項：</span>
              <Select v-model="filterMultiCart" :options="multiCartOptions" option-label="label" option-value="value" class="flex-1" />
            </div>
          </div>

          <!-- 搜尋 + 清空（>4 條件 → 加清空按鈕，符合 Design.md 7.6） -->
          <div class="flex items-center gap-3">
            <Button label="搜尋" @click="onSearch" />
            <Button label="清空" severity="secondary" variant="outlined" @click="onClear" />
          </div>
        </div>
      </template>
    </Card>

    <!-- ── 結果 Card：狀態頁籤 + 批次動作 + DataTable ── -->
    <Card
      :pt="{
        root: { class: 'w-full overflow-hidden' },
        body: { class: 'p-0' },
        content: { class: 'p-0' },
      }"
    >
      <template #content>
        <!-- 狀態頁籤（underline 樣式）-->
        <div class="flex items-center gap-6 px-5 pt-4 border-b border-[var(--p-content-border-color)]">
          <button
            v-for="t in statusTabs"
            :key="t.key"
            class="pb-3 text-[14px] font-medium transition-colors relative -mb-px"
            :class="statusTab === t.key
              ? 'text-[var(--p-primary-color)] border-b-2 border-[var(--p-primary-color)]'
              : 'text-[var(--p-text-muted-color)] hover:text-[var(--p-text-color)]'"
            @click="statusTab = t.key"
          >{{ t.label }}</button>
        </div>

        <!-- 批次動作列：左側欄位標題、右側 radio + 兩顆按鈕 -->
        <div class="flex items-start justify-between gap-3 px-5 py-3 flex-wrap">
          <div class="text-[13px] text-[var(--p-text-muted-color)]">
            勾選下方訂單後，選擇要變更的狀態並按「變更狀態」。
          </div>
          <div class="flex flex-col items-end gap-2">
            <div class="flex items-center gap-4">
              <label
                v-for="opt in bulkTargetOptions"
                :key="opt.value"
                class="flex items-center gap-1.5 text-[13px] text-[var(--p-text-color)] cursor-pointer"
              >
                <RadioButton v-model="bulkTargetStatus" :value="opt.value" :input-id="`bulk-${opt.value}`" />
                <span>{{ opt.label }}</span>
              </label>
            </div>
            <div class="flex items-center gap-2">
              <!-- 主要 CTA：紫色實心 + icon（7.4） -->
              <Button label="變更狀態" icon="pi pi-check" @click="applyBulkStatus" />
              <!-- 次要動作：紫色框線（7.4），與主要動作形成階層 -->
              <Button
                label="一鍵分類至開立發票"
                variant="outlined"
                @click="quickClassifyToIssue"
              />
              <i
                v-tooltip.top="'把目前頁籤看到的所有訂單一次分類到「開立發票」狀態'"
                class="pi pi-question-circle text-[var(--p-text-muted-color)] cursor-help"
                style="font-size: 14px"
              ></i>
            </div>
          </div>
        </div>

        <!-- 主表格：對齊 portal-vue 標準（PrimeVue Aura 預設樣式 + striped-rows） -->
        <div class="px-5 pb-5">
          <DataTable
            :value="filteredRows"
            data-key="id"
            striped-rows
            class="w-full"
          >
            <Column header-style="width: 3rem">
              <template #header>
                <Checkbox :model-value="allSelected" binary @change="toggleAll" />
              </template>
              <template #body="{ data }">
                <Checkbox :model-value="isSelected(data.id)" binary @change="toggleSelect(data.id)" />
              </template>
            </Column>
            <Column header="建檔時間" field="createdAt" />
            <Column header="多購物車" field="cart" />
            <Column header="訂單編號" field="orderNo">
              <template #body="{ data }">
                <span class="font-medium">{{ data.orderNo }}</span>
              </template>
            </Column>
            <Column header="訂購人" field="buyerName" />
            <Column header="金額" body-class="text-right" header-class="text-right">
              <template #body="{ data }">
                <span class="font-bold text-[var(--p-primary-color)]">NT$ {{ data.amount.toLocaleString() }}</span>
              </template>
            </Column>
            <Column header="支付方式、物流方式">
              <template #body="{ data }">
                <div class="flex flex-col gap-0.5">
                  <span>支付方式：（{{ data.paymentMethod }}）</span>
                  <span>物流方式：（{{ data.shippingMethod }}）</span>
                </div>
              </template>
            </Column>
            <Column header="商品數量" body-class="text-right" header-class="text-right" field="itemCount" />
            <Column header="發票類別 / 狀態">
              <template #body="{ data }">
                <div class="flex flex-col items-start gap-1.5">
                  <!-- portal-vue 慣例：cell 內次要文字用 text-xs + 灰 -->
                  <span class="text-xs text-gray-500">{{ data.invoiceKind }}</span>
                  <div class="flex items-center gap-3">
                    <label
                      v-for="opt in bulkTargetOptions"
                      :key="opt.value"
                      class="flex items-center gap-1 cursor-pointer"
                    >
                      <RadioButton
                        v-model="data.rowStatus"
                        :value="opt.value"
                        :input-id="`row-${data.id}-${opt.value}`"
                      />
                      <span>{{ opt.label }}</span>
                    </label>
                  </div>
                </div>
              </template>
            </Column>

            <template #empty>
              <div class="py-12 text-center text-color-secondary">
                目前無對應狀態的發票紀錄。
              </div>
            </template>
          </DataTable>
        </div>
      </template>
    </Card>
  </div>
</template>
