<script setup lang="ts">
import { computed, ref } from 'vue'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import MultiCartFormDialog, {
  type MultiCartFormPayload,
  type MultiCartRecord,
  type CheckoutMode,
  type TempLayer,
} from './components/MultiCartFormDialog.vue'

/**
 * 多購物車設定頁（依規劃原始設計 + 設計決議）。
 *
 * - 列表：建立日期 / 多購物車名稱（含說明）/ 設定摘要（金流・物流・行銷三行彩色標籤）/
 *   啟用狀態 / 操作
 * - 搜尋（名稱或購物車 ID）＋ 篩選（狀態 / 結帳模式 / 溫層）＋ 清除 ＋ 只顯示啟用中
 * - 欄位排序、分頁（每頁 10 為單位：10、20、30、40、50）
 * - 刪除為軟刪除；預設購物車不可停用、不可刪除
 */

const toast = useToast()
const confirm = useConfirm()

const carts = ref<MultiCartRecord[]>([
  {
    date: '2026/05/07 14:44',
    name: 'XSMART直播',
    id: 'MC-000001',
    desc: '新建收單時將自動套用此設定',
    locked: true,
    note: '銀行戶頭資料：<br>銀行:台新008<br>分行:13456-111333',
    mode: '標單必結',
    temp: '常溫',
    codStar: true,
    codStarLevel: 3,
    coupon: true,
    reward: true,
    freeShip: 2000,
    on: true,
    payList: ['線上信用卡（藍新）', 'Apple Pay', 'ATM 繳費帳號', '超商代碼繳費', 'LINE Pay', '貨到付款'],
    logiList: ['宅配', '超商配送', '跨境', '自取', '商家自建（如郵局）'],
  },
  {
    date: '2026/05/07 14:44',
    name: '全功能配置',
    id: 'MC-000002',
    desc: '開放所有結帳行為與多種金流物流',
    mode: '標單必結',
    temp: '常溫',
    codStar: false,
    codStarLevel: 1,
    coupon: true,
    reward: true,
    freeShip: 2000,
    on: true,
    payList: ['線上信用卡（藍新）', 'Apple Pay', 'ATM 繳費帳號', '超商代碼繳費', 'LINE Pay', '貨到付款'],
    logiList: ['宅配', '超商配送', '跨境', '自取', '商家自建（如郵局）'],
  },
  {
    date: '2026/05/07 14:44',
    name: '貨到付款限定',
    id: 'MC-000003',
    desc: '只開放超商貨到付款，不收線上付款',
    mode: '自選結帳',
    temp: '常溫',
    codStar: true,
    codStarLevel: 2,
    coupon: false,
    reward: false,
    freeShip: null,
    on: true,
    payList: ['貨到付款'],
    logiList: ['宅配', '超商配送'],
  },
  {
    date: '2026/05/14 15:18',
    name: '跨境配置',
    id: 'MC-000004',
    desc: '跨境配送（印尼、馬來西亞）專用',
    mode: '標單必結',
    temp: '冷凍',
    codStar: false,
    codStarLevel: 1,
    coupon: true,
    reward: false,
    freeShip: 1500,
    on: true,
    payList: ['線上信用卡（藍新）', 'Apple Pay', 'LINE Pay'],
    logiList: ['宅配', '跨境'],
  },
  {
    date: '2026/05/14 19:05',
    name: '自送結帳',
    id: 'MC-000005',
    desc: '只允許商家自行配送，不走第三方物流',
    mode: '棄標結帳',
    temp: '冷藏',
    codStar: true,
    codStarLevel: 4,
    coupon: false,
    reward: true,
    freeShip: null,
    on: false,
    payList: ['轉帳匯款', '貨到付款'],
    logiList: ['商家自建（如郵局）'],
  },
  {
    date: '2026/05/14 16:07',
    name: '離島配送',
    id: 'MC-000006',
    desc: '離島地區（澎湖、小琉球）專用',
    mode: '暫停結帳',
    temp: '常溫',
    codStar: false,
    codStarLevel: 1,
    coupon: false,
    reward: true,
    freeShip: 3000,
    on: true,
    payList: ['ATM 繳費帳號', '貨到付款'],
    logiList: ['宅配', '商家自建（如郵局）'],
  },
])

