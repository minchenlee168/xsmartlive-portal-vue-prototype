<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import ShippingConfigDialog from './ShippingConfigDialog.vue'
import IssueInvoiceDialog from './IssueInvoiceDialog.vue'
import DiffAdjDialog, { type DiffAdjPayload } from './DiffAdjDialog.vue'
import ShippingListPrintDialog from './ShippingListPrintDialog.vue'

/**
 * 訂單列表 row expansion 展開內容。
 *
 * 三大區塊：
 * 1. 上方 4 卡（grid）：配送資訊 / 訂單來源 / 付款方式 / 發票資訊
 * 2. 出貨管理：動作按鈕列 + 配送物流/發票狀態 + 出貨進度 Timeline + 出貨單備註
 * 3. 商品明細 table + 用戶備註 + 訂單總計（運費 / 商品總額 / 總計）
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
  diffAdj?: DiffAdjPayload
}

interface Props {
  order: OrderRow
}
const props = defineProps<Props>()
const emit = defineEmits<{
  /** 觸發全頁分批出貨作業（父層負責關閉詳情彈窗 + 切換頁面模式） */
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
  const map = { session_0620: '6/20 開箱直播', session_0622: '6/22 美妝直播', session_0624: '6/24 晚間生鮮直播', session_0625: '6/25 服飾團' } as const
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
    time: i === currentIdx ? props.order.createdAt.slice(5, 10).replace('-', '/') + ' ' + props.order.createdAt.slice(11, 16) : '—',
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
/**
 * 差額調整對訂單金額的影響（欄位字典 diffAdj）：
 * - absorb / coupon / points 不算訂單調整 → 0
 * - charge → +amount（客戶要補款）
 * - refund + refund_method=refund → -amount（退錢給客戶）
 */
const diffAdjAmount = computed<number>(() => {
  const d = props.order.diffAdj
  if (!d) return 0
  if (d.settleType === 'absorb') return 0
  if (d.settleType === 'refund' && (d.refundMethod === 'coupon' || d.refundMethod === 'points')) return 0
  if (d.settleType === 'charge') return d.amount
  if (d.settleType === 'refund' && d.refundMethod === 'refund') return -d.amount
  return 0
})
const total = computed(() => subtotal.value + shippingFee - couponDiscount.value - pointsDiscount.value + diffAdjAmount.value)

/** 差額調整 Dialog */
const diffAdjDialogVisible = ref(false)
function onDiffAdjConfirm(payload: DiffAdjPayload): void {
  props.order.diffAdj = payload
}
function onDiffAdjRemove(): void {
  props.order.diffAdj = undefined
}
/** 差額調整顯示文字 */
const diffAdjSettleLabel = computed(() => {
  const d = props.order.diffAdj
  if (!d) return ''
  if (d.settleType === 'absorb') return '商家自行吸收'
  if (d.settleType === 'charge') return '向客戶補收'
  if (d.settleType === 'refund') {
    if (d.refundMethod === 'refund') return '退款（退刷）'
    if (d.refundMethod === 'coupon') return '退回優惠券'
    if (d.refundMethod === 'points') return '退回紅利點數'
  }
  return ''
})

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

