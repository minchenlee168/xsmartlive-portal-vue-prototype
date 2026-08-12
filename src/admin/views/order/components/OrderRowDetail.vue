<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import type { MenuItem } from 'primevue/menuitem'
import ShippingConfigDialog from './ShippingConfigDialog.vue'
import IssueInvoiceDialog from './IssueInvoiceDialog.vue'
import ShippingListPrintDialog from './ShippingListPrintDialog.vue'
import { useShippingBatches, type BatchShippingStatus, type OrderBatch } from '../composables/useShippingBatches'
import { usePrintLog } from '../composables/usePrintLog'
import PrintHistoryDialog from './PrintHistoryDialog.vue'

/**
 * 訂單列表 row expansion 展開內容。
 *
 * 三大區塊：
 * 1. 上方 4 卡（grid）：配送資訊 / 訂單來源 / 付款方式 / 發票資訊
 * 2. 出貨管理：動作按鈕列 + 配送物流狀態 + 出貨進度 Timeline + 出貨單備註
 * 3. 商品明細 table + 訂單總計（運費 / 商品總額 / 總計）
 */

interface OrderRow {
  id: string
  createdAt: string
  cartTag: { label: string; bg: string; color: string }
  orderNo: string
  buyerName: string
  buyerPhone: string
  amount: number
  itemCount: number
  shippingMethod: string
  paymentStatus: 'paid' | 'unpaid'
  shippingStatus: 'pending' | 'preparing' | 'shipping' | 'awaiting_receipt' | 'arrived' | 'completed' | 'cancelled'
  carrierStatus: 'unconfigured' | 'configured'
  trackingStatus: string | null
  carrierName?: string
  orderSource: 'live' | 'shop'
  socialPlatform?: 'facebook' | 'line' | 'instagram' | 'tiktok' | 'other'
  multiCart: 'default' | 'main' | 'ice' | 'ice_grocery'
  sessionName?: 'session_0620' | 'session_0622' | 'session_0624' | 'session_0625'
  channel: string
  couponActivity?: string
  couponDiscount?: number
  pointsDiscount?: number
  dispatchBatchCount?: number
  invoiceNumber?: string
  invoiceIssuedAt?: string
}

interface Props {
  order: OrderRow
}
const props = defineProps<Props>()
const emit = defineEmits<{
  /** 觸發分批出貨作業（父層負責關閉詳情彈窗 + 開啟分批出貨彈窗） */
  'open-split-page': [orderId: string]
}>()

/** 出貨狀態 → 用 PrimeVue Tag severity（走 Design.md 定義的狀態語意色） */
type TagSeverity = 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast'
const shippingBadge = computed<{ label: string; severity: TagSeverity }>(() => {
  const map: Record<OrderRow['shippingStatus'], { label: string; severity: TagSeverity }> = {
    pending:          { label: '待出貨', severity: 'warn' },
    preparing:        { label: '備貨中', severity: 'info' },
    shipping:         { label: '出貨中', severity: 'warn' },
    awaiting_receipt: { label: '待收貨', severity: 'secondary' },
    arrived:          { label: '已送達', severity: 'success' },
    completed:        { label: '已完成', severity: 'secondary' },
    cancelled:        { label: '已取消', severity: 'danger' },
  }
  return map[props.order.shippingStatus]
})

/** 訂單來源 → 顯示文字 */
const sourceLabel = computed(() => props.order.orderSource === 'live' ? '直播' : '商城')
const socialLabel = computed(() => {
  const map = { facebook: 'Facebook', line: 'LINE', instagram: 'Instagram', tiktok: 'TikTok', other: '其他' } as const
  return props.order.socialPlatform ? map[props.order.socialPlatform] : '—'
})
const cartLabel = computed(() => {
  const map = { default: '預設購物車', main: '主購物車', ice: '冰品專區', ice_grocery: '冰品專區 / 生活雜貨' } as const
  return map[props.order.multiCart]
})
const sessionLabel = computed(() => {
  const map = { session_0620: '6-20 開箱直播', session_0622: '6-22 美妝直播', session_0624: '6-24 晚間生鮮直播', session_0625: '6-25 服飾團' } as const
  return props.order.sessionName ? map[props.order.sessionName] : '—'
})

/** 出貨進度 5 階段（用 PrimeVue Timeline 水平顯示） */
interface StepItem { key: string; label: string; isCurrent: boolean; isPast: boolean; time: string; icon: string }
const progressSteps = computed<StepItem[]>(() => {
  const order: Array<{ key: OrderRow['shippingStatus']; label: string; icon: string }> = [
    { key: 'pending',    label: '待出貨', icon: 'pi pi-clock' },
    { key: 'preparing',  label: '備貨中', icon: 'pi pi-box' },
    { key: 'shipping',   label: '已出貨', icon: 'pi pi-truck' },
    { key: 'arrived',    label: '已送達', icon: 'pi pi-map-marker' },
    { key: 'completed',  label: '已完成', icon: 'pi pi-check-circle' },
  ]
  const currentIdx = order.findIndex(s => s.key === props.order.shippingStatus)
  return order.map((s, i) => ({
    key: s.key,
    label: s.label,
    icon: s.icon,
    isCurrent: i === currentIdx,
    isPast: i < currentIdx,
    time: i === currentIdx ? props.order.createdAt.slice(5, 10) + ' ' + props.order.createdAt.slice(11, 16) : '—',
  }))
})

/** 商品明細：prototype mock 一筆，依照 cart tag 給名稱 */
interface ProductRow { name: string; spec: string; source: string; price: number; qty: number }
const productRows = computed<ProductRow[]>(() => {
  // mock：用訂單金額 ÷ 商品數量推單價
  const unitPrice = Math.round(props.order.amount / Math.max(1, props.order.itemCount) - 120 / Math.max(1, props.order.itemCount))
  return [{
    name: props.order.cartTag.label === '服飾專區' ? '韓版寬鬆連帽外套（米白）' : '示意商品',
    spec: props.order.cartTag.label === '服飾專區' ? '尺寸 M / 米白色內裡' : '預設規格',
    source: sourceLabel.value,
    price: unitPrice,
    qty: props.order.itemCount,
  }]
})
const subtotal = computed(() => productRows.value.reduce((sum, r) => sum + r.price * r.qty, 0))
const shippingFee = 120
const couponDiscount = computed(() => props.order.couponDiscount ?? 0)
const pointsDiscount = computed(() => props.order.pointsDiscount ?? 0)
const total = computed(() => subtotal.value + shippingFee - couponDiscount.value - pointsDiscount.value)

