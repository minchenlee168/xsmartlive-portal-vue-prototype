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
import { orderStatusOf, orderStatusMeta, orderAbnormalReason } from '../orderStatus'

/**
 * 訂單列表 row expansion 展開內容。
 *
 * 三大區塊：
 * 1. 上方 4 卡（grid）：配送資訊 / 訂單來源 / 付款方式 / 發票資訊
 * 2. 出貨管理：動作按鈕列 + 配送物流狀態 + 出貨狀態 Timeline + 出貨單備註
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
  paymentStatus: 'paid' | 'unpaid' | 'refunded' | 'pending_refund' | 'paying' | 'payment_failed'
  /** 付款方式標籤(如「貨到付款」「信用卡一次付清」「ATM 轉帳」);決定配送方式可否變更 */
  paymentMethodLabel?: string
  shippingStatus: 'pending' | 'preparing' | 'shipping' | 'awaiting_receipt' | 'arrived' | 'completed' | 'cancelled' | 'delivery_abnormal'
  /** 配送異常原因(物流商回報);delivery_abnormal 時以 tooltip 顯示 */
  abnormalReason?: string
  carrierStatus: 'unconfigured' | 'configured'
  trackingStatus: string | null
  carrierName?: string
  orderSource: 'post' | 'live' | 'group' | 'shop'
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
  /** 發票狀態(六值);未設時依 invoiceNumber 推 issued / not_issued */
  invoiceStatus?: 'not_issued' | 'issued' | 'not_required' | 'voided' | 'issue_failed' | 'void_failed'
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
    pending:           { label: '待出貨', severity: 'warn' },
    preparing:         { label: '備貨中', severity: 'info' },
    shipping:          { label: '出貨中', severity: 'warn' },
    awaiting_receipt:  { label: '待收貨', severity: 'secondary' },
    arrived:           { label: '已送達', severity: 'success' },
    completed:         { label: '已完成', severity: 'success' },
    cancelled:         { label: '已取消', severity: 'danger' },
    delivery_abnormal: { label: '配送異常', severity: 'danger' },
  }
  return map[props.order.shippingStatus]
})
/** 付款狀態 badge（已退款＝取消已付款訂單、辦理退款後的付款終態） */
const paymentBadge = computed<{ label: string; severity: TagSeverity }>(() => {
  const s = props.order.paymentStatus
  if (s === 'paid') return { label: '已付款', severity: 'success' }
  if (s === 'paying') return { label: '付款中', severity: 'info' }
  if (s === 'payment_failed') return { label: '付款失敗', severity: 'danger' }
  if (s === 'pending_refund') return { label: '待退款', severity: 'warn' }
  if (s === 'refunded') return { label: '已退款', severity: 'secondary' }
  return { label: '待付款', severity: 'warn' }
})
/** 訂單狀態:依 orderStatus.ts 的貨態×付款矩陣推導(與列表頁一致) */
const orderStatusBadge = computed<{ label: string; severity: TagSeverity }>(() => orderStatusMeta(orderStatusOf(props.order)))
/** 異常處理時的原因說明(供 tooltip);非異常為 null */
const orderStatusReason = computed<string | null>(() => orderAbnormalReason(props.order))

/** 訂單來源 → 顯示文字 */
const ORDER_SOURCE_LABEL: Record<OrderRow['orderSource'], { short: string; full: string }> = {
  post:  { short: '貼文', full: '貼文收單' },
  live:  { short: '直播', full: '直播收單' },
  group: { short: '社團', full: '社團收單' },
  shop:  { short: '商城', full: '商城訂單' },
}
const sourceLabel = computed(() => ORDER_SOURCE_LABEL[props.order.orderSource].short)
const socialLabel = computed(() => {
  const map = { facebook: 'Facebook', line: 'LINE', instagram: 'Instagram', tiktok: 'TikTok', other: '其他' } as const
  return props.order.socialPlatform ? map[props.order.socialPlatform] : '—'
})
const sessionLabel = computed(() => {
  const map = { session_0620: '6-20 開箱直播', session_0622: '6-22 美妝直播', session_0624: '6-24 晚間生鮮直播', session_0625: '6-25 服飾團' } as const
  return props.order.sessionName ? map[props.order.sessionName] : '—'
})
/** 訂單來源卡：直播訂單 / 商城訂單 */
const orderSourceCardLabel = computed(() => ORDER_SOURCE_LABEL[props.order.orderSource].full)
/** 訂單狀態(整體生命週期)→ 依出貨狀態收斂,與列表頁「訂單狀態」欄一致 */