/** 分批出貨作業：改為全頁模式 — 點按鈕發事件通知父層切換頁面 */
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
          <div class="flex items-center gap-2 text-[13px] text-[var(--p-text-color)]">
            <i class="pi pi-truck text-[13px] text-[var(--p-text-muted-color)]"></i>
            {{ order.shippingMethod }}
          </div>
          <div class="flex items-start gap-2 text-[13px] text-[var(--p-text-color)]">
            <i class="pi pi-map-marker mt-1 text-[13px] text-[var(--p-text-muted-color)]"></i>
            <div class="flex flex-col gap-1">
              <span>{{ order.buyerName }} / {{ order.buyerPhone }}</span>
              <span class="text-xs text-[var(--p-text-muted-color)]">{{ shippingAddress }}</span>
            </div>
          </div>
        </template>

        <!-- 編輯模式：出貨方式 Select + 姓名/電話/地址 InputText -->
        <template v-else>
          <Select
            v-model="editShippingMethod"
            :options="shippingMethodOptions"
            option-label="label"
            option-value="value"
            class="w-full"
            size="small"
          />
          <InputText v-model="editBuyerName" placeholder="收件人姓名" class="w-full" size="small" />
          <InputText v-model="editBuyerPhone" placeholder="收件人電話" class="w-full" size="small" />
          <InputText v-model="shippingAddress" placeholder="收件地址" class="w-full" size="small" />
        </template>
      </div>

      <!-- 訂單來源（原「購買通路」card，改回訂單來源標題以符合使用者偏好） -->
      <div class="rounded-lg border border-[var(--p-content-border-color)] bg-[var(--p-content-background)] p-4 flex flex-col gap-2">
        <span class="text-sm font-bold text-[var(--p-text-color)]">訂單來源</span>
        <div class="flex items-center justify-between text-[13px]">
          <span class="text-[var(--p-text-muted-color)]">購買通路</span>
          <span class="font-medium text-[var(--p-text-color)]">{{ order.channel }}</span>
        </div>
        <div class="flex items-center justify-between text-[13px]">
          <span class="text-[var(--p-text-muted-color)]">訂單來源</span>
          <span class="text-[var(--p-text-color)]">{{ sourceLabel }}</span>
        </div>
        <div class="flex items-center justify-between text-[13px]">
          <span class="text-[var(--p-text-muted-color)]">多購物車</span>
          <Tag
            :value="cartLabel"
            :pt="{ root: { style: { background: order.cartTag.bg, color: order.cartTag.color } } }"
          />
        </div>
        <div class="flex items-center justify-between text-[13px]">
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
            icon="pi pi-check"
            severity="secondary"
            variant="text"
            size="small"
            rounded
            @click="commitPayment"
          />
        </div>

        <div class="flex items-center justify-between text-[13px]">
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
        <div class="flex items-center justify-between text-[13px]">
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
        <div class="flex items-center justify-between text-[13px]">
          <span class="text-[var(--p-text-muted-color)]">應付金額</span>
          <span class="font-bold text-[var(--p-primary-color)]">${{ order.amount.toLocaleString() }}</span>
        </div>
      </div>

      <!-- 發票資訊（唯讀，依規範不加編輯） -->
      <div class="rounded-lg border border-[var(--p-content-border-color)] bg-[var(--p-content-background)] p-4 flex flex-col gap-2">
        <span class="text-sm font-bold text-[var(--p-text-color)]">發票資訊</span>
        <div class="flex items-center gap-2 text-[13px] text-[var(--p-text-color)]">
          <i class="pi pi-id-card text-[13px] text-[var(--p-text-muted-color)]"></i>
          電子發票（會員載具）
        </div>
        <!-- 已開立：顯示發票號碼 + 開立時間；未開立：橘字提示 -->
        <div v-if="order.invoiceNumber" class="flex flex-col gap-1 pt-2 border-t border-[var(--p-content-border-color)] text-[13px]">
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
          <span class="inline-flex items-center gap-1 text-xs text-[#CA8A04]">
            <i class="pi pi-exclamation-circle text-[13px]"></i>
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
        <Button label="列印出貨單" icon="pi pi-print" severity="secondary" variant="outlined" size="small" @click="printDialogVisible = true" />
        <Button label="列印標籤" icon="pi pi-tag" severity="secondary" variant="outlined" size="small" />
        <Button
          :label="order.invoiceNumber ? '已開立發票' : '開立發票'"
          icon="pi pi-file"
          severity="secondary"
          variant="outlined"
          size="small"
          @click="issueInvoiceDialogVisible = true"
        />
      </div>

      <!-- 左：配送物流 / 發票 / 出貨進度 Timeline；右：出貨單備註 -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="flex flex-col gap-4 min-w-0">
          <div class="flex items-center gap-2 text-[13px]">
            <span class="text-[var(--p-text-muted-color)] w-[80px] shrink-0">配送物流</span>
            <span v-if="order.carrierStatus === 'configured'" class="inline-flex items-center gap-2 text-[var(--p-text-color)]">
              <i class="pi pi-truck text-[var(--p-primary-color)] text-[13px]"></i>
              <span class="font-medium">{{ order.carrierName }}</span>
              <template v-if="order.trackingStatus">
                <span class="text-[var(--p-text-muted-color)]">·</span>
                <span>取號 {{ order.trackingStatus }}</span>
              </template>
            </span>
            <span v-else class="inline-flex items-center gap-1 text-[#CA8A04]">
              <i class="pi pi-exclamation-circle text-[13px]"></i>
              尚未指定物流商與取號
            </span>
          </div>
          <div class="flex items-center gap-2 text-[13px]">
            <span class="text-[var(--p-text-muted-color)] w-[80px] shrink-0">發票</span>
            <!-- 已開立：發票號碼 + 開立時間；未開立：橘字警示 -->
            <span v-if="order.invoiceNumber" class="inline-flex items-center gap-2 text-[var(--p-text-color)]">
              <i class="pi pi-id-card text-[var(--p-primary-color)] text-[13px]"></i>
              <span class="font-medium">{{ order.invoiceNumber }}</span>
              <template v-if="order.invoiceIssuedAt">
                <span class="text-[var(--p-text-muted-color)]">·</span>
                <span class="text-xs text-[var(--p-text-muted-color)]">{{ order.invoiceIssuedAt }}</span>
              </template>
            </span>
            <span v-else class="inline-flex items-center gap-1 text-[#CA8A04]">
              <i class="pi pi-exclamation-circle text-[13px]"></i>
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
            <span class="text-[13px] text-[var(--p-text-color)]">出貨單備註</span>
            <label class="flex items-center gap-2 text-xs text-[var(--p-text-muted-color)] cursor-pointer">
              <Checkbox binary />
              <span>同步顯示於出貨單</span>
            </label>
          </div>
          <Textarea placeholder="輸入出貨相關備註...（將同步顯示於出貨單）" rows="5" class="w-full resize-none" />
        </div>
      </div>
    </div>

    <!-- 商品明細（單一扁平商品表 + 用戶備註 + 訂單總計） -->
    <div class="rounded-lg border border-[var(--p-content-border-color)] bg-[var(--p-content-background)] p-4 flex flex-col gap-4">
      <span class="text-sm font-bold text-[var(--p-text-color)]">商品明細</span>
      <DataTable :value="productRows" data-key="name" class="w-full"
        :pt="{ column: { headerCell: { style: 'white-space: nowrap;' } } }">
        <Column header="商品名稱" field="name" />
        <Column header="規格" field="spec" />
        <Column header="單價" body-class="text-right" header-class="text-right">
          <template #body="{ data }">${{ data.price.toLocaleString() }}</template>
        </Column>
        <Column header="數量" body-class="text-right" header-class="text-right">
          <template #body="{ data }">×{{ data.qty }}</template>
        </Column>
        <Column header="小計" body-class="text-right" header-class="text-right">
          <template #body="{ data }">
            <span class="font-bold">${{ (data.price * data.qty).toLocaleString() }}</span>
          </template>
        </Column>
      </DataTable>

      <div class="flex items-start justify-between gap-4 pt-4 border-t border-[var(--p-content-border-color)]">
        <div class="flex-1 flex flex-col gap-1">
          <span class="text-[13px] text-[var(--p-text-color)]">用戶備註</span>
          <span class="text-xs text-[var(--p-text-muted-color)]">客人未填寫備註</span>
        </div>
        <div class="flex flex-col gap-2 text-[13px] min-w-[200px]">
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
            <span class="text-[#DC2626]">-${{ couponDiscount.toLocaleString() }}</span>
          </div>
          <div v-if="pointsDiscount > 0" class="flex items-center justify-between">
            <span class="text-[var(--p-text-muted-color)]">紅利折抵</span>
            <span class="text-[#DC2626]">-${{ pointsDiscount.toLocaleString() }}</span>
          </div>
          <!-- 差額調整（只有 charge / refund_method=refund 影響訂單總計） -->
          <div v-if="diffAdjAmount !== 0" class="flex items-center justify-between">
            <span class="text-[var(--p-text-muted-color)]">差額調整</span>
            <span :class="diffAdjAmount > 0 ? 'text-[#DC2626]' : 'text-[#16A34A]'">
              {{ diffAdjAmount > 0 ? '+' : '' }}${{ Math.abs(diffAdjAmount).toLocaleString() }}
            </span>
          </div>
          <div class="flex items-center justify-between pt-2 border-t border-[var(--p-content-border-color)]">
            <span class="font-medium text-[var(--p-text-color)]">訂單總計</span>
            <span class="text-base font-bold text-[var(--p-primary-color)]">${{ total.toLocaleString() }}</span>
          </div>
          <!-- 差額調整入口 + 已設定摘要 -->
          <div v-if="order.diffAdj" class="mt-2 rounded-md border border-[var(--p-content-border-color)] p-3 flex flex-col gap-2 bg-[var(--p-content-hover-background)]">
            <div class="flex items-center justify-between">
              <span class="text-xs font-medium text-[var(--p-text-color)]">差額調整</span>
              <Button
                v-tooltip.top="'編輯'"
                icon="pi pi-pencil"
                severity="secondary"
                variant="text"
                size="small"
                rounded
                @click="diffAdjDialogVisible = true"
              />
            </div>
            <div class="flex items-center justify-between text-xs">
              <span class="text-[var(--p-text-muted-color)]">結算方式</span>
              <span class="text-[var(--p-text-color)]">{{ diffAdjSettleLabel }}</span>
            </div>
            <div class="flex items-center justify-between text-xs">
              <span class="text-[var(--p-text-muted-color)]">金額</span>
              <span class="text-[var(--p-text-color)] font-medium">${{ order.diffAdj.amount.toLocaleString() }}</span>
            </div>
            <div class="flex items-center justify-between text-xs">
              <span class="text-[var(--p-text-muted-color)]">狀態</span>
              <Tag :value="order.diffAdj.status" severity="warn" />
            </div>
            <div v-if="order.diffAdj.reason" class="flex items-start justify-between text-xs gap-2">
              <span class="text-[var(--p-text-muted-color)] shrink-0">事由</span>
              <span class="text-[var(--p-text-color)] text-right">{{ order.diffAdj.reason }}</span>
            </div>
          </div>
          <Button
            v-else
            label="差額調整"
            icon="pi pi-dollar"
            severity="secondary"
            variant="outlined"
            size="small"
            class="mt-2"
            @click="diffAdjDialogVisible = true"
          />
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

    <!-- 開立發票 Dialog（共用元件） -->
    <IssueInvoiceDialog
      v-model:visible="issueInvoiceDialogVisible"
      :order="order"
      @confirm="onInvoiceIssued"
    />

    <!-- 差額調整 Dialog -->
    <DiffAdjDialog
      v-model:visible="diffAdjDialogVisible"
      :initial="order.diffAdj ?? null"
      @confirm="onDiffAdjConfirm"
      @remove="onDiffAdjRemove"
    />

    <!-- 出貨單列印 Dialog -->
    <ShippingListPrintDialog v-model:visible="printDialogVisible" :order="order" />
  </div>
</template>