/** 配送資訊卡整卡編輯：點筆 icon → 出貨方式 Select + 姓名/電話/地址 InputText；按打勾 commit */
const shippingMethodOptions = [
  { label: '宅配',      value: '常溫宅配' },
  { label: '超商配送',  value: '超商配送' },
  { label: '自取',      value: '自取' },
]
const editingShipping = ref(false)
const editShippingMethod = ref<string>(props.order.shippingMethod)
const editBuyerName = ref<string>(props.order.buyerName)
const editBuyerPhone = ref<string>(props.order.buyerPhone)
/** 地址欄不在 OrderRow 上，用 local ref 保存 prototype 值 */
const shippingAddress = ref<string>('台北市中山區南京東路二段50號')

/** 付款方式卡整卡編輯：付款狀態 + 付款方式 都變 Select */
const paymentStatusOptions = [
  { label: '已付款', value: 'paid' as const },
  { label: '待付款', value: 'unpaid' as const },
]
const paymentMethodOptions = [
  { label: '信用卡一次付清', value: 'credit_once' },
  { label: 'ATM 轉帳',       value: 'atm' },
  { label: 'LINE Pay',       value: 'line_pay' },
  { label: 'Apple Pay',      value: 'apple_pay' },
  { label: 'iPASS MONEY',    value: 'ipass' },
  { label: '貨到付款',       value: 'cod' },
]
const editingPayment = ref(false)
const editPaymentStatus = ref<'paid' | 'unpaid'>(props.order.paymentStatus)
/** 付款方式欄不在 OrderRow 上，用 local ref 保存 prototype 值 */
const editPaymentMethodValue = ref<string>('credit_once')
const paymentMethodLabel = computed(() =>
  paymentMethodOptions.find(o => o.value === editPaymentMethodValue.value)?.label ?? '—',
)

// 切換不同訂單時同步初始值
watch(() => props.order.id, () => {
  editShippingMethod.value = props.order.shippingMethod
  editBuyerName.value = props.order.buyerName
  editBuyerPhone.value = props.order.buyerPhone
  shippingAddress.value = '台北市中山區南京東路二段50號'
  editingShipping.value = false
  editPaymentStatus.value = props.order.paymentStatus
  editingPayment.value = false
})

function commitShipping(): void {
  props.order.shippingMethod = editShippingMethod.value
  props.order.buyerName = editBuyerName.value
  props.order.buyerPhone = editBuyerPhone.value
  editingShipping.value = false
}
function commitPayment(): void {
  props.order.paymentStatus = editPaymentStatus.value
  editingPayment.value = false
}

/**
 * 狀態切換 Dialog：
 * - 「狀態切換」鈕 → 推進到下一階段
 * - 點 stepper 任一階段 → 跳到該階段（可前進或後退）
 */
const STATUS_FLOW: Array<{ key: OrderRow['shippingStatus']; label: string }> = [
  { key: 'pending',          label: '待出貨' },
  { key: 'preparing',        label: '備貨中' },
  { key: 'shipping',         label: '已出貨' },
  { key: 'arrived',          label: '已送達' },
  { key: 'completed',        label: '已完成' },
]
const statusSwitchDialogVisible = ref(false)
/** 使用者要切換的目標狀態（點 stepper 或按下一步時決定） */
const statusSwitchTarget = ref<OrderRow['shippingStatus'] | null>(null)
const currentStatusLabel = computed(() => STATUS_FLOW.find(s => s.key === props.order.shippingStatus)?.label ?? '')
const targetStatusLabel = computed(() => STATUS_FLOW.find(s => s.key === statusSwitchTarget.value)?.label ?? '')
const nextStatusInfo = computed(() => {
  const idx = STATUS_FLOW.findIndex(s => s.key === props.order.shippingStatus)
  if (idx < 0 || idx >= STATUS_FLOW.length - 1) return null
  return STATUS_FLOW[idx + 1]
})
/** 「狀態切換」按鈕：目標 = 下一階段 */
function openStatusSwitchDialog(): void {
  if (!nextStatusInfo.value) return
  statusSwitchTarget.value = nextStatusInfo.value.key
  statusSwitchDialogVisible.value = true
}
/** 點 stepper 任一階段：目標 = 該階段（同狀態則不動） */
function onStepClick(key: OrderRow['shippingStatus']): void {
  if (key === props.order.shippingStatus) return
  statusSwitchTarget.value = key
  statusSwitchDialogVisible.value = true
}
function confirmStatusSwitch(): void {
  if (!statusSwitchTarget.value) return
  props.order.shippingStatus = statusSwitchTarget.value
  statusSwitchDialogVisible.value = false
  statusSwitchTarget.value = null
}

/** 設定配送 Dialog：委派給 ShippingConfigDialog 共用元件（與訂單列表表格共用） */
const shippingConfigDialogVisible = ref(false)
function onShippingConfigConfirm(payload: { carrierName: string; method: string; trackingNo: string | null }): void {
  props.order.carrierStatus = 'configured'
  props.order.carrierName = payload.carrierName
  props.order.trackingStatus = payload.trackingNo
}

// ─────────────────────────────────────────────────────────────
// 分批出貨版「出貨管理」：訂單已分批時（共享批次狀態有資料）改渲染分批版
// ─────────────────────────────────────────────────────────────
const { getBatches, setBatches } = useShippingBatches()
const batches = computed<OrderBatch[]>(() => getBatches(props.order.orderNo))
const isBatched = computed<boolean>(() => batches.value.length > 0)