// ── 搜尋 / 篩選 ────────────────────────────────
const keyword = ref('')
const statusFilter = ref<'all' | 'on' | 'off'>('all')
const statusOptions = [
  { label: '狀態：全部', value: 'all' },
  { label: '啟用', value: 'on' },
  { label: '停用', value: 'off' },
]
const MODE_VALUES: CheckoutMode[] = ['標單必結', '自選結帳', '棄標結帳', '暫停結帳']
const modeFilter = ref<CheckoutMode | 'all'>('all')
const modeOptions = [
  { label: '結帳模式：全部', value: 'all' },
  ...MODE_VALUES.map((m) => ({ label: m, value: m })),
]
const TEMP_VALUES: TempLayer[] = ['常溫', '冷藏', '冷凍']
const tempFilter = ref<TempLayer | 'all'>('all')
const tempOptions = [
  { label: '溫層：全部', value: 'all' },
  ...TEMP_VALUES.map((t) => ({ label: t, value: t })),
]
const onlyEnabled = ref(false)

function onResetFilters(): void {
  keyword.value = ''
  statusFilter.value = 'all'
  modeFilter.value = 'all'
  tempFilter.value = 'all'
  onlyEnabled.value = false
}

const visibleCarts = computed(() =>
  carts.value.filter((c) => {
    if (c.deleted) return false
    if (onlyEnabled.value && !c.on) return false
    if (statusFilter.value === 'on' && !c.on) return false
    if (statusFilter.value === 'off' && c.on) return false
    if (modeFilter.value !== 'all' && c.mode !== modeFilter.value) return false
    if (tempFilter.value !== 'all' && c.temp !== tempFilter.value) return false
    const kw = keyword.value.trim()
    if (kw && !`${c.name} ${c.id}`.includes(kw)) return false
    return true
  }),
)

// ── 分頁（每頁 10 為單位） ─────────────────────
const pageFirst = ref(0)
const pageRows = ref(10)
const pageRowsOptions = [10, 20, 30, 40, 50]

// ── 設定摘要（金流 / 物流 / 行銷 三行） ────────
interface SummaryLine {
  label: string
  labelClass: string
  parts: Array<{ text: string; off?: boolean }>
}
function summaryOf(c: MultiCartRecord): SummaryLine[] {
  return [
    {
      label: '金流',
      labelClass: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      parts: [
        { text: c.mode },
        { text: `支付 ${c.payList.length} 種` },
      ],
    },
    {
      label: '物流',
      labelClass: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      parts: [
        { text: `${c.temp}溫層` },
        c.codStar
          ? { text: `${c.codStarLevel} 星等過濾` }
          : { text: '無星等過濾', off: true },
        { text: `物流 ${c.logiList.length} 種` },
      ],
    },
    {
      label: '行銷',
      labelClass: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      parts: [
        c.coupon ? { text: '啟用優惠券' } : { text: '關閉優惠券', off: true },
        c.reward ? { text: '啟用紅利' } : { text: '關閉紅利', off: true },
        c.freeShip != null
          ? { text: `免運滿 $${c.freeShip.toLocaleString()}` }
          : { text: '未設定免運', off: true },
      ],
    },
  ]
}

// ── 新增 / 編輯 dialog ────────────────────────
const formDialogVisible = ref(false)
const formDialogInitial = ref<MultiCartRecord | null>(null)
const defaultCart = computed(() => carts.value.find((c) => c.locked) ?? null)