/** 出貨狀態 5 階段（用 PrimeVue Timeline 水平顯示） */
interface StepItem { key: string; label: string; isCurrent: boolean; isPast: boolean; time: string; icon: string }
const progressSteps = computed<StepItem[]>(() => {
  const order: Array<{ key: OrderRow['shippingStatus']; label: string; icon: string }> = [
    { key: 'pending',    label: '待出貨', icon: 'pi pi-clock' },
    { key: 'preparing',  label: '備貨中', icon: 'pi pi-box' },
    { key: 'shipping',   label: '已出貨', icon: 'pi pi-truck' },
    { key: 'arrived',    label: '已送達', icon: 'pi pi-map-marker' },
    { key: 'completed',  label: '已完成', icon: 'pi pi-check-circle' },
  ]
  // 終止狀態屬「已完成之後」——Timeline 比照已完成呈現滿條，並把最後一站改成對應終止標記(配送異常)
  const LAST_STEP_OVERRIDE: Partial<Record<OrderRow['shippingStatus'], { label: string; icon: string }>> = {
    delivery_abnormal: { label: '配送異常', icon: 'pi pi-exclamation-triangle' },
  }
  const override = LAST_STEP_OVERRIDE[props.order.shippingStatus]
  // 任何終止狀態(配送異常)都視同走到最後一站
  const effectiveStatus = override ? 'completed' : props.order.shippingStatus
  const currentIdx = order.findIndex(s => s.key === effectiveStatus)
  const lastIdx = order.length - 1
  return order.map((s, i) => ({
    key: s.key,
    label: i === lastIdx && override ? override.label : s.label,
    icon: i === lastIdx && override ? override.icon : s.icon,
    isCurrent: i === currentIdx,
    isPast: i < currentIdx,
    time: i === currentIdx ? props.order.createdAt.slice(5, 10) + ' ' + props.order.createdAt.slice(11, 16) : '—',
  }))
})

const shippingFee = 120
const couponDiscount = computed(() => props.order.couponDiscount ?? 0)
const pointsDiscount = computed(() => props.order.pointsDiscount ?? 0)
/**
 * 反推商品總額,讓「商品總額 + 運費 - 折抵 = 訂單總計 = 應付金額(order.amount)」對得起來。
 * 訂單總計即 order.amount,與付款方式卡的「應付金額」一致。
 */
const subtotal = computed(() => Math.max(0, props.order.amount - shippingFee + couponDiscount.value + pointsDiscount.value))
const total = computed(() => props.order.amount)

/** 商品明細：prototype mock 一筆,小計＝商品總額(subtotal),單價由小計 ÷ 數量反推 */
interface ProductRow { name: string; spec: string; source: string; price: number; qty: number; lineTotal: number }
const productRows = computed<ProductRow[]>(() => {
  const qty = Math.max(1, props.order.itemCount)
  return [{
    name: props.order.cartTag.label === '服飾專區' ? '韓版寬鬆連帽外套（米白）' : '示意商品',
    spec: props.order.cartTag.label === '服飾專區' ? '尺寸 M / 米白色內裡' : '預設規格',
    source: sourceLabel.value,
    price: Math.round(subtotal.value / qty),
    qty: props.order.itemCount,
    lineTotal: subtotal.value,
  }]
})

/** 配送資訊卡整卡編輯：點筆 icon → 配送方式 Select + 姓名/電話/地址 InputText；按打勾 commit */
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