// mock 資料中已標記分批（dispatchBatchCount）但 store 尚無批次明細者，
// 補上示意批次，讓明細分批版與列表「已分批 N 批」一致。
watch(() => props.order.orderNo, () => {
  const n = props.order.dispatchBatchCount ?? 0
  if (n <= 0 || getBatches(props.order.orderNo).length > 0) return
  const p = productRows.value[0]
  const base = Math.floor(props.order.itemCount / n)
  const rem = props.order.itemCount % n
  const seeded: OrderBatch[] = Array.from({ length: n }, (_, i) => ({
    status: 'pending',
    note: '',
    items: [{ name: p?.name ?? '商品', spec: p?.spec, qty: Math.max(1, base + (i < rem ? 1 : 0)), unitPrice: p?.price ?? 0 }],
  }))
  setBatches(props.order.orderNo, seeded)
}, { immediate: true })

const CN_NUM = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十']
const batchLabel = (i: number): string => `批次${CN_NUM[i] ?? String(i + 1)}`

/** 批次狀態 → Tag（走與訂單相同的語意色） */
function batchStatusBadge(s: BatchShippingStatus): { label: string; severity: TagSeverity } {
  const map: Record<BatchShippingStatus, { label: string; severity: TagSeverity }> = {
    pending:   { label: '待出貨', severity: 'warn' },
    preparing: { label: '備貨中', severity: 'info' },
    shipping:  { label: '已出貨', severity: 'warn' },
    arrived:   { label: '已送達', severity: 'success' },
    completed: { label: '已完成', severity: 'secondary' },
  }
  return map[s]
}

/** 單一批次的 5 階段貨態（供每張批次卡的 Timeline 使用） */
const BATCH_FLOW: Array<{ key: BatchShippingStatus; label: string; icon: string }> = [
  { key: 'pending',   label: '待出貨', icon: 'pi pi-clock' },
  { key: 'preparing', label: '備貨中', icon: 'pi pi-box' },
  { key: 'shipping',  label: '已出貨', icon: 'pi pi-truck' },
  { key: 'arrived',   label: '已送達', icon: 'pi pi-map-marker' },
  { key: 'completed', label: '已完成', icon: 'pi pi-check-circle' },
]
function batchSteps(status: BatchShippingStatus): StepItem[] {
  const idx = BATCH_FLOW.findIndex(s => s.key === status)
  return BATCH_FLOW.map((s, i) => ({
    key: s.key, label: s.label, icon: s.icon,
    isCurrent: i === idx, isPast: i < idx, time: '—',
  }))
}
/** 點某批次的貨態圓點 → 二次確認後切換該批狀態（與整單貨態切換一致） */
const confirm = useConfirm()
function setBatchStatus(batch: OrderBatch, status: BatchShippingStatus): void {
  if (batch.status === status) return
  const from = batchStatusBadge(batch.status).label
  const to = batchStatusBadge(status).label
  confirm.require({
    header: '切換批次貨態',
    message: `確定要將此批貨態由「${from}」切換為「${to}」嗎？`,
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: '確定切換',
    rejectLabel: '取消',
    defaultFocus: 'reject',
    accept: () => { batch.status = status },
  })
}

/** 整單層級配送物流聚合摘要（分批模式下取代單一「配送物流」列） */
const batchCarrierSummary = computed<string>(() => {
  const total = batches.value.length
  const done = batches.value.filter(b => b.carrier).length
  if (done === 0) return `${total} 批皆尚未指派物流`
  if (done === total) return `${total} 批皆已指派物流`
  return `${total} 批中 ${done} 批已指派物流、${total - done} 批待設定`
})

/** 每批「設定配送 / 修改」：委派 ShippingConfigDialog，confirm 後寫回該批 carrier */
const batchConfigIdx = ref<number | null>(null)
const batchConfigDialogVisible = ref(false)
const batchConfigOrder = computed(() => {
  const b = batchConfigIdx.value != null ? batches.value[batchConfigIdx.value] : null
  return {
    orderNo: props.order.orderNo,
    buyerName: props.order.buyerName,
    carrierStatus: (b?.carrier ? 'configured' : 'unconfigured') as 'configured' | 'unconfigured',
    carrierName: b?.carrier?.name,
    trackingStatus: b?.carrier?.tracking ?? null,
  }
})
function openBatchConfig(i: number): void {
  batchConfigIdx.value = i
  batchConfigDialogVisible.value = true
}
function onBatchConfigConfirm(payload: { carrierName: string; method: string; trackingNo: string | null }): void {
  if (batchConfigIdx.value == null) return
  const b = batches.value[batchConfigIdx.value]
  if (b) b.carrier = { name: payload.carrierName, tracking: payload.trackingNo, method: payload.method }
}

// ── 分批後：列印出貨單 / 列印標籤 改為下拉（全部 + 各批次） ──
const toast = useToast()
interface PopoverApi { toggle: (event: Event) => void }
interface BatchMenuItem extends MenuItem { batchStatus?: BatchShippingStatus }
const batchQty = (b: OrderBatch): number => b.items.reduce((s, it) => s + it.qty, 0)

/** 列印出貨單下拉：全部商品（合併單）+ 各批次（附件數與狀態）→ 開出貨單預覽彈窗 */
const printSheetMenuRef = ref<PopoverApi | null>(null)
function togglePrintSheetMenu(event: Event): void { printSheetMenuRef.value?.toggle(event) }
const printSheetScope = ref<'all' | number>('all')
const printSheetMenuItems = computed<BatchMenuItem[]>(() => [
  { label: '全部商品（合併單）', icon: 'pi pi-copy', command: () => openPrintSheet('all') },
  ...batches.value.map((b, i) => ({
    label: `${batchLabel(i)}（${batchQty(b)} 件）`,
    icon: 'pi pi-box',
    batchStatus: b.status,
    command: () => openPrintSheet(i + 1),
  })),
])
function openPrintSheet(scope: 'all' | number): void {
  printSheetScope.value = scope
  printDialogVisible.value = true
}