function nextCartId(): string {
  const max = Math.max(0, ...carts.value.map((c) => Number(c.id.replace(/\D/g, '')) || 0))
  return `MC-${String(max + 1).padStart(6, '0')}`
}
const generatedId = computed(nextCartId)

function onAddCart(): void {
  formDialogInitial.value = null
  formDialogVisible.value = true
}
function onEditCart(c: MultiCartRecord): void {
  formDialogInitial.value = c
  formDialogVisible.value = true
}
function onCartFormSaved(payload: MultiCartFormPayload): void {
  if (payload.editingId) {
    const target = carts.value.find((c) => c.id === payload.editingId)
    if (!target) return
    Object.assign(target, payload.record)
    toast.add({ severity: 'success', summary: `已儲存「${payload.record.name}」`, life: 1800 })
    return
  }
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  carts.value.push({
    ...payload.record,
    id: nextCartId(),
    date: `${now.getFullYear()}/${pad(now.getMonth() + 1)}/${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`,
    on: true,
  })
  toast.add({ severity: 'success', summary: `已建立「${payload.record.name}」`, life: 1800 })
}

/** 軟刪除：僅標記 deleted，資料保留（列表隱藏） */
function onDeleteCart(c: MultiCartRecord, event: Event): void {
  if (c.locked) return
  confirm.require({
    target: event.currentTarget as HTMLElement,
    header: '刪除多購物車',
    message: `確定刪除「${c.name}」嗎？刪除後如需復原，請聯繫客服協助。`,
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: '刪除',
    rejectLabel: '取消',
    acceptClass: 'p-button-danger',
    defaultFocus: 'reject',
    accept: () => {
      c.deleted = true
      toast.add({ severity: 'success', summary: `已刪除「${c.name}」`, life: 1800 })
    },
  })
}
</script>