/** 付款方式卡編輯:僅「付款狀態」變 Select 可改,「付款方式」固定不可更改。付款狀態選項比照進階篩選的六種。 */
const paymentStatusOptions: Array<{ label: string; value: OrderRow['paymentStatus'] }> = [
  { label: '待付款',   value: 'unpaid' },
  { label: '付款中',   value: 'paying' },
  { label: '已付款',   value: 'paid' },
  { label: '付款失敗', value: 'payment_failed' },
  { label: '待退款',   value: 'pending_refund' },
  { label: '已退款',   value: 'refunded' },
]
const editingPayment = ref(false)
const editPaymentStatus = ref<OrderRow['paymentStatus']>(props.order.paymentStatus)
/** 付款方式:直接讀訂單資料;未帶欄位者沿用預設「信用卡一次付清」。待出貨訂單可改(見 canEditPaymentMethod) */
const paymentMethodLabel = computed(() => props.order.paymentMethodLabel ?? '信用卡一次付清')
/** 付款方式選項(以中文 label 為值,對齊訂單 paymentMethodLabel) */
const paymentMethodOptions = [
  '信用卡一次付清', 'ATM 轉帳', '轉帳匯款', '貨到付款',
  'LINE Pay', 'Apple Pay', 'iPASS MONEY', '超商代碼', '數位簽', '取貨現場付款',
].map(label => ({ label }))
/** 編輯中的付款方式(待出貨可改) */
const editPaymentMethod = ref<string>(paymentMethodLabel.value)
/** 待出貨訂單才可調整付款方式;其餘鎖定 */
const canEditPaymentMethod = computed(() => props.order.shippingStatus === 'pending')
/** ATM 轉帳對帳末 5 碼（mock：取訂單編號數字末 5 碼） */
const atmLast5 = computed(() => props.order.orderNo.replace(/\D/g, '').slice(-5).padStart(5, '0'))
const isAtmTransfer = computed(() => paymentMethodLabel.value === 'ATM 轉帳')
/** 是否為貨到付款 */
const isCodOrder = computed(() => paymentMethodLabel.value === '貨到付款')
/**
 * 可否於配送資訊變更「配送方式」:
 * - 貨到付款:尚未依線上金流計價,可改
 * - 待出貨:貨還沒出,仍可調整配送方式
 * 其餘(已依原配送方式完成計價且已進入出貨流程)不可改,需取消訂單重新下單。
 */
const canEditShippingMethod = computed(() => isCodOrder.value || props.order.shippingStatus === 'pending')
/** 結帳編號（mock：以訂單編號數字衍生） */
const checkoutNo = computed(() => `CHK-${props.order.orderNo.replace(/\D/g, '')}`)

// 切換不同訂單時同步初始值
watch(() => props.order.id, () => {
  editShippingMethod.value = props.order.shippingMethod
  editBuyerName.value = props.order.buyerName
  editBuyerPhone.value = props.order.buyerPhone
  shippingAddress.value = '台北市中山區南京東路二段50號'
  editingShipping.value = false
  editPaymentStatus.value = props.order.paymentStatus
  editPaymentMethod.value = props.order.paymentMethodLabel ?? '信用卡一次付清'
  editingPayment.value = false
})

function commitShipping(): void {
  // 僅「貨到付款 / 待出貨」可更改配送方式;其餘維持原方式(已依原方式計價)
  if (canEditShippingMethod.value) props.order.shippingMethod = editShippingMethod.value
  props.order.buyerName = editBuyerName.value
  props.order.buyerPhone = editBuyerPhone.value
  editingShipping.value = false
}
function commitPayment(): void {
  props.order.paymentStatus = editPaymentStatus.value
  // 僅待出貨可調整付款方式
  if (canEditPaymentMethod.value) props.order.paymentMethodLabel = editPaymentMethod.value
  editingPayment.value = false
}
/**
 * 收攏所有「還在編輯中」的卡片:供父層在按「儲存」前呼叫,
 * 讓使用者忘記按卡片打勾的欄位編輯也一併寫入副本,不再被靜默丟棄。
 */
function flushEdits(): void {
  if (editingShipping.value) commitShipping()
  if (editingPayment.value) commitPayment()
}
defineExpose({ flushEdits })

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
const currentStatusLabel = computed(() => STATUS_FLOW.find(s => s.key === props.order.shippingStatus)?.label ?? shippingBadge.value.label)
const targetStatusLabel = computed(() => STATUS_FLOW.find(s => s.key === statusSwitchTarget.value)?.label ?? '')
const nextStatusInfo = computed(() => {
  const idx = STATUS_FLOW.findIndex(s => s.key === props.order.shippingStatus)
  if (idx < 0 || idx >= STATUS_FLOW.length - 1) return null
  return STATUS_FLOW[idx + 1]
})
/** 「狀態切換」按鈕：目標 = 下一階段;系統管控物流已進入出貨後階段時鎖定,改跳提示 */
function openStatusSwitchDialog(): void {
  if (!nextStatusInfo.value) return
  if (manualSwitchLocked.value) {
    lockedSwitchDialogVisible.value = true
    return
  }
  statusSwitchTarget.value = nextStatusInfo.value.key
  statusSwitchDialogVisible.value = true
}
/**
 * 系統管控物流(有串接 API 自動取號)。自取 / 商家自建(郵局)為手動,商家可自行切狀態。
 */