/** 列印標籤下拉：全部批次 + 各批次（附件數） */
const labelMenuRef = ref<PopoverApi | null>(null)
function toggleLabelMenu(event: Event): void { labelMenuRef.value?.toggle(event) }
const labelMenuItems = computed<BatchMenuItem[]>(() => [
  { label: '全部批次', icon: 'pi pi-copy', command: () => printLabel('全部批次') },
  ...batches.value.map((b, i) => ({
    label: `${batchLabel(i)}（${batchQty(b)} 件）`,
    icon: 'pi pi-box',
    command: () => printLabel(`${batchLabel(i)}`),
  })),
])
const { logPrint } = usePrintLog()
function printLabel(scope: string): void {
  toast.add({ severity: 'info', summary: `列印標籤 · ${props.order.orderNo}（${scope}）`, life: 1800 })
  logPrint(props.order.orderNo, 'label')
}

/** 列印標籤（未分批單一按鈕）→ info toast */
function printLabelToast(): void {
  toast.add({ severity: 'info', summary: `列印標籤 · ${props.order.orderNo}`, life: 1800 })
  logPrint(props.order.orderNo, 'label')
}
/** 列印發票 → success toast */
function printInvoiceToast(): void {
  toast.add({ severity: 'success', summary: `列印發票 · ${props.order.orderNo}`, life: 1800 })
  logPrint(props.order.orderNo, 'invoice')
}
/** 出貨單預覽彈窗按下「列印」→ 記錄一次出貨單列印 */
function onSheetPrinted(): void {
  logPrint(props.order.orderNo, 'sheet')
}

/** 列印紀錄彈窗 */
const printHistoryDialogVisible = ref(false)

/** 分批出貨作業：點按鈕發事件通知父層關閉詳情彈窗、開啟分批出貨彈窗 */
function openSplitPage(): void {
  emit('open-split-page', props.order.id)
}

/** 出貨單列印 Dialog */
const printDialogVisible = ref(false)

/** 開立發票 Dialog：委派給 IssueInvoiceDialog 共用元件 */
const issueInvoiceDialogVisible = ref(false)
function onInvoiceIssued(payload: { number: string; time: string }): void {
  props.order.invoiceNumber = payload.number
  props.order.invoiceIssuedAt = payload.time
}
</script>

