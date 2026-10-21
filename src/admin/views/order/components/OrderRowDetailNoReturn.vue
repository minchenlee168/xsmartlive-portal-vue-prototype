<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import type { MenuItem } from 'primevue/menuitem'
import ShippingConfigDialog from './ShippingConfigDialog.vue'
import ShippingAddressFields from './ShippingAddressFields.vue'
import IssueInvoiceDialog from './IssueInvoiceDialog.vue'
import ShippingListPrintDialog from './ShippingListPrintDialog.vue'
import { useShippingBatches, type BatchShippingStatus, type OrderBatch } from '../composables/useShippingBatches'
import { usePrintLog } from '../composables/usePrintLog'
import PrintHistoryDialog from './PrintHistoryDialog.vue'
import OrderMergeRecordPanel from './OrderMergeRecordPanel.vue'
import OrderSourceCard from './OrderSourceCard.vue'
import OrderInvoiceCard from './OrderInvoiceCard.vue'
import OrderItemsSection from './OrderItemsSection.vue'
import type { OrderRow, ProductRow } from '../orderTypes'
import { ORDER_SOURCE_LABEL, paymentBadgeOf } from '../orderLabels'

/**
 * 訂單列表 row expansion 展開內容。
 *
 * 三大區塊：
 * 1. 上方 4 卡（grid）：配送資訊 / 訂單來源 / 付款方式 / 發票資訊
 * 2. 出貨管理：動作按鈕列 + 配送物流狀態 + 出貨狀態 Timeline + 出貨單備註
 * 3. 商品明細 table + 訂單總計（運費 / 商品總額 / 總計）
 */