<template>
  <Card
    :pt="{
      root: { class: 'w-full' },
      body: { class: 'p-0' },
      content: { class: 'p-0' },
    }"
  >
    <template #content>
      <!-- 頁首：標題 + 新增 -->
      <div class="px-6 pt-5 pb-3 flex items-center justify-between gap-3 flex-wrap">
        <h1 class="text-2xl font-bold text-[var(--p-text-color)]">多購物車設定</h1>
        <Button label="新增多購物車" icon="pi pi-plus" @click="onAddCart" />
      </div>

      <!-- 搜尋 / 篩選列 -->
      <div class="px-6 pb-4 flex items-center gap-2 flex-wrap">
        <IconField icon-position="left">
          <InputIcon><i class="pi pi-search text-sm"></i></InputIcon>
          <InputText
            v-model="keyword"
            placeholder="搜尋名稱或購物車 ID"
            aria-label="搜尋名稱或購物車 ID"
            class="!w-[240px]"
          />
        </IconField>
        <Select
          v-model="statusFilter"
          :options="statusOptions"
          option-label="label"
          option-value="value"
          aria-label="依狀態篩選"
          class="!w-[140px]"
        />
        <Select
          v-model="modeFilter"
          :options="modeOptions"
          option-label="label"
          option-value="value"
          aria-label="依結帳模式篩選"
          class="!w-[170px]"
        />
        <Select
          v-model="tempFilter"
          :options="tempOptions"
          option-label="label"
          option-value="value"
          aria-label="依溫層篩選"
          class="!w-[130px]"
        />
        <Button label="清除" severity="secondary" outlined @click="onResetFilters" />
        <label class="ml-auto flex items-center gap-2 cursor-pointer text-sm text-[var(--p-text-color)]">
          <ToggleSwitch v-model="onlyEnabled" aria-label="只顯示啟用中" />
          只顯示啟用中
        </label>
      </div>

      <!-- 列表 -->
      <div class="px-6 pb-6">
        <DataTable
          :value="visibleCarts"
          data-key="id"
          striped-rows
          paginator
          :rows="pageRows"
          :rows-per-page-options="pageRowsOptions"
          v-model:first="pageFirst"
          removable-sort
          current-page-report-template="共 {totalRecords} 筆"
          paginator-template="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown CurrentPageReport"
        >
          <Column field="date" header="建立日期" sortable style="width: 170px">
            <template #body="{ data }">
              <span class="text-[var(--p-text-muted-color)]">{{ data.date }}</span>
            </template>
          </Column>

          <Column field="name" header="多購物車名稱" sortable style="min-width: 200px">
            <template #body="{ data }">
              <div class="flex flex-col gap-1">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="font-bold text-[var(--p-text-color)]">{{ data.name }}</span>
                  <Tag v-if="data.locked" value="預設" severity="info" />
                </div>
                <span class="text-xs text-[var(--p-text-muted-color)]">{{ data.id }}</span>
                <span v-if="data.desc" class="text-xs text-[var(--p-text-muted-color)]">{{ data.desc }}</span>
              </div>
            </template>
          </Column>

          <Column header="設定摘要" style="min-width: 320px">
            <template #body="{ data }">
              <div class="flex flex-col gap-1.5">
                <div
                  v-for="line in summaryOf(data)"
                  :key="line.label"
                  class="flex items-baseline gap-2"
                >
                  <span
                    class="shrink-0 w-[34px] text-center text-[11px] font-bold rounded px-0 py-0.5"
                    :class="line.labelClass"
                  >{{ line.label }}</span>
                  <span class="text-[12.5px] leading-relaxed text-[var(--p-text-color)]">
                    <template v-for="(p, i) in line.parts" :key="i">
                      <span :class="p.off ? 'text-[var(--p-text-muted-color)]' : ''">{{ p.text }}</span
                      ><span v-if="i < line.parts.length - 1">、</span>
                    </template>
                  </span>
                </div>
              </div>
            </template>
          </Column>

          <Column field="on" header="啟用狀態" sortable style="width: 130px">
            <template #body="{ data }">
              <div
                v-tooltip.top="data.locked ? '預設購物車不可停用' : ''"
                class="inline-flex items-center gap-2"
              >
                <ToggleSwitch
                  v-model="data.on"
                  :disabled="data.locked"
                  :aria-label="`${data.name} 啟用狀態`"
                />
                <span class="text-xs text-[var(--p-text-muted-color)]">
                  {{ data.on ? '啟用' : '停用' }}
                </span>
              </div>
            </template>
          </Column>

          <Column header="操作" style="width: 110px" body-class="text-right" header-class="text-right">
            <template #body="{ data }">
              <div class="flex items-center justify-end gap-1">
                <Button
                  v-tooltip.top="'編輯'"
                  icon="pi pi-pen-to-square"
                  variant="text"
                  rounded
                  size="small"
                  :aria-label="`編輯 ${data.name}`"
                  @click="onEditCart(data)"
                />
                <Button
                  v-if="!data.locked"
                  v-tooltip.top="'刪除'"
                  icon="pi pi-trash"
                  severity="danger"
                  variant="text"
                  rounded
                  size="small"
                  :aria-label="`刪除 ${data.name}`"
                  @click="onDeleteCart(data, $event)"
                />
                <Button
                  v-else
                  v-tooltip.top="'預設購物車不可刪除'"
                  icon="pi pi-trash"
                  severity="secondary"
                  variant="text"
                  rounded
                  size="small"
                  disabled
                  aria-label="預設購物車不可刪除"
                />
              </div>
            </template>
          </Column>

          <template #empty>
            <div class="py-12 text-center text-color-secondary">沒有符合條件的資料</div>
          </template>
        </DataTable>
      </div>
    </template>
  </Card>

  <MultiCartFormDialog
    v-model:visible="formDialogVisible"
    :initial="formDialogInitial"
    :template="defaultCart"
    :generated-id="generatedId"
    @saved="onCartFormSaved"
  />
</template>