const isSystemCarrier = computed<boolean>(() => {
  const name = props.order.carrierName ?? ''
  if (name.includes('自取') || name.includes('商家自建') || name.includes('郵局')) return false
  return props.order.carrierStatus === 'configured'
})
function stageIndexOf(s: OrderRow['shippingStatus']): number {
  return STATUS_FLOW.findIndex(x => x.key === s)
}
/** 出貨後階段:已出貨(含)之後 */
function isPostShipStage(s: OrderRow['shippingStatus']): boolean {
  return stageIndexOf(s) >= stageIndexOf('shipping')
}
/** 無法手動切換狀態:系統管控物流 + 目前已進入出貨後階段 → 貨態全由系統驅動,不可手動切換(任一方向) */
const lockedSwitchDialogVisible = ref(false)
const manualSwitchLocked = computed<boolean>(() =>
  isSystemCarrier.value && isPostShipStage(props.order.shippingStatus),
)
/** 點 stepper 任一階段：目標 = 該階段（同狀態則不動） */
function onStepClick(key: OrderRow['shippingStatus']): void {
  const current = props.order.shippingStatus
  if (key === current) return
  if (manualSwitchLocked.value) {
    lockedSwitchDialogVisible.value = true
    return
  }
  statusSwitchTarget.value = key
  statusSwitchDialogVisible.value = true
}
function confirmStatusSwitch(): void {
  if (!statusSwitchTarget.value) return
  props.order.shippingStatus = statusSwitchTarget.value
  statusSwitchDialogVisible.value = false
  statusSwitchTarget.value = null
}

/**
 * 終止狀態（已完成）：僅「已送達」之後顯示於出貨狀態下方,供商家手動標記訂單已完成。
 */
const showTerminalStatus = computed(() =>
  (['arrived', 'completed'] as OrderRow['shippingStatus'][]).includes(props.order.shippingStatus),
)
/** 終止狀態目前選取：completed / null（已送達但尚未標記）——供 chip 選中樣式與 aria-pressed 用 */
type TerminalTarget = 'completed'
const terminalSelection = computed<TerminalTarget | null>(() =>
  props.order.shippingStatus === 'completed' ? 'completed' : null,
)
function setTerminalStatus(target: TerminalTarget): void {
  if (props.order.shippingStatus === target) return
  props.order.shippingStatus = target
  toast.add({
    severity: 'success',
    summary: `訂單 ${props.order.orderNo} 已更新為「已完成」`,
    life: 2000,
  })
}

/** 設定配送 Dialog：委派給 ShippingConfigDialog 共用元件（與訂單列表表格共用） */
const shippingConfigDialogVisible = ref(false)
function onShippingConfigConfirm(payload: { carrierName: string; method: string; trackingNo: string | null }): void {
  props.order.carrierStatus = 'configured'
  props.order.carrierName = payload.carrierName
  props.order.trackingStatus = payload.trackingNo
  // 已設定配送(取號)後:待出貨 → 備貨中(依 UAT 規範,取到號就推進到備貨中)
  if (props.order.shippingStatus === 'pending') {
    props.order.shippingStatus = 'preparing'
    toast.add({ severity: 'info', summary: `訂單 ${props.order.orderNo} 已設定配送,貨態推進為「備貨中」`, life: 2200 })
  }
}

// ─────────────────────────────────────────────────────────────
// 分批出貨版「出貨管理」：訂單已分批時（共享批次狀態有資料）改渲染分批版
// ─────────────────────────────────────────────────────────────
const { getBatches, setBatches } = useShippingBatches()
const batches = computed<OrderBatch[]>(() => getBatches(props.order.orderNo))
// 分批出貨功能先隱藏:一律走未分批版(改回 batches.value.length > 0 即恢復)
const isBatched = computed<boolean>(() => false && batches.value.length > 0)

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
  props.order.invoiceStatus = 'issued'
}