<template>
  <div class="flex flex-col gap-4 p-4 bg-[var(--p-content-hover-background)]">
    <!-- 上方 4 卡 grid：配送資訊 / 訂單來源 / 付款方式 / 發票資訊 -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
      <!-- 配送資訊：整卡編輯（點筆 icon 進入編輯，打勾 icon commit） -->
      <div class="rounded-lg border border-[var(--p-content-border-color)] bg-[var(--p-content-background)] p-4 flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="text-sm font-bold text-[var(--p-text-color)]">配送資訊</span>
            <Button
              v-if="!editingShipping"
              v-tooltip.top="'編輯'"
              aria-label="編輯配送資訊"
              icon="pi pi-pencil"
              severity="secondary"
              variant="text"
              size="small"
              rounded
              @click="editingShipping = true"
            />
            <Button
              v-else
              v-tooltip.top="'確認'"
              aria-label="確認配送資訊"
              icon="pi pi-check"
              severity="secondary"
              variant="text"
              size="small"
              rounded
              @click="commitShipping"
            />
          </div>
          <Tag :value="shippingBadge.label" :severity="shippingBadge.severity" />
        </div>

        <!-- 檢視模式 -->
        <template v-if="!editingShipping">
          <div class="flex items-center gap-2 text-sm text-[var(--p-text-color)]">
            <i class="pi pi-truck text-sm text-[var(--p-text-muted-color)]"></i>
            {{ order.shippingMethod }}
          </div>
          <div class="flex items-start gap-2 text-sm text-[var(--p-text-color)]">
            <i class="pi pi-map-marker mt-1 text-sm text-[var(--p-text-muted-color)]"></i>
            <div class="flex flex-col gap-1">
              <span>{{ order.buyerName }} / {{ order.buyerPhone }}</span>
              <span class="text-xs text-[var(--p-text-muted-color)]">{{ shippingAddress }}</span>
            </div>
          </div>
        </template>

        <!-- 編輯模式：出貨方式 Select + 姓名/電話/地址 InputText（label 常駐可見） -->
        <template v-else>
          <div class="flex flex-col gap-1">
            <label class="text-xs text-[var(--p-text-muted-color)]">出貨方式</label>
            <Select
              v-model="editShippingMethod"
              :options="shippingMethodOptions"
              option-label="label"
              option-value="value"
              class="w-full"
              size="small"
            />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs text-[var(--p-text-muted-color)]">收件人</label>
            <InputText v-model="editBuyerName" placeholder="收件人姓名" class="w-full" size="small" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs text-[var(--p-text-muted-color)]">電話</label>
            <InputText v-model="editBuyerPhone" placeholder="收件人電話" class="w-full" size="small" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs text-[var(--p-text-muted-color)]">收件地址</label>
            <InputText v-model="shippingAddress" placeholder="收件地址" class="w-full" size="small" />
          </div>
        </template>
      </div>

      <!-- 訂單來源（比照規範頁：訂單來源 + 平台列；平台列標題用「收單來源」） -->
      <div class="rounded-lg border border-[var(--p-content-border-color)] bg-[var(--p-content-background)] p-4 flex flex-col gap-2">
        <span class="text-sm font-bold text-[var(--p-text-color)]">訂單來源</span>
        <div class="flex items-center justify-between text-sm">
          <span class="text-[var(--p-text-muted-color)]">訂單來源</span>
          <span class="font-medium text-[var(--p-text-color)]">{{ sourceLabel }}</span>
        </div>
        <div class="flex items-center justify-between text-sm">
          <span class="text-[var(--p-text-muted-color)]">收單來源</span>
          <span class="text-[var(--p-text-color)]">{{ socialLabel }}</span>
        </div>
        <div class="flex items-center justify-between text-sm">
          <span class="text-[var(--p-text-muted-color)]">多購物車</span>
          <span class="text-[var(--p-text-color)]">{{ cartLabel }}</span>
        </div>
        <div class="flex items-center justify-between text-sm">
          <span class="text-[var(--p-text-muted-color)]">場次名稱</span>
          <span class="text-[var(--p-text-color)]">{{ sessionLabel }}</span>
        </div>
      </div>

      <!-- 付款方式：整卡編輯 -->
      <div class="rounded-lg border border-[var(--p-content-border-color)] bg-[var(--p-content-background)] p-4 flex flex-col gap-2">
        <div class="flex items-center gap-2">
          <span class="text-sm font-bold text-[var(--p-text-color)]">付款方式</span>
          <Button
            v-if="!editingPayment"
            v-tooltip.top="'編輯'"
            aria-label="編輯付款方式"
            icon="pi pi-pencil"
            severity="secondary"
            variant="text"
            size="small"
            rounded
            @click="editingPayment = true"
          />
          <Button
            v-else
            v-tooltip.top="'確認'"
            aria-label="確認付款方式"
            icon="pi pi-check"
            severity="secondary"
            variant="text"
            size="small"
            rounded
            @click="commitPayment"
          />
        </div>

        <div class="flex items-center justify-between text-sm">
          <span class="text-[var(--p-text-muted-color)]">付款狀態</span>
          <Tag
            v-if="!editingPayment"
            :value="order.paymentStatus === 'paid' ? '已付款' : '待付款'"
            :severity="order.paymentStatus === 'paid' ? 'success' : 'warn'"
          />
          <Select
            v-else
            v-model="editPaymentStatus"
            :options="paymentStatusOptions"
            option-label="label"
            option-value="value"
            size="small"
            class="!w-[120px]"
            :pt="{ label: { class: '!whitespace-nowrap !overflow-visible' } }"
          />
        </div>
        <div class="flex items-center justify-between text-sm">
          <span class="text-[var(--p-text-muted-color)]">付款方式</span>
          <span v-if="!editingPayment" class="text-[var(--p-text-color)]">{{ paymentMethodLabel }}</span>
          <Select
            v-else
            v-model="editPaymentMethodValue"
            :options="paymentMethodOptions"
            option-label="label"
            option-value="value"
            size="small"
            class="!w-[160px]"
            :pt="{ label: { class: '!whitespace-nowrap !overflow-visible' } }"
          />
        </div>
        <div class="flex items-center justify-between text-sm">
          <span class="text-[var(--p-text-muted-color)]">應付金額</span>
          <span class="font-bold text-[var(--p-primary-color)]">${{ order.amount.toLocaleString() }}</span>
        </div>
      </div>

      <!-- 發票資訊（唯讀，依規範不加編輯） -->
      <div class="rounded-lg border border-[var(--p-content-border-color)] bg-[var(--p-content-background)] p-4 flex flex-col gap-2">
        <span class="text-sm font-bold text-[var(--p-text-color)]">發票資訊</span>
        <div class="flex items-center gap-2 text-sm text-[var(--p-text-color)]">
          <i class="pi pi-id-card text-sm text-[var(--p-text-muted-color)]"></i>
          電子發票（會員載具）
        </div>
        <!-- 已開立：顯示發票號碼 + 開立時間；未開立：橘字提示 -->
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
        <div v-else class="pt-2 border-t border-[var(--p-content-border-color)]">
          <span class="inline-flex items-center gap-1 text-xs text-yellow-600 dark:text-yellow-400">
            <i class="pi pi-exclamation-circle text-sm"></i>
            尚未開立
          </span>
        </div>
      </div>
    </div>

    <!-- 出貨管理（依規範：紫色外框） -->
    <div class="rounded-lg border-2 border-[var(--p-primary-color)] bg-[var(--p-content-background)] p-4 flex flex-col gap-4">
      <div class="flex items-center gap-2">
        <i class="pi pi-clipboard text-[var(--p-primary-color)]"></i>
        <span class="text-sm font-bold text-[var(--p-text-color)]">出貨管理</span>
      </div>

      <!-- ── 未分批：原本的整單出貨管理（動作列 + 配送/發票 + 出貨進度 + 備註） ── -->
      <template v-if="!isBatched">
      <!-- 動作按鈕列 -->
      <div class="flex items-center gap-2 flex-wrap">
        <Button label="設定配送" icon="pi pi-cog" size="small" @click="shippingConfigDialogVisible = true" />
        <Button
          label="狀態切換"
          icon="pi pi-sync"
          severity="secondary"
          variant="outlined"
          size="small"
          :disabled="!nextStatusInfo"
          @click="openStatusSwitchDialog"
        />
        <Button label="分批出貨" icon="pi pi-th-large" severity="secondary" variant="outlined" size="small" @click="openSplitPage" />
        <span class="w-px h-6 bg-[var(--p-content-border-color)] mx-1 shrink-0" aria-hidden="true"></span>
        <Button label="列印出貨單" icon="pi pi-print" severity="secondary" variant="outlined" size="small" @click="printDialogVisible = true" />
        <Button label="列印標籤" icon="pi pi-tag" severity="secondary" variant="outlined" size="small" @click="printLabelToast" />
        <Button
          :label="order.invoiceNumber ? '已開立發票' : '開立發票'"
          icon="pi pi-file"
          severity="secondary"
          variant="outlined"
          size="small"
          @click="issueInvoiceDialogVisible = true"
        />
        <Button label="列印發票" icon="pi pi-file-check" severity="secondary" variant="outlined" size="small" @click="printInvoiceToast" />
        <Button label="列印紀錄" icon="pi pi-history" severity="secondary" variant="outlined" size="small" @click="printHistoryDialogVisible = true" />
      </div>

      <!-- 左：配送物流 / 發票 / 出貨進度 Timeline（較寬）；右：出貨單備註（較窄，不擠壓 timeline） -->
      <div class="grid grid-cols-1 md:grid-cols-[3fr_2fr] gap-4">
        <div class="flex flex-col gap-4 min-w-0">
          <div class="flex items-center gap-2 text-sm">
            <span class="text-[var(--p-text-muted-color)] w-[80px] shrink-0">配送物流</span>
            <span v-if="order.carrierStatus === 'configured'" class="inline-flex items-center gap-2 text-[var(--p-text-color)]">
              <i class="pi pi-truck text-[var(--p-primary-color)] text-sm"></i>
              <span class="font-medium">{{ order.carrierName }}</span>
              <template v-if="order.trackingStatus">
                <span class="text-[var(--p-text-muted-color)]">·</span>
                <span>取號 {{ order.trackingStatus }}</span>
              </template>
            </span>
            <span v-else class="inline-flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
              <i class="pi pi-exclamation-circle text-sm"></i>
              尚未指定物流商與取號
            </span>
          </div>

          <!-- 發票狀態（配送物流下方）：開立發票後顯示發票號 + 開立時間；未開立顯示警示 -->
          <div class="flex items-center gap-2 text-sm">
            <span class="text-[var(--p-text-muted-color)] w-[80px] shrink-0">發票</span>
            <span v-if="order.invoiceNumber" class="inline-flex items-center gap-2 text-[var(--p-text-color)]">
              <i class="pi pi-receipt text-[var(--p-primary-color)] text-sm"></i>
              <span class="font-medium">{{ order.invoiceNumber }}</span>
              <template v-if="order.invoiceIssuedAt">
                <span class="text-[var(--p-text-muted-color)]">·</span>
                <span>{{ order.invoiceIssuedAt }}</span>
              </template>
            </span>
            <span v-else class="inline-flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
              <i class="pi pi-exclamation-circle text-sm"></i>
              尚未開立
            </span>
          </div>

          <!-- 出貨進度 Timeline（左欄內） -->
          <div class="flex flex-col gap-2">
            <span class="text-xs text-[var(--p-text-muted-color)]">出貨進度</span>
            <!-- Stepper marker 可點按 → 跳確認彈窗切換到該階段 -->
            <Timeline :value="progressSteps" layout="horizontal" align="top" class="w-full">
              <template #marker="{ item }">
                <button
                  type="button"
                  v-tooltip.top="`切換為「${item.label}」`"
                  class="rounded-full inline-flex items-center justify-center cursor-pointer transition-transform hover:scale-110"
                  :style="{
                    width: item.isCurrent ? '32px' : '24px',
                    height: item.isCurrent ? '32px' : '24px',
                    background: item.isCurrent || item.isPast ? 'var(--p-primary-color)' : 'var(--p-content-hover-background)',
                    color: item.isCurrent || item.isPast ? '#fff' : 'var(--p-text-muted-color)',
                    border: item.isCurrent || item.isPast ? 'none' : '1px solid var(--p-content-border-color)',
                  }"
                  @click="onStepClick(item.key as OrderRow['shippingStatus'])"
                >
                  <i :class="item.icon" class="text-xs"></i>
                </button>
              </template>
              <template #content="{ item }">
                <div class="flex flex-col items-center gap-1 pt-1 whitespace-nowrap">
                  <span class="text-xs" :style="item.isCurrent ? 'color: var(--p-primary-color); font-weight: 600' : 'color: var(--p-text-muted-color)'">{{ item.label }}</span>
                  <span class="text-xs text-[var(--p-text-muted-color)]">{{ item.time }}</span>
                </div>
              </template>
              <template #connector>
                <span class="block h-px w-full" style="background: var(--p-content-border-color)"></span>
              </template>
            </Timeline>
          </div>
        </div>

        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <span class="text-sm text-[var(--p-text-color)]">出貨單備註</span>
            <label class="flex items-center gap-2 text-xs text-[var(--p-text-muted-color)] cursor-pointer">
              <Checkbox binary />
              <span>同步顯示於出貨單</span>
            </label>
          </div>
          <Textarea placeholder="輸入出貨相關備註...（將同步顯示於出貨單）" rows="5" class="w-full resize-none" />
        </div>
      </div>
      </template>

      <!-- ── 已分批：改渲染分批版（動作列 + 聚合狀態 + 每批一張卡 + 整單備註） ── -->
      <template v-else>
        <!-- 動作按鈕列（取消訂單改由明細彈窗 footer 統一提供） -->
        <div class="flex items-center gap-2 flex-wrap">
          <Button label="管理分批出貨" icon="pi pi-th-large" size="small" @click="openSplitPage" />
          <span class="w-px h-6 bg-[var(--p-content-border-color)] mx-1 shrink-0" aria-hidden="true"></span>
          <!-- 列印出貨單：分批後改下拉（全部商品合併單 + 各批次） -->
          <Button
            label="列印出貨單" icon="pi pi-chevron-down" icon-pos="right"
            severity="secondary" variant="outlined" size="small"
            aria-haspopup="true" @click="togglePrintSheetMenu"
          />
          <Menu ref="printSheetMenuRef" :model="printSheetMenuItems" :popup="true">
            <template #item="{ item, props }">
              <a v-bind="props.action" class="flex items-center gap-2">
                <i :class="item.icon" class="text-[var(--p-text-muted-color)]"></i>
                <span class="flex-1">{{ item.label }}</span>
                <span
                  v-if="(item as BatchMenuItem).batchStatus"
                  class="text-xs text-[var(--p-text-muted-color)]"
                >{{ batchStatusBadge((item as BatchMenuItem).batchStatus!).label }}</span>
              </a>
            </template>
          </Menu>
          <!-- 列印標籤：分批後改下拉（全部批次 + 各批次） -->
          <Button
            label="列印標籤" icon="pi pi-chevron-down" icon-pos="right"
            severity="secondary" variant="outlined" size="small"
            aria-haspopup="true" @click="toggleLabelMenu"
          />
          <Menu ref="labelMenuRef" :model="labelMenuItems" :popup="true">
            <template #item="{ item, props }">
              <a v-bind="props.action" class="flex items-center gap-2">
                <i :class="item.icon" class="text-[var(--p-text-muted-color)]"></i>
                <span class="flex-1">{{ item.label }}</span>
              </a>
            </template>
          </Menu>
          <Button
            :label="order.invoiceNumber ? '已開立發票' : '開立發票'"
            icon="pi pi-file" severity="secondary" variant="outlined" size="small"
            @click="issueInvoiceDialogVisible = true"
          />
          <Button label="列印發票" icon="pi pi-file-check" severity="secondary" variant="outlined" size="small" @click="printInvoiceToast" />
          <Button label="列印紀錄" icon="pi pi-history" severity="secondary" variant="outlined" size="small" @click="printHistoryDialogVisible = true" />
        </div>

        <!-- 整單層級配送物流聚合摘要 -->
        <div class="flex items-center gap-2 text-sm">
          <span class="text-[var(--p-text-muted-color)] w-[80px] shrink-0">配送物流</span>
          <span class="inline-flex items-center gap-1 text-[var(--p-text-color)]">
            <i class="pi pi-truck text-[var(--p-primary-color)] text-sm"></i>
            {{ batchCarrierSummary }}
          </span>
        </div>

        <!-- 發票狀態（配送物流下方）：開立發票後顯示發票號 + 開立時間；未開立顯示警示 -->
        <div class="flex items-center gap-2 text-sm">
          <span class="text-[var(--p-text-muted-color)] w-[80px] shrink-0">發票</span>
          <span v-if="order.invoiceNumber" class="inline-flex items-center gap-2 text-[var(--p-text-color)]">
            <i class="pi pi-receipt text-[var(--p-primary-color)] text-sm"></i>
            <span class="font-medium">{{ order.invoiceNumber }}</span>
            <template v-if="order.invoiceIssuedAt">
              <span class="text-[var(--p-text-muted-color)]">·</span>
              <span>{{ order.invoiceIssuedAt }}</span>
            </template>
          </span>
          <span v-else class="inline-flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
            <i class="pi pi-exclamation-circle text-sm"></i>
            尚未開立
          </span>
        </div>

        <!-- 已分批 N 批 -->
        <div class="pt-2 border-t border-[var(--p-content-border-color)]">
          <span class="text-sm font-bold text-[var(--p-text-color)]">已分批 {{ batches.length }} 批</span>
        </div>

        <!-- 批次卡清單 -->
        <div class="flex flex-col gap-3">
          <div
            v-for="(b, i) in batches"
            :key="i"
            class="rounded-md border border-[var(--p-content-border-color)] p-4 flex flex-col gap-3"
          >
            <!-- 卡頭 row1：批次序號 + 狀態 tag；右：編輯分批 -->
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-2 flex-wrap">
                <Tag :value="batchLabel(i)" severity="secondary" />
                <Tag :value="batchStatusBadge(b.status).label" :severity="batchStatusBadge(b.status).severity" />
              </div>
              <Button
                icon="pi pi-pencil" severity="secondary" text rounded size="small"
                v-tooltip.top="'編輯分批內容'" aria-label="編輯分批內容"
                @click="openSplitPage"
              />
            </div>

            <!-- 卡頭 row2：物流資訊 + 設定配送/修改 -->
            <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span v-if="b.carrier" class="inline-flex items-center gap-1 text-sm text-[var(--p-text-color)] min-w-0">
                <i class="pi pi-truck text-[var(--p-primary-color)] text-sm"></i>
                <span class="font-medium">{{ b.carrier.name }}</span>
                <template v-if="b.carrier.tracking"><span class="text-[var(--p-text-muted-color)]">·</span> 取號 {{ b.carrier.tracking }}</template>
                <span class="text-[var(--p-text-muted-color)]">·</span> {{ b.carrier.method }}
              </span>
              <span v-else class="inline-flex items-center gap-1 text-sm text-yellow-600 dark:text-yellow-400 min-w-0">
                <i class="pi pi-exclamation-circle text-sm"></i>
                尚未指派物流商
              </span>
              <Button
                :label="b.carrier ? '修改' : '設定配送'"
                icon="pi pi-cog" severity="secondary" variant="outlined" size="small" class="shrink-0"
                @click="openBatchConfig(i)"
              />
            </div>

            <!-- 卡身：左 商品明細 + 貨態 Timeline（55%）；右 出貨單備註（45%） -->
            <div class="grid grid-cols-1 md:grid-cols-[11fr_9fr] gap-4">
              <div class="flex flex-col gap-3 min-w-0">
                <div class="flex flex-col gap-2">
                  <span class="text-sm text-[var(--p-text-color)]">商品明細（{{ b.items.reduce((s, it) => s + it.qty, 0) }} 件）</span>
                  <div class="rounded-md bg-[var(--p-content-hover-background)] p-3 flex flex-col gap-1">
                    <div v-for="(it, j) in b.items" :key="j" class="flex items-center justify-between gap-2 text-sm">
                      <span class="text-[var(--p-text-color)] min-w-0">· {{ it.name }}</span>
                      <span class="text-[var(--p-text-muted-color)] shrink-0">× {{ it.qty }}</span>
                    </div>
                  </div>
                </div>
                <div class="flex flex-col gap-2">
                  <span class="text-xs text-[var(--p-text-muted-color)]">貨態</span>
                  <Timeline :value="batchSteps(b.status)" layout="horizontal" align="top" class="w-full">
                    <template #marker="{ item }">
                      <button
                        type="button"
                        v-tooltip.top="`切換為「${item.label}」`"
                        class="rounded-full inline-flex items-center justify-center cursor-pointer transition-transform hover:scale-110"
                        :style="{
                          width: item.isCurrent ? '32px' : '24px',
                          height: item.isCurrent ? '32px' : '24px',
                          background: item.isCurrent || item.isPast ? 'var(--p-primary-color)' : 'var(--p-content-hover-background)',
                          color: item.isCurrent || item.isPast ? '#fff' : 'var(--p-text-muted-color)',
                          border: item.isCurrent || item.isPast ? 'none' : '1px solid var(--p-content-border-color)',
                        }"
                        :aria-label="`切換為「${item.label}」`"
                        @click="setBatchStatus(b, item.key as BatchShippingStatus)"
                      >
                        <i :class="item.icon" class="text-xs"></i>
                      </button>
                    </template>
                    <template #content="{ item }">
                      <button
                        type="button"
                        class="flex flex-col items-center gap-1 pt-1 whitespace-nowrap cursor-pointer bg-transparent border-0 w-full"
                        :aria-label="`切換為「${item.label}」`"
                        @click="setBatchStatus(b, item.key as BatchShippingStatus)"
                      >
                        <span class="text-xs" :style="item.isCurrent ? 'color: var(--p-primary-color); font-weight: 600' : 'color: var(--p-text-muted-color)'">{{ item.label }}</span>
                        <span class="text-xs text-[var(--p-text-muted-color)]">—</span>
                      </button>
                    </template>
                    <template #connector>
                      <span class="block h-px w-full" style="background: var(--p-content-border-color)"></span>
                    </template>
                  </Timeline>
                </div>
              </div>

              <div class="flex flex-col gap-2">
                <span class="text-sm text-[var(--p-text-color)]">出貨單備註</span>
                <Textarea v-model="b.note" placeholder="輸入此批次的出貨單備註..." rows="4" class="w-full resize-none" />
              </div>
            </div>
          </div>
        </div>

        <!-- 整單層級出貨單備註 -->
        <div class="flex flex-col gap-2 pt-2 border-t border-[var(--p-content-border-color)]">
          <div class="flex items-center justify-between">
            <span class="text-sm text-[var(--p-text-color)]">出貨單備註（整單）</span>
            <label class="flex items-center gap-2 text-xs text-[var(--p-text-muted-color)] cursor-pointer">
              <Checkbox binary />
              <span>同步顯示於出貨單</span>
            </label>
          </div>
          <Textarea placeholder="輸入出貨相關備註...（將同步顯示於出貨單）" rows="4" class="w-full resize-none" />
        </div>
      </template>
    </div>

    <!-- 商品明細（單一扁平商品表 + 訂單總計） -->
    <div class="rounded-lg border border-[var(--p-content-border-color)] bg-[var(--p-content-background)] p-4 flex flex-col gap-4">
      <span class="text-sm font-bold text-[var(--p-text-color)]">商品明細</span>
      <DataTable :value="productRows" data-key="name" class="w-full"
        :pt="{ column: { headerCell: { style: 'white-space: nowrap;' } } }">
        <Column header="商品名稱" field="name" />
        <Column header="規格" field="spec" />
        <Column header="訂單來源" field="source" />
        <Column header="單價">
          <template #body="{ data }">{{ data.price.toLocaleString() }}</template>
        </Column>
        <Column header="數量">
          <template #body="{ data }">{{ data.qty }}</template>
        </Column>
        <Column header="小計">
          <template #body="{ data }">
            <span class="font-bold">{{ (data.price * data.qty).toLocaleString() }}</span>
          </template>
        </Column>
      </DataTable>

      <div class="flex items-start justify-end gap-4 pt-2">
        <div class="flex flex-col gap-2 text-sm min-w-[200px]">
          <div class="flex items-center justify-between">
            <span class="text-[var(--p-text-muted-color)]">商品總額</span>
            <span class="text-[var(--p-text-color)]">${{ subtotal.toLocaleString() }}</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-[var(--p-text-muted-color)]">運費</span>
            <span class="text-[var(--p-text-color)]">+${{ shippingFee }}</span>
          </div>
          <div v-if="couponDiscount > 0" class="flex items-center justify-between">
            <span class="text-[var(--p-text-muted-color)]">優惠券折抵</span>
            <span class="text-red-600 dark:text-red-400">-${{ couponDiscount.toLocaleString() }}</span>
          </div>
          <div v-if="pointsDiscount > 0" class="flex items-center justify-between">
            <span class="text-[var(--p-text-muted-color)]">紅利折抵</span>
            <span class="text-red-600 dark:text-red-400">-${{ pointsDiscount.toLocaleString() }}</span>
          </div>
          <div class="flex items-center justify-between pt-2 border-t border-[var(--p-content-border-color)]">
            <span class="font-medium text-[var(--p-text-color)]">訂單總計</span>
            <span class="text-base font-bold text-[var(--p-primary-color)]">${{ total.toLocaleString() }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 狀態切換確認彈窗：跟「設定配送」一致的 #header slot 樣式 -->
    <Dialog
      v-model:visible="statusSwitchDialogVisible"
      modal
      :draggable="false"
      :style="{ width: 'min(420px, calc(100vw - 32px))' }"
    >
      <template #header>
        <div class="flex items-center gap-3">
          <div class="size-10 shrink-0 rounded-full bg-[var(--p-primary-50)] flex items-center justify-center">
            <i class="pi pi-truck text-[var(--p-primary-color)] text-lg"></i>
          </div>
          <div class="flex flex-col gap-1">
            <span class="text-base font-bold text-[var(--p-text-color)]">切換產品貨態</span>
            <span class="text-xs text-[var(--p-text-muted-color)]">訂單 {{ order.orderNo }} · {{ order.buyerName }}</span>
          </div>
        </div>
      </template>
      <p class="text-sm text-[var(--p-text-color)] leading-snug">
        確定要將產品貨態由「{{ currentStatusLabel }}」切換為「{{ targetStatusLabel }}」嗎？
      </p>
      <template #footer>
        <Button label="取消" severity="secondary" variant="outlined" @click="statusSwitchDialogVisible = false" />
        <Button label="確定切換" @click="confirmStatusSwitch" />
      </template>
    </Dialog>

    <!-- 設定配送 Dialog（共用元件） -->
    <ShippingConfigDialog
      v-model:visible="shippingConfigDialogVisible"
      :order="order"
      @confirm="onShippingConfigConfirm"
    />

    <!-- 每批次「設定配送 / 修改」Dialog（分批版用） -->
    <ShippingConfigDialog
      v-model:visible="batchConfigDialogVisible"
      :order="batchConfigOrder"
      @confirm="onBatchConfigConfirm"
    />

    <!-- 開立發票 Dialog（共用元件） -->
    <IssueInvoiceDialog
      v-model:visible="issueInvoiceDialogVisible"
      :order="order"
      @confirm="onInvoiceIssued"
    />

    <!-- 出貨單列印 Dialog -->
    <ShippingListPrintDialog v-model:visible="printDialogVisible" :order="order" :scope="printSheetScope" @printed="onSheetPrinted" />

    <!-- 列印紀錄彈窗 -->
    <PrintHistoryDialog
      v-model:visible="printHistoryDialogVisible"
      :order-no="order.orderNo"
      :buyer-name="order.buyerName"
      :invoice-number="order.invoiceNumber"
    />
  </div>
</template>