interface Props {
  order: OrderRow
  /**
   * 以「原始訂單檢視」模式顯示(合併紀錄面板點來源列另開時用):
   * 隱藏出貨管理區,且配送資訊 / 付款方式 / 發票資訊三卡鎖為唯讀(已併入合併單,不可再單獨調整)。
   */
  hideShipping?: boolean
}
const props = defineProps<Props>()
const emit = defineEmits<{
  /** 觸發分批出貨作業（父層負責關閉詳情彈窗 + 開啟分批出貨彈窗） */
  'open-split-page': [orderId: string]
  /** 點合併紀錄面板的原始訂單列 → 父層另開該原始訂單檢視彈窗 */
  'open-source-order': [orderNo: string]
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
const paymentBadge = computed<{ label: string; severity: TagSeverity }>(() => paymentBadgeOf(props.order.paymentStatus))
/** 點原始訂單列 → 通知父層另開該原始訂單檢視彈窗（合併紀錄面板轉拋） */
function openSourceOrder(orderNo: string): void {
  emit('open-source-order', orderNo)
}
/** 合併訂單:子訂單付款方式分歧 → 付款方式卡顯示「多種付款方式」 */
const isMixedMergePayment = computed(
  () => !!props.order.mergeRecord && new Set(props.order.mergeRecord.sources.map((s) => s.paymentMethodLabel ?? '—')).size > 1,
)
/** 訂單來源短標籤（商品明細列的「訂單來源」欄用） */
const sourceLabel = computed(() => ORDER_SOURCE_LABEL[props.order.orderSource].short)

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

const SHIP_PER_ORDER = 120
/** 合併單的來源筆數(非合併單視為 1 筆) */
const shipUnitCount = computed(() => props.order.mergeRecord?.sources.length ?? 1)
/** 運費「本來」總額：合併單＝各來源原始運費加總(N×120)；單筆＝120 */
const shippingFee = computed(() => shipUnitCount.value * SHIP_PER_ORDER)
const couponDiscount = computed(() => props.order.couponDiscount ?? 0)
const pointsDiscount = computed(() => props.order.pointsDiscount ?? 0)
/**
 * 期間首購後免運折抵：
 * - 合併單：第一筆(首購)收運費、其餘免運 → 折抵 =(來源筆數 − 1)×120
 * - 單筆：首購(promoFirstPurchase)要付運費不折抵；之後的訂單才免運 → 折抵 120
 */
const freeShipDiscount = computed(() => {
  if (!props.order.promoFirstFreeShipping) return 0
  if (props.order.mergeRecord) return Math.max(0, shipUnitCount.value - 1) * SHIP_PER_ORDER
  return props.order.promoFirstPurchase ? 0 : SHIP_PER_ORDER
})
/**
 * 反推商品總額,讓「商品總額 + 運費 - 折抵 = 訂單總計 = 應付金額(order.amount)」對得起來。
 * 訂單總計即 order.amount,與付款方式卡的「應付金額」一致。
 */
const subtotal = computed(() => Math.max(0, props.order.amount - shippingFee.value + couponDiscount.value + pointsDiscount.value + freeShipDiscount.value))
const total = computed(() => props.order.amount)

/** 商品明細：prototype mock 一筆,小計＝商品總額(subtotal),單價由小計 ÷ 數量反推 */
const productRows = computed<ProductRow[]>(() => {
  // 合併訂單:列出各原始訂單本來的商品(名稱／規格／訂單來源皆依原始訂單呈現)
  if (props.order.mergeRecord) {
    return props.order.mergeRecord.sources.map((s) => {
      const [namePart, qtyPart] = (s.productSummary ?? '').split(/\s*×\s*/)
      const qty = Number(qtyPart) || s.itemCount || 1
      const lineTotal = s.productAmount ?? s.amount
      // 商品摘要括號內為規格(如「純棉素色短T(黑)」→ 名稱「純棉素色短T」、規格「黑」)
      const variant = (namePart ?? '').match(/^(.*?)\s*[（(]([^（）()]+)[）)]\s*$/)
      return {
        name: (variant ? variant[1] : namePart ?? '').trim() || '商品',
        spec: variant ? variant[2].trim() : '—',
        source: ORDER_SOURCE_LABEL[s.orderSource]?.short ?? '—',
        price: qty > 0 ? Math.round(lineTotal / qty) : lineTotal,
        qty,
        lineTotal,
      }
    })
  }
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
const editBuyerPhone = ref<string>(props.order.buyerPhone.replace(/-/g, ''))
/** 收件人電話國碼：依國別自動帶入（臺灣 +886 / 馬來西亞 +60 / 新加坡 +65 / 菲律賓 +63） */
const PHONE_CODES = ['+886', '+60', '+65', '+63']
const COUNTRY_PHONE_CODE: Record<string, string> = { 臺灣: '+886', 馬來西亞: '+60', 新加坡: '+65', 菲律賓: '+63' }
const phoneCode = ref<string>('+886')
function onAddressCountry(country: string): void {
  phoneCode.value = COUNTRY_PHONE_CODE[country] ?? phoneCode.value
}
/** 收件地址字串(prototype)：編輯時由 ShippingAddressFields 透過 v-model 更新；檢視沿用此值 */
const shippingAddress = ref<string>('臺北市中山區南京東路二段50號')
/** 是否取貨門市配送(超商配送 / 自取):地址存門市,顯示為「門市名 / 地址」 */
const isStorePickup = computed(() => /超商|門市|交貨便|店到店|自取/.test(props.order.shippingMethod ?? ''))
/**
 * 配送資訊檢視用地址:優先用訂單真實收件地址,未帶時沿用 prototype 預設。
 * 超商配送 / 自取的門市存為「門市名（地址）」,顯示時改為「門市名 / 地址」(對齊設計)。
 */
const shippingAddressDisplay = computed<string>(() => {
  const addr = props.order.receiverAddress ?? shippingAddress.value
  if (isStorePickup.value) return addr.replace(/（(.+?)）\s*$/, ' / $1')
  return addr
})
/** 自取:商家自有取貨門市選項 */
const pickupStoreOptions = [
  { label: 'MIFFY 信義門市 — 台北市信義區忠孝東路四段45號', value: 'xinyi' },
  { label: 'MIFFY 西門門市 — 台北市萬華區漢中街80號',       value: 'ximen' },
  { label: 'MIFFY 板橋門市 — 新北市板橋區文化路一段25號',    value: 'banqiao' },
]
/** 自取:選定的取貨門市 */
const pickupStore = ref<string | null>(null)
/** 超商配送:取貨門市（門市名稱／地址,透過「選擇門市」電子地圖帶入） */
const cvsStore = ref<string>('')
/** 配送方式是否已被改動（相對原訂單）→ 需重新填寫取貨門市 */
const shippingMethodChanged = computed(
  () => editShippingMethod.value !== props.order.shippingMethod,
)
/** prototype:模擬超商電子地圖選店,帶入一筆門市 */
function pickCvsStore(): void {
  cvsStore.value = '7-ELEVEN 忠孝門市（台北市大安區忠孝東路四段181號）'
}

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
 * 可否於配送資訊變更「配送方式」:僅貨到付款訂單可改(尚未依線上金流計價)。
 * 其他付款方式已依原配送方式完成計價,需變更請取消訂單重新下單;地址仍可修改。
 */
const canEditShippingMethod = computed(() => isCodOrder.value)
/**
 * 配送資訊（收件人～詳細收件地址）可否編輯:
 * 僅「待出貨」可改;一旦推進到備貨中以後(含已出貨/已送達/已完成等),一律鎖定不可修改。
 */
const canEditShippingInfo = computed(() => props.order.shippingStatus === 'pending')
/** 結帳編號（mock：以訂單編號數字衍生） */
const checkoutNo = computed(() => `CHK-${props.order.orderNo.replace(/\D/g, '')}`)
/** 是否有結帳編號:貨到付款 / 取貨現場付款(自取)走線下收款,無線上結帳編號 */
const hasCheckoutNo = computed(() => {
  const m = paymentMethodLabel.value ?? ''
  return !(m.includes('貨到付款') || m.includes('現場付款') || m.includes('自取'))
})

// 切換不同訂單時同步初始值
watch(() => props.order.id, () => {
  editShippingMethod.value = props.order.shippingMethod
  editBuyerName.value = props.order.buyerName
  editBuyerPhone.value = props.order.buyerPhone.replace(/-/g, '')
  phoneCode.value = '+886'
  shippingAddress.value = '臺北市中山區南京東路二段50號'
  pickupStore.value = null
  cvsStore.value = ''
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
    showLockedSwitch('訂單', props.order.carrierName ?? '', currentStatusLabel.value)
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
/** 鎖定提示彈窗的內容(整單 / 批次共用) */
const lockedSwitchInfo = ref<{ unit: string; carrierName: string; statusLabel: string }>({
  unit: '訂單', carrierName: '', statusLabel: '',
})
function showLockedSwitch(unit: string, carrierName: string, statusLabel: string): void {
  lockedSwitchInfo.value = { unit, carrierName, statusLabel }
  lockedSwitchDialogVisible.value = true
}
const manualSwitchLocked = computed<boolean>(() =>
  isSystemCarrier.value && isPostShipStage(props.order.shippingStatus),
)
/** 取消處理方式 → 顯示文字(對齊取消訂單彈窗的選項文案) */
const cancelMethodLabel = computed<string>(() =>
  props.order.cancelMethod === 'return' ? '退回重新結帳' : '取消不退回購物車',
)
/** 配送 / 發票資訊唯讀(不可編輯、不顯示發票狀態):原始訂單檢視 或 已取消訂單 */
const detailReadOnly = computed<boolean>(() => props.hideShipping || props.order.shippingStatus === 'cancelled')
/** 點 stepper 任一階段：目標 = 該階段（同狀態則不動） */
function onStepClick(key: OrderRow['shippingStatus']): void {
  const current = props.order.shippingStatus
  if (key === current) return
  if (manualSwitchLocked.value) {
    showLockedSwitch('訂單', props.order.carrierName ?? '', currentStatusLabel.value)
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

// 「已完成」不再另設終止狀態捷徑:改由上方進度 Timeline 最後一站或「狀態切換」鈕達成
// (兩者都會跳二次確認 Dialog),避免出現第三條跳過確認、行為不一致的路徑。

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
// 已分批(共享批次狀態有資料)→ 改渲染分批版出貨管理
const isBatched = computed<boolean>(() => batches.value.length > 0)
/** 商品只有一個時無法再拆批,不提供分批出貨按鈕與功能 */
const canSplitShipping = computed<boolean>(() => props.order.itemCount > 1)

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
/** 批次是否為系統管控物流(比照整單:非自取/商家自建/郵局,且已設定配送) */
function batchIsSystemCarrier(batch: OrderBatch): boolean {
  if (!batch.carrier) return false
  const name = batch.carrier.name
  if (name.includes('自取') || name.includes('商家自建') || name.includes('郵局')) return false
  return true
}
function batchStageIndex(s: BatchShippingStatus): number {
  return BATCH_FLOW.findIndex(x => x.key === s)
}
/** 批次無法手動切換:系統管控物流 + 已進入出貨後階段(已出貨之後) → 由系統驅動 */
function batchManualSwitchLocked(batch: OrderBatch): boolean {
  return batchIsSystemCarrier(batch) && batchStageIndex(batch.status) >= batchStageIndex('shipping')
}
/** 點某批次的貨態圓點 → 二次確認後切換該批狀態（與整單貨態切換一致） */
const confirm = useConfirm()
function setBatchStatus(batch: OrderBatch, status: BatchShippingStatus): void {
  if (batch.status === status) return
  // 比照整單:系統管控物流且已進入出貨後階段 → 不可手動切換,跳提示
  if (batchManualSwitchLocked(batch)) {
    showLockedSwitch('批次', batch.carrier?.name ?? '', batchStatusBadge(batch.status).label)
    return
  }
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
    // 未指派物流時,依訂單原配送方式預設物流商/方式
    shippingMethod: props.order.shippingMethod,
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

</script>

<template>
  <div class="flex flex-col gap-4 p-4 bg-[var(--p-content-hover-background)]">
    <!-- 原始訂單 · 合併紀錄：僅合併訂單(有 mergeRecord)顯示，置於最上方 -->
    <OrderMergeRecordPanel :order="order" @open-source-order="openSourceOrder" />

    <!-- 上方 4 卡 grid：配送資訊 / 訂單來源 / 付款方式 / 發票資訊 -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
      <!-- 配送資訊：整卡編輯（點筆 icon 進入編輯，打勾 icon commit） -->
      <div class="rounded-lg border border-[var(--p-content-border-color)] bg-[var(--p-content-background)] p-4 flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="text-sm font-bold text-[var(--p-text-color)]">配送資訊</span>
            <Button
              v-if="!detailReadOnly && !editingShipping"
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
              v-else-if="editingShipping"
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
          <!-- 出貨狀態:原始訂單檢視隱藏(已併入合併單,狀態以合併單為準) -->
          <div v-if="!hideShipping" class="flex items-center justify-between text-sm">
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
              <span class="text-xs text-[var(--p-text-muted-color)]">{{ shippingAddressDisplay }}</span>
            </div>
          </div>
        </template>

        <!-- 編輯模式：配送方式（僅貨到付款可改）+ 姓名/電話/地址 InputText（label 常駐可見） -->
        <template v-else>
          <div class="flex flex-col gap-1">
            <label class="text-xs text-[var(--p-text-muted-color)]">配送方式</label>
            <!-- 貨到付款 或 待出貨:可更改配送方式(備貨中以後鎖定) -->
            <Select
              v-if="canEditShippingMethod && canEditShippingInfo"
              v-model="editShippingMethod"
              :options="shippingMethodOptions"
              option-label="label"
              option-value="value"
              class="w-full"
              size="small"
            />
            <!-- 其他(已計價 / 已進入出貨流程):不可更改;需變更請取消訂單重新下單 -->
            <template v-else>
              <div class="flex items-center gap-2 text-sm text-[var(--p-text-color)]">
                <i class="pi pi-truck text-sm text-[var(--p-text-muted-color)]"></i>
                {{ order.shippingMethod }}
              </div>
              <p v-if="!canEditShippingInfo" class="text-xs text-[var(--p-text-muted-color)] leading-relaxed">
                訂單已進入備貨中,配送方式與收件地址無法變更;收件人與電話仍可調整。
              </p>
              <p v-else class="text-xs text-[var(--p-text-muted-color)] leading-relaxed">
                此訂單已依原配送方式完成計價,配送方式無法變更。如需變更,請「取消訂單」後重新下單(地址仍可修改)。
              </p>
            </template>
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs text-[var(--p-text-muted-color)]">收件人 <span class="text-[var(--p-red-500)]">*</span></label>
            <InputText v-model="editBuyerName" placeholder="收件人姓名" class="w-full" size="small" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs text-[var(--p-text-muted-color)]">電話 <span class="text-[var(--p-red-500)]">*</span></label>
            <div class="flex gap-2">
              <Select v-model="phoneCode" :options="PHONE_CODES" class="shrink-0 !w-[110px]" size="small" />
              <InputText v-model="editBuyerPhone" placeholder="收件人電話" class="w-full" size="small" @input="editBuyerPhone = editBuyerPhone.replace(/-/g, '')" />
            </div>
          </div>
          <!-- 收件地址：僅「待出貨」可編輯;備貨中以後鎖定改唯讀(收件人/電話不受影響) -->
          <template v-if="canEditShippingInfo">
          <!-- 宅配：收件地址（結構化欄位，依各國標準規格；共用元件；國別連動電話國碼） -->
          <ShippingAddressFields v-if="editShippingMethod === '常溫宅配'" v-model="shippingAddress" @update:country="onAddressCountry" />
          <!-- 自取 / 超商配送：改填取貨門市 -->
          <template v-else>
            <!-- 由宅配改為取貨方式時，提醒重新填寫門市 -->
            <div
              v-if="shippingMethodChanged"
              class="flex items-center gap-1 text-xs text-yellow-600 dark:text-yellow-400"
            >
              <i class="pi pi-exclamation-triangle"></i>
              <span>配送方式已變更,請重新填寫貨取門市</span>
            </div>
            <!-- 自取：從商家自有門市擇一 -->
            <div v-if="editShippingMethod === '自取'" class="flex flex-col gap-1">
              <label class="text-xs text-[var(--p-text-muted-color)]">取貨門市</label>
              <Select
                v-model="pickupStore"
                :options="pickupStoreOptions"
                option-label="label"
                option-value="value"
                placeholder="選擇取貨門市"
                class="w-full"
                size="small"
              />
            </div>
            <!-- 超商配送：門市名稱／地址 + 電子地圖選店 -->
            <div v-else class="flex flex-col gap-1">
              <label class="text-xs text-[var(--p-text-muted-color)]">取貨門市</label>
              <div class="flex items-center gap-2">
                <InputText
                  v-model="cvsStore"
                  placeholder="門市名稱 / 地址"
                  class="w-full"
                  size="small"
                  readonly
                />
                <Button
                  label="選擇門市"
                  severity="secondary"
                  outlined
                  size="small"
                  class="shrink-0"
                  @click="pickCvsStore"
                />
              </div>
            </div>
          </template>
          </template>
          <!-- 備貨中以後:收件地址唯讀;收件人與電話仍可調整 -->
          <template v-else>
            <div class="flex flex-col gap-1">
              <label class="text-xs text-[var(--p-text-muted-color)]">收件地址</label>
              <span class="text-sm text-[var(--p-text-color)]">{{ shippingAddressDisplay }}</span>
              <p class="text-xs text-[var(--p-text-muted-color)] leading-relaxed">訂單已進入備貨中,收件地址無法修改;收件人與電話仍可調整。</p>
            </div>
          </template>
        </template>
      </div>

      <!-- 訂單來源：訂單狀態 / 訂單來源 / 社群平台 / 多購物車 / 場次名稱 -->
      <OrderSourceCard :order="order" :hide-shipping="hideShipping" />

      <!-- 付款方式：整卡編輯 -->
      <div class="rounded-lg border border-[var(--p-content-border-color)] bg-[var(--p-content-background)] p-4 flex flex-col gap-2">
        <div class="flex items-center gap-2">
          <span class="text-sm font-bold text-[var(--p-text-color)]">付款方式</span>
          <Button
            v-if="!hideShipping && !editingPayment"
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
            v-else-if="editingPayment"
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
        <!-- 結帳編號:顯示於付款狀態下方;貨到付款 / 取貨現場付款(自取)無結帳編號,不顯示 -->
        <div v-if="hasCheckoutNo" class="flex items-center justify-between text-sm">
          <span class="text-[var(--p-text-muted-color)]">結帳編號</span>
          <span class="text-[var(--p-text-color)]">{{ checkoutNo }}</span>
        </div>
        <!-- 付款方式:待出貨可改(Select),其餘僅供檢視 -->
        <div class="flex items-center justify-between text-sm">
          <span class="text-[var(--p-text-muted-color)]">付款方式</span>
          <span v-if="!(editingPayment && canEditPaymentMethod)" class="text-[var(--p-text-color)]">
            <template v-if="isMixedMergePayment">多種付款方式</template>
            <template v-else>{{ paymentMethodLabel }}<template v-if="isAtmTransfer">（末 5 碼：<span class="font-bold text-[var(--p-primary-color)]">{{ atmLast5 }}</span>）</template></template>
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
      <OrderInvoiceCard :order="order" :read-only="detailReadOnly" />
    </div>

    <!-- 已取消:此訂單已取消整塊取代出貨管理；原始訂單檢視模式隱藏 -->
    <div
      v-if="!hideShipping && order.shippingStatus === 'cancelled'"
      class="rounded-lg border border-red-200 bg-red-50 p-4 flex flex-col gap-2 dark:border-red-900 dark:bg-red-950/40"
    >
      <span class="inline-flex items-center gap-2 text-sm font-bold text-red-600 dark:text-red-400">
        <i class="pi pi-ban"></i>
        此訂單已取消
      </span>
      <div class="flex flex-col gap-1 text-sm">
        <div class="flex gap-2">
          <span class="w-16 shrink-0 text-red-400 dark:text-red-400/80">處理方式</span>
          <span class="font-medium text-red-600 dark:text-red-400">{{ cancelMethodLabel }}</span>
        </div>
        <div v-if="order.cancelTime" class="flex gap-2">
          <span class="w-16 shrink-0 text-red-400 dark:text-red-400/80">取消時間</span>
          <span class="text-[var(--p-text-color)]">{{ order.cancelTime }}</span>
        </div>
        <div class="flex gap-2">
          <span class="w-16 shrink-0 text-red-400 dark:text-red-400/80">取消原因</span>
          <span class="text-[var(--p-text-color)] break-words">{{ order.cancelReason || '—' }}</span>
        </div>
      </div>
    </div>

    <!-- 出貨管理（依規範：紫色外框）；已取消 / 原始訂單檢視模式不顯示 -->
    <div v-else-if="!hideShipping" class="rounded-lg border-2 border-[var(--p-primary-color)] bg-[var(--p-content-background)] p-4 flex flex-col gap-4">
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
        <!-- 分批出貨：商品只有一個時隱藏(無法再拆批) -->
        <Button v-if="canSplitShipping" label="分批出貨" icon="pi pi-th-large" severity="secondary" variant="outlined" size="small" @click="openSplitPage" />
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
        </div>

        <!-- 出貨單備註 -->
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
    <OrderItemsSection
      :product-rows="productRows"
      :subtotal="subtotal"
      :shipping-fee="shippingFee"
      :coupon-discount="couponDiscount"
      :points-discount="pointsDiscount"
      :free-ship-discount="freeShipDiscount"
      :total="total"
    />

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
          此{{ lockedSwitchInfo.unit }}由 <span class="font-medium">{{ lockedSwitchInfo.carrierName }}</span> 系統管控,目前狀態「<span class="font-medium text-yellow-600 dark:text-yellow-400">{{ lockedSwitchInfo.statusLabel }}</span>」屬出貨後階段,無法手動切換。
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