// ── 發票資訊卡:發票狀態可編輯,下拉只開放從目前狀態走得通的值 ──
type InvoiceStatus = NonNullable<OrderRow['invoiceStatus']>
const INVOICE_STATUS_OPTIONS: Array<{ label: string; value: InvoiceStatus }> = [
  { label: '尚未開立', value: 'not_issued' },
  { label: '已開立',   value: 'issued' },
  { label: '不需開立', value: 'not_required' },
  { label: '已作廢',   value: 'voided' },
  { label: '開立失敗', value: 'issue_failed' },
  { label: '作廢失敗', value: 'void_failed' },
]
/** mock 沒設 invoiceStatus 時,依 invoiceNumber 推「已開立 / 尚未開立」 */
const invoiceStatusValue = computed<InvoiceStatus>(() =>
  props.order.invoiceStatus ?? (props.order.invoiceNumber ? 'issued' : 'not_issued'),
)
function invoiceStatusMeta(s: InvoiceStatus): { label: string; severity: TagSeverity } {
  const map: Record<InvoiceStatus, { label: string; severity: TagSeverity }> = {
    not_issued:   { label: '尚未開立', severity: 'warn' },
    issued:       { label: '已開立',   severity: 'success' },
    not_required: { label: '不需開立', severity: 'secondary' },
    voided:       { label: '已作廢',   severity: 'danger' },
    issue_failed: { label: '開立失敗', severity: 'danger' },
    void_failed:  { label: '作廢失敗', severity: 'danger' },
  }
  return map[s]
}
/** 從目前狀態走得通的目標(含自己);開立後只能作廢、作廢後可重開,其餘依規範。 */
function invoiceReachable(s: InvoiceStatus): InvoiceStatus[] {
  const map: Record<InvoiceStatus, InvoiceStatus[]> = {
    issued:       ['issued', 'voided'],
    voided:       ['voided', 'issued'],
    not_issued:   ['not_issued', 'issued', 'not_required'],
    not_required: ['not_required', 'issued'],
    issue_failed: ['issue_failed', 'issued', 'not_required'],
    void_failed:  ['void_failed', 'voided', 'issued'],
  }
  return map[s]
}
const editingInvoice = ref(false)
/** 進入編輯時記下原始狀態:供「(目前)」標記與可切換規則判斷(選了新值也不會跟著跑) */
const invoiceStatusBeforeEdit = ref<InvoiceStatus>('issued')
/**
 * Select 直接綁定副本:選了就即時寫入(彈窗底部「儲存」才寫回列表)。
 * 因此就算沒按卡片上的打勾,底部「儲存」也能捕捉到這次變更並同步到 table。
 */
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
/** 下拉中不可選項目的原因說明(顯示於選項後方灰字) */
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
  // 資料已於 Select 選取當下寫入副本,這裡只收合編輯模式並提示
  editingInvoice.value = false
  toast.add({ severity: 'success', summary: `訂單 ${props.order.orderNo} 發票狀態已更新為「${invoiceStatusMeta(invoiceStatusValue.value).label}」`, life: 2000 })
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
        </div>

        <!-- 檢視模式 -->
        <template v-if="!editingShipping">
          <div class="flex items-center justify-between text-sm">
            <span class="text-[var(--p-text-muted-color)]">出貨狀態</span>
            <!-- 配送異常:tag 內文字後加驚嘆號,hover 顯示物流商回報的異常原因 -->
            <Tag
              v-if="order.shippingStatus === 'delivery_abnormal'"
              :severity="shippingBadge.severity"
              class="cursor-help"
              v-tooltip.top="order.abnormalReason ?? '物流回報配送異常'"
            >
              <span class="inline-flex items-center gap-1">
                {{ shippingBadge.label }}
                <i class="pi pi-exclamation-circle text-xs"></i>
              </span>
            </Tag>
            <Tag v-else :value="shippingBadge.label" :severity="shippingBadge.severity" />
          </div>
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

        <!-- 編輯模式：配送方式（僅貨到付款可改）+ 姓名/電話/地址 InputText（label 常駐可見） -->
        <template v-else>
          <div class="flex flex-col gap-1">
            <label class="text-xs text-[var(--p-text-muted-color)]">配送方式</label>
            <!-- 貨到付款 或 待出貨:可更改配送方式 -->
            <Select
              v-if="canEditShippingMethod"
              v-model="editShippingMethod"
              :options="shippingMethodOptions"
              option-label="label"
              option-value="value"
              class="w-full"
              size="small"
            />
            <!-- 其他(已計價且已進入出貨流程):不可更改;需變更請取消訂單重新下單 -->
            <template v-else>
              <div class="flex items-center gap-2 text-sm text-[var(--p-text-color)]">
                <i class="pi pi-truck text-sm text-[var(--p-text-muted-color)]"></i>
                {{ order.shippingMethod }}
              </div>
              <p class="text-xs text-[var(--p-text-muted-color)] leading-relaxed">
                此訂單已依原配送方式完成計價,配送方式無法變更。如需變更,請「取消訂單」後重新下單(地址仍可修改)。
              </p>
            </template>
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

      <!-- 訂單來源：訂單狀態 / 訂單來源 / 社群平台 / 多購物車 / 場次名稱 -->
      <div class="rounded-lg border border-[var(--p-content-border-color)] bg-[var(--p-content-background)] p-4 flex flex-col gap-2">
        <span class="text-sm font-bold text-[var(--p-text-color)]">訂單來源</span>
        <div class="flex items-center justify-between text-sm">
          <span class="text-[var(--p-text-muted-color)]">訂單狀態</span>
          <!-- 異常處理:tag 內文字後加驚嘆號,hover 顯示異常原因(配送異常 or 不該發生的組合) -->
          <Tag
            v-if="orderStatusReason"
            :severity="orderStatusBadge.severity"
            class="cursor-help"
            v-tooltip.top="orderStatusReason"
          >
            <span class="inline-flex items-center gap-1">
              {{ orderStatusBadge.label }}
              <i class="pi pi-exclamation-circle text-xs"></i>
            </span>
          </Tag>
          <Tag v-else :value="orderStatusBadge.label" :severity="orderStatusBadge.severity" />
        </div>
        <div class="flex items-center justify-between text-sm">
          <span class="text-[var(--p-text-muted-color)]">訂單來源</span>
          <span class="font-medium text-[var(--p-text-color)]">{{ orderSourceCardLabel }}</span>
        </div>
        <div class="flex items-center justify-between text-sm">
          <span class="text-[var(--p-text-muted-color)]">社群平台</span>
          <span class="text-[var(--p-text-color)]">{{ socialLabel }}</span>
        </div>
        <div class="flex items-center justify-between text-sm">
          <span class="text-[var(--p-text-muted-color)]">多購物車</span>
          <span
            class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
            :style="{ background: order.cartTag.bg, color: order.cartTag.color }"
          >{{ order.cartTag.label }}</span>
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
            :value="paymentBadge.label"
            :severity="paymentBadge.severity"
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
        <!-- 結帳編號:顯示於付款狀態下方 -->
        <div class="flex items-center justify-between text-sm">
          <span class="text-[var(--p-text-muted-color)]">結帳編號</span>
          <span class="text-[var(--p-text-color)]">{{ checkoutNo }}</span>
        </div>
        <!-- 付款方式:待出貨可改(Select),其餘僅供檢視 -->
        <div class="flex items-center justify-between text-sm">
          <span class="text-[var(--p-text-muted-color)]">付款方式</span>
          <span v-if="!(editingPayment && canEditPaymentMethod)" class="text-[var(--p-text-color)]">
            {{ paymentMethodLabel }}<template v-if="isAtmTransfer">（末 5 碼：<span class="font-bold text-[var(--p-primary-color)]">{{ atmLast5 }}</span>）</template>
          </span>
          <Select
            v-else
            v-model="editPaymentMethod"
            :options="paymentMethodOptions"
            option-label="label"
            option-value="label"
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

      <!-- 發票資訊：發票狀態可編輯(下拉只開放走得通的值,如已開立只能改已作廢) -->
      <div class="rounded-lg border border-[var(--p-content-border-color)] bg-[var(--p-content-background)] p-4 flex flex-col gap-2">
        <!-- 標題 + 編輯鉛筆(比照配送資訊 / 付款方式,編輯入口放標題旁) -->
        <div class="flex items-center gap-2">
          <span class="text-sm font-bold text-[var(--p-text-color)]">發票資訊</span>
          <Button v-if="!editingInvoice" v-tooltip.top="'編輯'" aria-label="編輯發票資訊" icon="pi pi-pencil" severity="secondary" variant="text" size="small" rounded @click="startEditInvoice" />
          <Button v-else v-tooltip.top="'確認'" aria-label="確認發票資訊" icon="pi pi-check" severity="secondary" variant="text" size="small" rounded @click="commitInvoice" />
        </div>
        <div class="flex items-center justify-between text-sm">
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

      <!-- ── 未分批：原本的整單出貨管理（動作列 + 配送/發票 + 出貨狀態 + 備註） ── -->
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
          v-tooltip.top="manualSwitchLocked ? '系統管控物流出貨後由系統驅動,無法手動切換' : undefined"
          :disabled="!nextStatusInfo || manualSwitchLocked"
          @click="openStatusSwitchDialog"
        />
        <!-- 分批出貨:先隱藏(功能暫緩) -->
        <Button v-if="false" label="分批出貨" icon="pi pi-th-large" severity="secondary" variant="outlined" size="small" @click="openSplitPage" />
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

      <!-- 左：配送物流 / 發票 / 出貨狀態 Timeline（較寬）；右：出貨單備註（較窄，不擠壓 timeline） -->
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

          <!-- 出貨狀態 Timeline（左欄內；發票已移到上方發票資訊卡,此處不再顯示） -->
          <div class="flex flex-col gap-2">
            <span class="text-sm text-[var(--p-text-muted-color)]">出貨狀態</span>
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

          <!-- 終止狀態（已完成）：僅已送達之後顯示；與上方進度用 hairline 分隔，避免被誤讀成第 6 站 -->
          <div
            v-if="showTerminalStatus"
            class="flex items-center gap-2 pt-3 border-t border-[var(--p-content-border-color)]"
            role="group"
            aria-label="終止狀態"
          >
            <span class="text-[var(--p-text-muted-color)] text-sm w-[80px] shrink-0">終止狀態</span>
            <!-- 選中=實心 secondary；未選=secondary outlined，靠實心/外框區分而非借用 success 綠 -->
            <Button
              label="已完成"
              icon="pi pi-check"
              size="small"
              severity="secondary"
              :variant="terminalSelection === 'completed' ? undefined : 'outlined'"
              :aria-pressed="terminalSelection === 'completed'"
              aria-label="將終止狀態設為已完成"
              @click="setTerminalStatus('completed')"
            />
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
            <span class="font-bold">{{ data.lineTotal.toLocaleString() }}</span>
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

    <!-- 無法手動切換狀態:系統管控物流已進入出貨後階段,不可手動往回切 -->
    <Dialog
      v-model:visible="lockedSwitchDialogVisible"
      modal
      :draggable="false"
      :style="{ width: 'min(400px, calc(100vw - 32px))' }"
    >
      <template #header>
        <div class="flex items-center gap-3">
          <div class="size-10 shrink-0 rounded-full bg-yellow-100 dark:bg-yellow-950/40 flex items-center justify-center">
            <i class="pi pi-lock text-yellow-600 dark:text-yellow-400 text-lg"></i>
          </div>
          <span class="text-base font-bold text-[var(--p-text-color)]">無法手動切換狀態</span>
        </div>
      </template>
      <div class="flex flex-col gap-2">
        <p class="text-sm text-[var(--p-text-color)] leading-snug">
          此訂單由 <span class="font-medium">{{ order.carrierName }}</span> 系統管控,目前狀態「<span class="font-medium text-yellow-600 dark:text-yellow-400">{{ currentStatusLabel }}</span>」屬出貨後階段,無法手動切換。
        </p>
        <p class="text-xs text-[var(--p-text-muted-color)] leading-snug">
          若需修改貨態,請聯絡物流商或等待系統更新。
        </p>
      </div>
      <template #footer>
        <Button label="我知道了" @click="lockedSwitchDialogVisible = false" />
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
