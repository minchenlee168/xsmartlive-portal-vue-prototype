<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, toRaw, watch } from 'vue'
import type { MenuItem } from 'primevue/menuitem'
import { useLayoutStore } from '@/admin/stores/layout'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import OrderRowDetail from './components/OrderRowDetail.vue'
import ShippingConfigDialog from './components/ShippingConfigDialog.vue'
import IssueInvoiceDialog from './components/IssueInvoiceDialog.vue'
import SplitShippingDialog from './components/SplitShippingDialog.vue'
import ShippingListPrintDialog from './components/ShippingListPrintDialog.vue'
import DefaultShippingConfigDialog from './components/DefaultShippingConfigDialog.vue'
import CancelOrderDialog from './components/CancelOrderDialog.vue'
import { orderStatusOf, orderStatusMeta, orderAbnormalReason, ORDER_STATUS_OPTIONS, type OrderStatusKey } from './orderStatus'

/**
 * 訂單管理 → 訂單列表頁。
 *
 * 排版：頁首（標題 + 副標 + 右側 4 顆批次操作鈕）置於 Card 外；篩選列、進階篩選、
 * 快速篩選 chips 與訂單 table 全部裝進一張 Card。
 *
 * 欄位：建立時間 / 購物車 + 訂單編號 / 訂購人 / 訂單狀態 / 金額 / 商品數量 /
 * 出貨方式 / 付款狀態 / 出貨狀態 / 物流商資訊 / 取號狀態 / 操作。
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
  shippingStatus: 'pending' | 'preparing' | 'shipping' | 'awaiting_receipt' | 'arrived' | 'completed' | 'returned' | 'cancelled' | 'returning' | 'return_done' | 'exchanged' | 'delivery_abnormal'
  /** 配送異常原因(物流商回報);delivery_abnormal 時以 tooltip 顯示 */
  abnormalReason?: string
  carrierStatus: 'unconfigured' | 'configured'
  trackingStatus: string | null
  /** 已設定的物流商顯示名稱（配送設定 confirm 後寫入） */
  carrierName?: string
  /** 進階篩選欄位（不顯示在表格內，僅參與篩選） */
  orderSource: 'post' | 'live' | 'group' | 'shop'
  socialPlatform?: 'facebook' | 'line' | 'instagram' | 'tiktok' | 'other'
  multiCart: 'default' | 'main' | 'ice' | 'ice_grocery'
  sessionName?: 'session_0620' | 'session_0622' | 'session_0624' | 'session_0625'
  /** 購買通路（欄位字典 order.source）：顯示商城 / Facebook / LINE / Instagram 等 */
  channel: string
  /** 優惠券活動名稱（欄位字典 order.couponActivity） */
  couponActivity?: string
  /** 優惠券折抵金額（欄位字典 order.totals.couponDiscount） */
  couponDiscount?: number
  /** 紅利點數折抵金額（欄位字典 order.totals.points） */
  pointsDiscount?: number
  /** 出貨批次數（欄位字典 order.dispatchBatches.length）；> 0 顯示「已分批 N 批」tag */
  dispatchBatchCount?: number
  /** 發票開立紀錄（欄位字典 invoiceIssued.number）；null / undefined = 尚未開立 */
  invoiceNumber?: string
  /** 發票開立時間（欄位字典 invoiceIssued.time） */
  invoiceIssuedAt?: string
  /** 發票狀態(六值);未設時依 invoiceNumber 推 issued / not_issued */
  invoiceStatus?: 'not_issued' | 'issued' | 'not_required' | 'voided' | 'issue_failed' | 'void_failed'
  /** 收件地址(合併訂單判斷同址依據;沒填則不參與合併) */
  receiverAddress?: string
  /** 交易 ID(合併訂單清單顯示用) */
  transactionId?: string
  /** 商品摘要文字(合併訂單清單顯示用,如「純棉素色短T(黑) × 2」) */
  productSummary?: string
  /** 付款方式顯示文字(合併訂單清單顯示用) */
  paymentMethodLabel?: string
  /** 溫層,合併判斷同溫層依據(常溫/冷藏/冷凍…);沒填則以 shippingMethod 當代表 */
  temperature?: string
}

/** 合併訂單彈窗使用的訂單分組:同一買家 + 同址 + 同配送 + 同溫層 + 未取號才可合併 */
export interface MergeOrderGroup {
  key: string
  buyer: string
  address: string
  shippingMethod: string
  temperature: string
  orders: OrderRow[]
  total: number
}

// 篩選欄位「草稿」狀態：使用者調整 UI 控件即時更新；只有按下「搜尋」才會 commit 到 applied。
const keyword = ref('')
/** 日期區間：PrimeVue DatePicker range 模式 — 初始 null（不可為 [null, null]，否則內部會在 null.getFullYear() 噴錯）。 */
const dateRange = ref<Date[] | null>(null)

interface FilterOption { label: string; value: string }
const shippingMethodOptions: FilterOption[] = [
  { label: '宅配',     value: 'home' },
  { label: '超商配送', value: 'cvs' },
  { label: '自取',     value: 'pickup' },
  { label: '混合配送', value: 'mixed' },
]
const paymentStatusOptions: FilterOption[] = [
  { label: '待付款', value: 'unpaid' },
  { label: '付款中', value: 'paying' },
  { label: '已付款', value: 'paid' },
  { label: '付款失敗', value: 'payment_failed' },
  { label: '待退款', value: 'pending_refund' },
  { label: '已退款', value: 'refunded' },
]
const shippingStatusOptions: FilterOption[] = [
  { label: '待出貨',   value: 'pending' },
  { label: '備貨中',   value: 'preparing' },
  { label: '已出貨',   value: 'shipping' },
  { label: '已送達',   value: 'arrived' },
  { label: '已完成',   value: 'completed' },
  { label: '退貨中',   value: 'returning' },
  { label: '已退貨',   value: 'return_done' },
  { label: '已換貨',   value: 'exchanged' },
  { label: '已取消',   value: 'cancelled' },
  { label: '配送異常', value: 'delivery_abnormal' },
]
/** 物流商依配送類型分組(宅配 / 超商配送 / 跨境 / 自取·商家自建 / 其他),供 Select optionGroup 用 */
const carrierOptionGroups: Array<{ group: string; items: FilterOption[] }> = [
  { group: '宅配', items: [
    { label: '新竹物流',       value: 'hct' },
    { label: '嘉里大榮常溫',   value: 'kerry_normal' },
    { label: '嘉里大榮低溫',   value: 'kerry_cold' },
    { label: '嘉里快遞',       value: 'kerry_express' },
    { label: '黑貓宅急便',     value: 'tcat' },
  ] },
  { group: '超商配送', items: [
    { label: '黑貓宅急便（門市寄件）', value: 'tcat_handover' },
    { label: '7-11 B2C 到府收件',      value: 'cvs711_b2c_normal' },
    { label: '7-11 B2C 冷凍到府收件',  value: 'cvs711_b2c_cold' },
    { label: '7-11 交貨便（門市寄件）', value: 'cvs711_handover' },
    { label: '全家常溫',               value: 'fm_normal' },
    { label: '全家冷凍到府收件',       value: 'fm_cold_home' },
    { label: '全家 C2C 店到店',        value: 'fm_c2c' },
  ] },
  { group: '跨境', items: [
    { label: 'Presco 跨境物流（宅配）',     value: 'presco_home' },
    { label: 'Presco 跨境物流（超商取貨）', value: 'presco_cvs' },
  ] },
  { group: '自取 / 商家自建', items: [
    { label: '郵局（商家自建）', value: 'post_self' },
  ] },
  { group: '其他', items: [
    { label: '未分類', value: 'uncategorized' },
  ] },
]
const paymentMethodOptions: FilterOption[] = [
  { label: '信用卡一次付清', value: 'credit_once' },
  { label: 'ATM 轉帳',       value: 'atm' },
  { label: '轉帳匯款',       value: 'transfer' },
  { label: '貨到付款',       value: 'cod' },
  { label: 'LINE Pay',       value: 'line_pay' },
  { label: 'Apple Pay',      value: 'apple_pay' },
  { label: 'iPASS MONEY',    value: 'ipass' },
  { label: '超商代碼',       value: 'cvs_code' },
  { label: '數位簽',         value: 'digital_sign' },
  { label: '取貨現場付款',   value: 'onsite' },
]
const trackingStatusOptions: FilterOption[] = [
  { label: '已取號', value: 'taken' },
  { label: '未取號', value: 'untaken' },
]
const orderSourceOptions: FilterOption[] = [
  { label: '貼文收單', value: 'post' },
  { label: '直播收單', value: 'live' },
  { label: '社團收單', value: 'group' },
  { label: '商城訂單', value: 'shop' },
]
const socialPlatformOptions: FilterOption[] = [
  { label: 'Facebook',  value: 'facebook' },
  { label: 'LINE',      value: 'line' },
  { label: 'Instagram', value: 'instagram' },
  { label: 'TikTok',    value: 'tiktok' },
  { label: '其他',      value: 'other' },
]
const multiCartOptions: FilterOption[] = [
  { label: '預設購物車',          value: 'default' },
  { label: '主購物車',            value: 'main' },
  { label: '冰品專區',            value: 'ice' },
  { label: '冰品專區 / 生活雜貨', value: 'ice_grocery' },
]
const sessionNameOptions: FilterOption[] = [
  { label: '6-20 開箱直播',     value: 'session_0620' },
  { label: '6-22 美妝直播',     value: 'session_0622' },
  { label: '6-24 晚間生鮮直播', value: 'session_0624' },
  { label: '6-25 服飾團',       value: 'session_0625' },
]
/** 精準欄位篩選：使用者選欄位 + 輸入文字，按搜尋後做精準（或包含）比對 */
const precisionFieldOptions: FilterOption[] = [
  { label: 'Facebook ID 或 Livebuy ID', value: 'liveId' },
  { label: '訂購人姓名',     value: 'buyerName' },
  { label: '收件人姓名',     value: 'receiverName' },
  { label: '物流寄件編號',   value: 'trackingNo' },
  { label: '電話',           value: 'phone' },
  { label: '商家匯款末五碼', value: 'remitLast5' },
  { label: '結帳編號',       value: 'orderNo' },
]

// 進階篩選改為可複選(MultiSelect):每個下拉存字串陣列
const filterOrderStatus = ref<string[]>([])
const filterShipping = ref<string[]>([])
const filterPayment = ref<string[]>([])
const filterShippingStatus = ref<string[]>([])
const filterCarrier = ref<string[]>([])
const filterPaymentMethod = ref<string[]>([])
const filterTracking = ref<string[]>([])
const filterOrderSource = ref<string[]>([])
const filterSocialPlatform = ref<string[]>([])
const filterMultiCart = ref<string[]>([])
const filterSessionName = ref<string[]>([])
/** 精準欄位篩選：選哪個欄位 + 輸入要比對的值 */
const filterPrecisionField = ref<string>('buyerName')
const filterPrecisionValue = ref<string>('')
/** placeholder 隨選擇欄位變動：精準比對「XXX」欄位 */
const precisionPlaceholder = computed<string>(() => {
  const opt = precisionFieldOptions.find(o => o.value === filterPrecisionField.value)
  return opt ? `精準比對「${opt.label}」欄位` : ''
})

/** 進階篩選收摺：預設展開，點 toggle button 可收起 */
const advancedFilterExpanded = ref(true)
/** 精準搜尋收摺(獨立於進階搜尋的區塊):預設收合 */
const precisionExpanded = ref(false)
/** 進階搜尋已選欄位數量(不含精準搜尋,精準搜尋另有自己的 badge) */
const appliedAdvancedCount = computed<number>(() => {
  return [
    filterOrderStatus.value, filterShipping.value, filterPayment.value, filterShippingStatus.value,
    filterCarrier.value, filterPaymentMethod.value, filterTracking.value,
    filterOrderSource.value, filterSocialPlatform.value, filterMultiCart.value, filterSessionName.value,
  ].filter(a => a.length > 0).length
})
/** 精準搜尋已「套用」的條件數(0/1):收合時仍以 badge 提示已生效的精準比對 */
const appliedPrecisionCount = computed<number>(() => applied.value.precisionValue.trim() ? 1 : 0)
/** 一鍵清除所有進階篩選 Select 的值 + 立即從 applied 移除 → 表格重新顯示未過濾結果。 */
function clearAdvancedFilters(): void {
  filterOrderStatus.value = []
  filterShipping.value = []
  filterPayment.value = []
  filterShippingStatus.value = []
  filterCarrier.value = []
  filterPaymentMethod.value = []
  filterTracking.value = []
  filterOrderSource.value = []
  filterSocialPlatform.value = []
  filterMultiCart.value = []
  filterSessionName.value = []
  filterPrecisionValue.value = ''
  onApplyFilters()
}

type QuickFilter = 'all' | 'pending' | 'preparing' | 'shipping' | 'arrived' | 'paid' | 'unpaid' | 'refund_pending' | 'os_abnormal' | 'os_pending'
const quickFilter = ref<QuickFilter>('all')
/** 訂單狀態快速篩選：異常處理(帶紅色數量 badge,提醒待處理量)、待處理。 */
const orderStatusQuickFilters: Array<{ value: QuickFilter; label: string; statusKey: OrderStatusKey; showCount?: boolean }> = [
  { value: 'os_abnormal', label: '異常處理', statusKey: 'abnormal', showCount: true },
  { value: 'os_pending',  label: '待處理',   statusKey: 'pending' },
]
const quickFilters: Array<{ value: QuickFilter; label: string }> = [
  { value: 'pending',   label: '待出貨' },
  { value: 'preparing', label: '備貨中' },
  { value: 'shipping',  label: '已出貨' },
  { value: 'paid',      label: '已付款' },
  { value: 'unpaid',    label: '待付款' },
  { value: 'refund_pending', label: '待退款' },
]
/** 各訂單狀態的筆數(供快速篩選 badge 顯示)。 */
const orderStatusCounts = computed<Record<OrderStatusKey, number>>(() => {
  const c: Record<OrderStatusKey, number> = { abnormal: 0, pending: 0, processing: 0, completed: 0, cancelled: 0 }
  orders.value.forEach(o => { c[orderStatusOf(o)]++ })
  return c
})

// 篩選「已套用」狀態：computed 過濾依此計算。按下「搜尋」才會把草稿值寫進來。
interface AppliedFilter {
  keyword: string
  dateRange: Date[] | null
  orderStatus: string[]
  shipping: string[]
  payment: string[]
  paymentMethod: string[]
  carrier: string[]
  tracking: string[]
  shippingStatus: string[]
  quickFilter: QuickFilter
  orderSource: string[]
  socialPlatform: string[]
  multiCart: string[]
  sessionName: string[]
  precisionField: string
  precisionValue: string
}
const applied = ref<AppliedFilter>({
  keyword: '',
  dateRange: null,
  orderStatus: [],
  shipping: [],
  payment: [],
  paymentMethod: [],
  carrier: [],
  tracking: [],
  shippingStatus: [],
  quickFilter: 'all',
  orderSource: [],
  socialPlatform: [],
  multiCart: [],
  sessionName: [],
  precisionField: '',
  precisionValue: '',
})
function onApplyFilters(): void {
  applied.value = {
    keyword: keyword.value,
    dateRange: dateRange.value,
    orderStatus: [...filterOrderStatus.value],
    shipping: [...filterShipping.value],
    payment: [...filterPayment.value],
    paymentMethod: [...filterPaymentMethod.value],
    carrier: [...filterCarrier.value],
    tracking: [...filterTracking.value],
    shippingStatus: [...filterShippingStatus.value],
    quickFilter: quickFilter.value,
    orderSource: [...filterOrderSource.value],
    socialPlatform: [...filterSocialPlatform.value],
    multiCart: [...filterMultiCart.value],
    sessionName: [...filterSessionName.value],
    precisionField: filterPrecisionField.value,
    precisionValue: filterPrecisionValue.value.trim(),
  }
}

// 快速篩選 chip 點按 → 只更新 applied.quickFilter 即時過濾表格,不需按套用
// 同時把對應的進階篩選下拉自動選到該項(取消時清掉先前同步的值)
const QUICK_TO_ADVANCED: Partial<Record<QuickFilter, { field: 'shipping' | 'payment' | 'orderStatus'; value: string }>> = {
  pending:        { field: 'shipping', value: 'pending' },
  preparing:      { field: 'shipping', value: 'preparing' },
  shipping:       { field: 'shipping', value: 'shipping' },
  paid:           { field: 'payment', value: 'paid' },
  unpaid:         { field: 'payment', value: 'unpaid' },
  refund_pending: { field: 'payment', value: 'pending_refund' },
  os_abnormal:    { field: 'orderStatus', value: 'abnormal' },
  os_pending:     { field: 'orderStatus', value: 'pending' },
}
function syncAdvancedField(field: 'shipping' | 'payment' | 'orderStatus', value: string): void {
  const arr = value ? [value] : []
  if (field === 'shipping') filterShippingStatus.value = arr
  else if (field === 'payment') filterPayment.value = arr
  else filterOrderStatus.value = arr
}
watch(quickFilter, (v, old) => {
  applied.value.quickFilter = v
  const prev = QUICK_TO_ADVANCED[old]
  if (prev) syncAdvancedField(prev.field, '')
  const next = QUICK_TO_ADVANCED[v]
  if (next) syncAdvancedField(next.field, next.value)
})

const CART_TAGS: Record<string, { bg: string; color: string }> = {
  '服飾專區': { bg: '#f2ebff', color: '#7008e7' },
  '生活雜貨': { bg: '#dcfce7', color: '#16a34a' },
  '美食專區': { bg: '#fef3c7', color: '#b45309' },
}
function tagFor(name: string) {
  return { label: name, ...(CART_TAGS[name] ?? { bg: '#f1f5f9', color: '#64748b' }) }
}

const orders = ref<OrderRow[]>([
  { id: '1', createdAt: '2026-05-10 10:20', cartTag: tagFor('服飾專區'), orderNo: 'A20260510101', buyerName: '楊雅雯', buyerPhone: '0925-111-222', amount: 1400, itemCount: 1, shippingMethod: '常溫宅配', paymentStatus: 'paid',   shippingStatus: 'shipping', carrierStatus: 'configured', carrierName: '黑貓宅急便', trackingStatus: 'TCAT-260510-A099', orderSource: 'live', socialPlatform: 'facebook',  multiCart: 'default',     sessionName: 'session_0620', channel: 'Facebook',  couponActivity: '母親節限定 8 折', couponDiscount: 200, pointsDiscount: 50, dispatchBatchCount: 0 },
  { id: '2', createdAt: '2026-05-10 15:45', cartTag: tagFor('生活雜貨'), orderNo: 'A20260510102', buyerName: '楊雅雯', buyerPhone: '0925-111-222', amount:  405, itemCount: 3, shippingMethod: '常溫宅配', paymentStatus: 'paid',   shippingStatus: 'preparing', carrierStatus: 'configured', carrierName: '黑貓宅急便', trackingStatus: null, orderSource: 'shop',                              multiCart: 'ice_grocery',                              channel: '商城',                                                                                                                                        invoiceNumber: 'AB12345678', invoiceIssuedAt: '2026-05-10 16:00' },
  { id: '3', createdAt: '2026-05-10 11:30', cartTag: tagFor('服飾專區'), orderNo: 'A20260510103', buyerName: '蔡明宏', buyerPhone: '0936-333-444', amount: 1300, itemCount: 2, shippingMethod: '常溫宅配', paymentStatus: 'paid', shippingStatus: 'preparing', carrierStatus: 'configured', carrierName: '新竹物流',   trackingStatus: 'HCT-260510-A103', orderSource: 'live', socialPlatform: 'line',      multiCart: 'main',        sessionName: 'session_0622', channel: 'LINE',                                          pointsDiscount: 100, dispatchBatchCount: 2 },
  { id: '4', createdAt: '2026-05-11 09:00', cartTag: tagFor('服飾專區'), orderNo: 'A20260511101', buyerName: '何併併', buyerPhone: '0912-345-678', amount:  510, itemCount: 1, shippingMethod: '常溫宅配', paymentStatus: 'pending_refund', shippingStatus: 'returning', carrierStatus: 'configured', carrierName: '黑貓宅急便', trackingStatus: null, orderSource: 'live', socialPlatform: 'instagram', multiCart: 'default',     sessionName: 'session_0624', channel: 'Instagram',                                                                                                          },
  { id: '5', createdAt: '2026-05-11 10:30', cartTag: tagFor('服飾專區'), orderNo: 'A20260511102', buyerName: '何併併', buyerPhone: '0912-345-678', amount: 1250, itemCount: 1, shippingMethod: '常溫宅配', paymentStatus: 'paid',   shippingStatus: 'preparing', carrierStatus: 'configured', carrierName: '黑貓宅急便', trackingStatus: 'TCAT-260511-A101', orderSource: 'shop',                              multiCart: 'main',                                     channel: '商城',      couponActivity: '春季新品優惠', couponDiscount: 100,                                                                                          invoiceNumber: 'CD98765432', invoiceIssuedAt: '2026-05-11 11:15' },
  { id: '6', createdAt: '2026-05-11 13:15', cartTag: tagFor('服飾專區'), orderNo: 'A20260511103', buyerName: '何併併', buyerPhone: '0912-345-678', amount: 1250, itemCount: 2, shippingMethod: '常溫宅配', paymentStatus: 'paid',   shippingStatus: 'delivery_abnormal', carrierStatus: 'configured', carrierName: '黑貓宅急便', trackingStatus: null, orderSource: 'live', socialPlatform: 'tiktok',    multiCart: 'ice',         sessionName: 'session_0625', channel: 'TikTok',                                                             dispatchBatchCount: 1, abnormalReason: '物流商回報:收件地址不完整,司機無法投遞,包裹已退回物流站待處理。' },

  // 合併訂單 demo:三組同買家 + 同址 + 同溫層 + 未取號 → 可合併
  // 周庭安 x 3 - 台北市大安區敦化南路二段100號 · 常溫宅配 · 信用卡一次付清
  { id: 'm1', createdAt: '2026-06-25 14:02', cartTag: tagFor('服飾專區'), orderNo: 'A20260625301', buyerName: '周庭安', buyerPhone: '0910-246-810', amount: 1300, itemCount: 2, shippingMethod: '常溫宅配', paymentStatus: 'paid',   shippingStatus: 'pending', carrierStatus: 'unconfigured', trackingStatus: null, orderSource: 'shop', multiCart: 'default', channel: '商城', receiverAddress: '台北市大安區敦化南路二段100號', transactionId: 'TXN-625301', productSummary: '純棉素色短T(黑) × 2', paymentMethodLabel: '信用卡一次付清', temperature: '常溫' },
  { id: 'm2', createdAt: '2026-06-26 09:41', cartTag: tagFor('服飾專區'), orderNo: 'A20260625302', buyerName: '周庭安', buyerPhone: '0910-246-810', amount: 1400, itemCount: 1, shippingMethod: '常溫宅配', paymentStatus: 'paid',   shippingStatus: 'pending', carrierStatus: 'unconfigured', trackingStatus: null, orderSource: 'shop', multiCart: 'default', channel: '商城', receiverAddress: '台北市大安區敦化南路二段100號', transactionId: 'TXN-625302', productSummary: '韓版寬鬆連帽外套(黑) × 1', paymentMethodLabel: '信用卡一次付清', temperature: '常溫' },
  { id: 'm3', createdAt: '2026-06-27 18:15', cartTag: tagFor('生活雜貨'), orderNo: 'A20260625303', buyerName: '周庭安', buyerPhone: '0910-246-810', amount:  500, itemCount: 4, shippingMethod: '常溫宅配', paymentStatus: 'paid',   shippingStatus: 'pending', carrierStatus: 'unconfigured', trackingStatus: null, orderSource: 'shop', multiCart: 'default', channel: '商城', receiverAddress: '台北市大安區敦化南路二段100號', transactionId: 'TXN-625303', productSummary: '燕麥奶 × 4',              paymentMethodLabel: '信用卡一次付清', temperature: '常溫' },
  // 楊雅雯 x 3 - 台北市中山區南京東路二段50號 · 常溫宅配 · 信用卡一次付清
  { id: 'm4', createdAt: '2026-06-16 10:13', cartTag: tagFor('服飾專區'), orderNo: 'A20260510101B', buyerName: '楊雅雯', buyerPhone: '0925-111-222', amount: 1400, itemCount: 1, shippingMethod: '常溫宅配', paymentStatus: 'paid',   shippingStatus: 'pending', carrierStatus: 'unconfigured', trackingStatus: null, orderSource: 'shop', multiCart: 'default', channel: '商城', receiverAddress: '台北市中山區南京東路二段50號',  transactionId: 'TXN-510101', productSummary: '韓版寬鬆連帽外套(米白) × 1', paymentMethodLabel: '信用卡一次付清', temperature: '常溫' },
  { id: 'm5', createdAt: '2026-06-17 11:26', cartTag: tagFor('生活雜貨'), orderNo: 'A20260510102B', buyerName: '楊雅雯', buyerPhone: '0925-111-222', amount:  405, itemCount: 3, shippingMethod: '常溫宅配', paymentStatus: 'paid',   shippingStatus: 'pending', carrierStatus: 'unconfigured', trackingStatus: null, orderSource: 'shop', multiCart: 'default', channel: '商城', receiverAddress: '台北市中山區南京東路二段50號',  transactionId: 'TXN-510102', productSummary: '燕麥奶 × 3',              paymentMethodLabel: '信用卡一次付清', temperature: '常溫' },
  { id: 'm6', createdAt: '2026-06-20 12:49', cartTag: tagFor('服飾專區'), orderNo: 'A20260415001',  buyerName: '楊雅雯', buyerPhone: '0925-111-222', amount:  710, itemCount: 1, shippingMethod: '常溫宅配', paymentStatus: 'paid',   shippingStatus: 'pending', carrierStatus: 'unconfigured', trackingStatus: null, orderSource: 'shop', multiCart: 'default', channel: '商城', receiverAddress: '台北市中山區南京東路二段50號',  transactionId: 'TXN-415001', productSummary: '純棉素色短T(黑) × 1',    paymentMethodLabel: '信用卡一次付清', temperature: '常溫' },
  // 林大華 x 4 - 高雄市三民區建工路300號 · 常溫宅配 · 貨到付款
  { id: 'm7',  createdAt: '2026-06-16 18:57', cartTag: tagFor('服飾專區'), orderNo: 'A20260512101', buyerName: '林大華', buyerPhone: '0987-543-210', amount: 1180, itemCount: 2, shippingMethod: '常溫宅配', paymentStatus: 'unpaid', shippingStatus: 'pending', carrierStatus: 'unconfigured', trackingStatus: null, orderSource: 'shop', multiCart: 'default', channel: '商城', receiverAddress: '高雄市三民區建工路300號', productSummary: '純棉素色短T(黑) × 2',    paymentMethodLabel: '貨到付款', temperature: '常溫', couponActivity: '貨到付款折抵', couponDiscount: 100, pointsDiscount: 0 },
  { id: 'm8',  createdAt: '2026-06-17 09:10', cartTag: tagFor('生活雜貨'), orderNo: 'A20260512102', buyerName: '林大華', buyerPhone: '0987-543-210', amount:  380, itemCount: 4, shippingMethod: '常溫宅配', paymentStatus: 'unpaid', shippingStatus: 'pending', carrierStatus: 'unconfigured', trackingStatus: null, orderSource: 'shop', multiCart: 'default', channel: '商城', receiverAddress: '高雄市三民區建工路300號', productSummary: '燕麥奶 × 4',              paymentMethodLabel: '貨到付款', temperature: '常溫' },
  { id: 'm9',  createdAt: '2026-06-18 10:23', cartTag: tagFor('服飾專區'), orderNo: 'A20260512103', buyerName: '林大華', buyerPhone: '0987-543-210', amount: 1280, itemCount: 1, shippingMethod: '常溫宅配', paymentStatus: 'unpaid', shippingStatus: 'pending', carrierStatus: 'unconfigured', trackingStatus: null, orderSource: 'shop', multiCart: 'default', channel: '商城', receiverAddress: '高雄市三民區建工路300號', productSummary: '韓版寬鬆連帽外套(黑) × 1', paymentMethodLabel: '貨到付款', temperature: '常溫', couponActivity: '滿額折', couponDiscount: 150 },
  { id: 'm10', createdAt: '2026-06-19 11:36', cartTag: tagFor('服飾專區'), orderNo: 'A20260512104', buyerName: '林大華', buyerPhone: '0987-543-210', amount: 1770, itemCount: 3, shippingMethod: '常溫宅配', paymentStatus: 'unpaid', shippingStatus: 'pending', carrierStatus: 'unconfigured', trackingStatus: null, orderSource: 'shop', multiCart: 'default', channel: '商城', receiverAddress: '高雄市三民區建工路300號', productSummary: '純棉素色短T(白) × 3',    paymentMethodLabel: '貨到付款', temperature: '常溫' },

  // ── 異常處理示範:各種「貨態 × 付款狀態」不該發生的組合(依 UAT 對照表判異常) ──
  // e1 已於上方 id 6 示範「配送異常」旗標;以下為線上付款(表一)與貨到付款(表二)的不該發生組合。
  { id: 'e2', createdAt: '2026-07-01 10:05', cartTag: tagFor('服飾專區'), orderNo: 'A20260701001', buyerName: '異常示範·已送達未付', buyerPhone: '0900-000-002', amount:  980, itemCount: 1, shippingMethod: '常溫宅配', paymentStatus: 'unpaid', shippingStatus: 'arrived',     carrierStatus: 'configured', carrierName: '黑貓宅急便', trackingStatus: 'TCAT-260701-E002', orderSource: 'shop', multiCart: 'default', channel: '商城', paymentMethodLabel: '信用卡一次付清' },
  { id: 'e3', createdAt: '2026-07-01 10:10', cartTag: tagFor('生活雜貨'), orderNo: 'A20260701002', buyerName: '異常示範·已完成未付', buyerPhone: '0900-000-003', amount:  650, itemCount: 2, shippingMethod: '常溫宅配', paymentStatus: 'unpaid', shippingStatus: 'completed',   carrierStatus: 'configured', carrierName: '黑貓宅急便', trackingStatus: 'TCAT-260701-E003', orderSource: 'shop', multiCart: 'default', channel: '商城', paymentMethodLabel: '信用卡一次付清' },
  { id: 'e4', createdAt: '2026-07-01 10:15', cartTag: tagFor('服飾專區'), orderNo: 'A20260701003', buyerName: '異常示範·退貨中已付', buyerPhone: '0900-000-004', amount: 1200, itemCount: 1, shippingMethod: '常溫宅配', paymentStatus: 'paid',   shippingStatus: 'returning',   carrierStatus: 'configured', carrierName: '黑貓宅急便', trackingStatus: null,                orderSource: 'shop', multiCart: 'default', channel: '商城', paymentMethodLabel: '信用卡一次付清' },
  { id: 'e5', createdAt: '2026-07-01 10:20', cartTag: tagFor('服飾專區'), orderNo: 'A20260701004', buyerName: '異常示範·已退貨仍已付', buyerPhone: '0900-000-005', amount:  900, itemCount: 1, shippingMethod: '常溫宅配', paymentStatus: 'paid',   shippingStatus: 'return_done', carrierStatus: 'configured', carrierName: '黑貓宅急便', trackingStatus: null,                orderSource: 'shop', multiCart: 'default', channel: '商城', paymentMethodLabel: '信用卡一次付清' },
  { id: 'e6', createdAt: '2026-07-01 10:25', cartTag: tagFor('生活雜貨'), orderNo: 'A20260701005', buyerName: '異常示範·已換貨未付', buyerPhone: '0900-000-006', amount:  760, itemCount: 3, shippingMethod: '常溫宅配', paymentStatus: 'unpaid', shippingStatus: 'exchanged',   carrierStatus: 'configured', carrierName: '黑貓宅急便', trackingStatus: null,                orderSource: 'shop', multiCart: 'default', channel: '商城', paymentMethodLabel: '信用卡一次付清' },
  { id: 'e7', createdAt: '2026-07-01 10:30', cartTag: tagFor('服飾專區'), orderNo: 'A20260701006', buyerName: '異常示範·已取消仍已付', buyerPhone: '0900-000-007', amount:  540, itemCount: 1, shippingMethod: '常溫宅配', paymentStatus: 'paid',   shippingStatus: 'cancelled',   carrierStatus: 'unconfigured', trackingStatus: null,               orderSource: 'shop', multiCart: 'default', channel: '商城', paymentMethodLabel: '信用卡一次付清' },
  { id: 'e8', createdAt: '2026-07-01 10:35', cartTag: tagFor('服飾專區'), orderNo: 'A20260701007', buyerName: '異常示範·貨到待出已付', buyerPhone: '0900-000-008', amount:  480, itemCount: 1, shippingMethod: '常溫宅配', paymentStatus: 'paid',   shippingStatus: 'pending',     carrierStatus: 'unconfigured', trackingStatus: null,               orderSource: 'shop', multiCart: 'default', channel: '商城', paymentMethodLabel: '貨到付款' },
  { id: 'e9', createdAt: '2026-07-01 10:40', cartTag: tagFor('生活雜貨'), orderNo: 'A20260701008', buyerName: '異常示範·貨到已完成未付', buyerPhone: '0900-000-009', amount:  420, itemCount: 2, shippingMethod: '常溫宅配', paymentStatus: 'unpaid', shippingStatus: 'completed',   carrierStatus: 'configured', carrierName: '黑貓宅急便', trackingStatus: 'TCAT-260701-E009', orderSource: 'shop', multiCart: 'default', channel: '商城', paymentMethodLabel: '貨到付款' },
])

/** 全站合計 85 筆（圖中右上的總數）— 顯示用，篩選後仍顯示原始總數。 */

/** 把 createdAt 字串(YYYY-MM-DD HH:mm)取出當日 00:00 的 timestamp,用來與 dateRange 起訖比對。 */
function orderDayTs(o: OrderRow): number {
  const d = new Date(o.createdAt.slice(0, 10))
  return d.getTime()
}
function startOfDay(d: Date): number {
  const c = new Date(d)
  c.setHours(0, 0, 0, 0)
  return c.getTime()
}

/** 付款方式 value → 中文 label(訂單以 paymentMethodLabel 存中文) */
const PAYMENT_METHOD_LABEL: Record<string, string> = Object.fromEntries(
  paymentMethodOptions.map(o => [o.value, o.label]),
)
/** 物流商 value → 中文 label(訂單以 carrierName 存中文) */
const CARRIER_LABEL: Record<string, string> = Object.fromEntries(
  carrierOptionGroups.flatMap(g => g.items).map(o => [o.value, o.label]),
)
/** 出貨方式大類 → 判斷訂單具體配送方式字串是否屬於該類 */
const SHIPPING_METHOD_MATCHERS: Record<string, (m: string) => boolean> = {
  home: m => m.includes('宅配'),
  cvs: m => /超商|店到店|交貨便|門市/.test(m),
  pickup: m => m.includes('自取'),
  mixed: m => m.includes('混合'),
}
const filtered = computed<OrderRow[]>(() => {
  let list = orders.value
  const a = applied.value
  if (a.keyword.trim()) {
    const k = a.keyword.trim().toLowerCase()
    list = list.filter(o => o.orderNo.toLowerCase().includes(k) || o.buyerName.toLowerCase().includes(k))
  }
  // 日期區間:PrimeVue DatePicker range mode → [startDate, endDate?];只有起日視為單日區間
  if (a.dateRange && a.dateRange[0]) {
    const start = startOfDay(a.dateRange[0])
    const end = a.dateRange[1] ? startOfDay(a.dateRange[1]) : start
    list = list.filter(o => {
      const t = orderDayTs(o)
      return t >= start && t <= end
    })
  }
  if (a.orderStatus.length) list = list.filter(o => a.orderStatus.includes(orderStatusOf(o)))
  if (a.payment.length) list = list.filter(o => a.payment.includes(o.paymentStatus))
  // 付款方式:選項為 value(如 cod),訂單存的是中文 label(如「貨到付款」)→ 轉成 label 比對
  if (a.paymentMethod.length) {
    const wanted = new Set(a.paymentMethod.map(v => PAYMENT_METHOD_LABEL[v]).filter(Boolean))
    list = list.filter(o => !!o.paymentMethodLabel && wanted.has(o.paymentMethodLabel))
  }
  // 出貨方式:選項為配送大類(宅配 / 超商 / 自取 / 混合),訂單存的是具體方式字串 → 以關鍵字歸類比對
  if (a.shipping.length) {
    list = list.filter(o => a.shipping.some(v => SHIPPING_METHOD_MATCHERS[v]?.(o.shippingMethod)))
  }
  // 物流商:選項為 value,訂單存的是中文 carrierName → 轉成 label 比對
  if (a.carrier.length) {
    const wanted = new Set(a.carrier.map(v => CARRIER_LABEL[v]).filter(Boolean))
    list = list.filter(o => !!o.carrierName && wanted.has(o.carrierName))
  }
  // 取號狀態:已取號＝有 trackingStatus;未取號＝無
  if (a.tracking.length) {
    list = list.filter(o => a.tracking.some(v => v === 'taken' ? !!o.trackingStatus : !o.trackingStatus))
  }
  if (a.shippingStatus.length) list = list.filter(o => a.shippingStatus.includes(o.shippingStatus))
  if (a.orderSource.length) list = list.filter(o => a.orderSource.includes(o.orderSource))
  if (a.socialPlatform.length) list = list.filter(o => !!o.socialPlatform && a.socialPlatform.includes(o.socialPlatform))
  if (a.multiCart.length) list = list.filter(o => a.multiCart.includes(o.multiCart))
  if (a.sessionName.length) list = list.filter(o => !!o.sessionName && a.sessionName.includes(o.sessionName))
  if (a.precisionValue) {
    const v = a.precisionValue
    list = list.filter((o) => {
      if (a.precisionField === 'buyerName')   return o.buyerName === v
      if (a.precisionField === 'orderNo')     return o.orderNo === v
      if (a.precisionField === 'phone')       return o.buyerPhone === v
      // 其他欄位（liveId / receiverName / trackingNo / remitLast5）mock 沒對應資料 → 0 筆
      return false
    })
  }
  if (a.quickFilter === 'paid')   list = list.filter(o => o.paymentStatus === 'paid')
  else if (a.quickFilter === 'unpaid') list = list.filter(o => o.paymentStatus === 'unpaid')
  else if (a.quickFilter === 'refund_pending') list = list.filter(o => o.paymentStatus === 'pending_refund')
  else if (a.quickFilter === 'os_abnormal') list = list.filter(o => orderStatusOf(o) === 'abnormal')
  else if (a.quickFilter === 'os_pending')  list = list.filter(o => orderStatusOf(o) === 'pending')
  else if (a.quickFilter !== 'all') list = list.filter(o => o.shippingStatus === a.quickFilter)
  return list
})

function setDateRangePreset(preset: 'today' | 'last7' | 'thisMonth' | 'lastMonth'): void {
  const now = new Date()
  const start = new Date(now)
  const end = new Date(now)
  if (preset === 'last7') start.setDate(now.getDate() - 6)
  else if (preset === 'thisMonth') start.setDate(1)
  else if (preset === 'lastMonth') {
    start.setMonth(now.getMonth() - 1, 1)
    end.setMonth(now.getMonth(), 0)
  }
  dateRange.value = [start, end]
}

function onCopyOrderNo(no: string): void {
  navigator.clipboard?.writeText(no)
}

/**
 * 「查看更多」彈窗：點眼睛 icon 開 Dialog 顯示 OrderRowDetail。
 * 彈窗內編輯的是原始訂單的「副本」,按「儲存」才寫回列表(取消 / 關閉則捨棄)。
 */
const detailDialogVisible = ref(false)
const detailDialogOrder = ref<OrderRow | null>(null)
/** 被編輯訂單在 orders 陣列中的原件參考;儲存時把副本寫回它 */
const detailDialogOriginal = ref<OrderRow | null>(null)
function openDetailDialog(o: OrderRow): void {
  detailDialogOriginal.value = o
  detailDialogOrder.value = structuredClone(toRaw(o))
  detailDialogVisible.value = true
}
/** 儲存:把副本的所有欄位寫回原始訂單 → 列表即時更新 */
function saveDetailDialog(): void {
  if (detailDialogOriginal.value && detailDialogOrder.value) {
    Object.assign(detailDialogOriginal.value, detailDialogOrder.value)
    toast.add({ severity: 'success', summary: `訂單 ${detailDialogOrder.value.orderNo} 已儲存`, life: 2000 })
  }
  detailDialogVisible.value = false
}

/** 取消訂單彈窗：明細 footer「取消訂單」→ 選原因確認 → 該筆出貨狀態改「已取消」(確認動作即寫回列表) */
const cancelOrderDialogVisible = ref(false)
/** 無法取消提示彈窗:已出貨/已送達等已取號(shipped) / 已完成等已結案(completed) 兩種文案 */
const cancelBlockedDialogVisible = ref(false)
const cancelBlockedKind = ref<'shipped' | 'completed'>('shipped')
/** 可否取消:僅「待出貨且未取號」可取消(依 UAT 規範) */
const canCancelOrder = computed<boolean>(() =>
  !!detailDialogOrder.value
  && detailDialogOrder.value.shippingStatus === 'pending'
  && !detailDialogOrder.value.trackingStatus,
)
/** 點「取消訂單」:可取消→開取消彈窗;否則→依貨態跳無法取消提示 */
function openCancelOrderDialog(): void {
  const o = detailDialogOrder.value
  if (!o) return
  if (canCancelOrder.value) {
    cancelOrderDialogVisible.value = true
    return
  }
  cancelBlockedKind.value = ['completed', 'return_done', 'exchanged', 'returned', 'cancelled'].includes(o.shippingStatus)
    ? 'completed'
    : 'shipped'
  cancelBlockedDialogVisible.value = true
}
function onCancelOrderConfirm(_payload: { reason: string; method: 'return' | 'void' }): void {
  if (!detailDialogOrder.value) return
  const wasPaid = detailDialogOrder.value.paymentStatus === 'paid'
  const apply = (o: OrderRow | null): void => {
    if (!o) return
    o.shippingStatus = 'cancelled'
    // 已付款的訂單取消 → 付款狀態轉「待退款」,需手動辦理退款
    if (wasPaid) o.paymentStatus = 'pending_refund'
  }
  apply(detailDialogOrder.value)
  apply(detailDialogOriginal.value)
  detailDialogVisible.value = false
}

/** 付款狀態 inline 編輯：點 Tag → Select 模式；按打勾 commit 回 Tag。選項比照進階篩選的六種付款狀態。 */
const paymentEditOptions: Array<{ label: string; value: OrderRow['paymentStatus'] }> = [
  { label: '待付款',   value: 'unpaid' },
  { label: '付款中',   value: 'paying' },
  { label: '已付款',   value: 'paid' },
  { label: '付款失敗', value: 'payment_failed' },
  { label: '待退款',   value: 'pending_refund' },
  { label: '已退款',   value: 'refunded' },
]
const editingPaymentRowId = ref<string | null>(null)
const editPaymentValueMap = ref<Record<string, OrderRow['paymentStatus']>>({})
function startEditPayment(o: OrderRow, event: Event): void {
  event.stopPropagation()
  editingPaymentRowId.value = o.id
  editPaymentValueMap.value[o.id] = o.paymentStatus
}
function commitPayment(o: OrderRow, event: Event): void {
  event.stopPropagation()
  o.paymentStatus = editPaymentValueMap.value[o.id]
  editingPaymentRowId.value = null
}
function cancelEditPayment(event: Event): void {
  event.stopPropagation()
  editingPaymentRowId.value = null
}

/** 表格「設定配送」按鈕：點下開啟 ShippingConfigDialog，confirm 後把物流商 / 取號寫回該筆訂單 */
const shippingConfigDialogVisible = ref(false)
const shippingConfigOrder = ref<OrderRow | null>(null)
function openShippingConfig(o: OrderRow, event: Event): void {
  event.stopPropagation()
  shippingConfigOrder.value = o
  shippingConfigDialogVisible.value = true
}
function onShippingConfigConfirm(payload: { carrierName: string; method: string; trackingNo: string | null }): void {
  const o = shippingConfigOrder.value
  if (!o) return
  o.carrierStatus = 'configured'
  o.carrierName = payload.carrierName
  o.trackingStatus = payload.trackingNo
  // 已設定配送(取號)後:待出貨 → 備貨中
  if (o.shippingStatus === 'pending') {
    o.shippingStatus = 'preparing'
    toast.add({ severity: 'info', summary: `訂單 ${o.orderNo} 已設定配送,貨態推進為「備貨中」`, life: 2200 })
  }
}

/** 表格「開立發票」按鈕：點下開啟 IssueInvoiceDialog，confirm 後把發票號碼 / 時間寫回該筆訂單 */
const issueInvoiceDialogVisible = ref(false)
const issueInvoiceOrder = ref<OrderRow | null>(null)
function openIssueInvoice(o: OrderRow, event: Event): void {
  event.stopPropagation()
  issueInvoiceOrder.value = o
  issueInvoiceDialogVisible.value = true
}
function onIssueInvoiceConfirm(payload: { number: string; time: string }): void {
  const o = issueInvoiceOrder.value
  if (!o) return
  o.invoiceNumber = payload.number
  o.invoiceIssuedAt = payload.time
  o.invoiceStatus = 'issued'
}

/** 操作欄發票 icon 外觀:依發票狀態決定 severity / tooltip / 是否顯示已開立勾勾 */
type InvoiceStatusKey = NonNullable<OrderRow['invoiceStatus']>
const INVOICE_STATUS_LABEL: Record<InvoiceStatusKey, string> = {
  not_issued: '尚未開立', issued: '已開立', not_required: '不需開立',
  voided: '已作廢', issue_failed: '開立失敗', void_failed: '作廢失敗',
}
function invoiceStatusOf(o: OrderRow): InvoiceStatusKey {
  return o.invoiceStatus ?? (o.invoiceNumber ? 'issued' : 'not_issued')
}
function invoiceActionMeta(o: OrderRow): { severity: 'success' | 'danger' | 'secondary'; tooltip: string; issued: boolean } {
  const s = invoiceStatusOf(o)
  const label = INVOICE_STATUS_LABEL[s]
  const severity = s === 'issued' ? 'success' : (s === 'voided' || s === 'issue_failed' || s === 'void_failed' ? 'danger' : 'secondary')
  const tooltip = o.invoiceNumber ? `${label}：${o.invoiceNumber}` : (s === 'not_required' ? '不需開立' : '開立發票')
  return { severity, tooltip, issued: s === 'issued' }
}

/**
 * 分批出貨作業彈窗：從訂單詳情點「分批出貨」→ 關閉詳情彈窗、開啟 SplitShippingDialog
 */
const splitDialogOrderId = ref<string | null>(null)
const splitDialogOrder = computed<OrderRow | null>(() =>
  splitDialogOrderId.value ? orders.value.find(o => o.id === splitDialogOrderId.value) ?? null : null,
)
const splitDialogVisible = ref(false)
function openSplitPage(orderId: string): void {
  splitDialogOrderId.value = orderId
  detailDialogVisible.value = false  // 關閉詳情彈窗
  splitDialogVisible.value = true
}
/** 分批彈窗關閉（儲存並返回 / 取消 / X）一律回到該訂單的明細彈窗 */
function onSplitDialogVisible(v: boolean): void {
  splitDialogVisible.value = v
  if (!v) {
    const o = splitDialogOrder.value
    splitDialogOrderId.value = null
    if (o) openDetailDialog(o)
  }
}

/** 頁首「預設配送設定」按鈕:開 DefaultShippingConfigDialog */
const defaultShippingConfigDialogVisible = ref(false)

/** 表格「列印出貨單」按鈕：點下開啟 ShippingListPrintDialog */
const printDialogVisible = ref(false)
const printOrder = ref<OrderRow | null>(null)
function openPrintDialog(o: OrderRow, event: Event): void {
  event.stopPropagation()
  printOrder.value = o
  printDialogVisible.value = true
}
// ── Loading 狀態：初始載入 + 手動刷新都會顯示 LoaderSpinner 蓋在表格上 ──
const isLoading = ref(true)
// 進入訂單列表時自動收合 sidebar,把寬度留給欄位多的表格;離開頁面不自動展開
const layoutStore = useLayoutStore()
const toast = useToast()
const confirm = useConfirm()

/** 已列印標籤的訂單 id；列印過的標籤按鈕右上角顯示打勾徽章（mock：點擊即視為已列印，可重印） */
const labelPrintedIds = ref(new Set<string>())
/** 表格「標籤列印」按鈕：mock 列印 → 跳提示 + 標記已列印 */
function onPrintLabel(o: OrderRow, event: Event): void {
  event.stopPropagation()
  labelPrintedIds.value.add(o.id)
  toast.add({ severity: 'info', summary: `列印標籤 · ${o.orderNo}`, life: 2500 })
}

onMounted(() => {
  layoutStore.isSidebarCollapsed = true
  // 模擬初始載入 1.2 秒
  setTimeout(() => { isLoading.value = false }, 1200)
})
function onRefresh(): void {
  isLoading.value = true
  setTimeout(() => { isLoading.value = false }, 1500)
}

interface PopoverApi { toggle: (event: Event) => void }

// 「批次作業」下拉:批次取號 / 批次印標 / 批次印出貨單
const batchMenuRef = ref<PopoverApi | null>(null)
const batchMenuItems: MenuItem[] = [
  { label: '批次取號',    icon: 'pi pi-hashtag', command: () => enterBatchMode('tracking') },
  { label: '批次印標',    icon: 'pi pi-tag',     command: () => enterBatchMode('label') },
  { label: '批次印出貨單', icon: 'pi pi-print',   command: () => enterBatchMode('shipping_list') },
]
function openBatchMenu(event: Event): void {
  batchMenuRef.value?.toggle(event)
}

// ── 批次作業模式(取號 / 印標 / 印出貨單) ─────────────────────────
type BatchMode = null | 'tracking' | 'label' | 'shipping_list'
const batchMode = ref<BatchMode>(null)
const selectedForBatch = ref<Set<string>>(new Set())
const batchConfirmDialogVisible = ref(false)

/** 三種批次作業的規則設定:banner / dialog 文案、勾選條件、確認動作、Dialog 內每列副標 */
interface BatchConfig {
  bannerTitle: string
  confirmTitle: string
  confirmDescription: (count: number) => string
  nextStepLabel: string
  footerCountLabel: (count: number) => string
  confirmActionLabel: string
  isSelectable: (o: OrderRow) => boolean
  performAction: (orders: OrderRow[]) => void
  toastSummary: string
  /** Dialog 每列訂單編號下方灰字副標(取號 / 印標 / 印出貨單各自需要不同資訊) */
  rowSecondaryText: (o: OrderRow) => string
}
const BATCH_CONFIGS: Record<Exclude<BatchMode, null>, BatchConfig> = {
  tracking: {
    bannerTitle: '批次取號模式',
    confirmTitle: '批次取號確認',
    confirmDescription: (count) => `將為下列 ${count} 筆訂單「待出貨且未取號」向物流商批次產號。`,
    nextStepLabel: '下一步:確認取號',
    footerCountLabel: (count) => `將取號 ${count} 筆訂單`,
    confirmActionLabel: '確認取號',
    toastSummary: '批次取號完成',
    // 待出貨且尚未取號皆可批次取號(不限是否已設定物流商)
    isSelectable: (o) => o.shippingStatus === 'pending' && !o.trackingStatus,
    performAction: (list) => {
      const now = Date.now()
      list.forEach((o, i) => {
        o.trackingStatus = `${now}${String(i).padStart(4, '0')}`
        o.carrierStatus = 'configured'
        // 取號的當下:待出貨 → 備貨中
        if (o.shippingStatus === 'pending') o.shippingStatus = 'preparing'
      })
    },
    rowSecondaryText: (o) => `${o.buyerName} · ${o.carrierName ?? '未設定物流'}`,
  },
  label: {
    bannerTitle: '批次印標模式',
    confirmTitle: '批次印標確認',
    confirmDescription: (count) => `將為下列 ${count} 筆訂單已取號批次列印物流標籤。`,
    nextStepLabel: '下一步:確認列印標籤',
    footerCountLabel: (count) => `將列印標籤 ${count} 筆訂單`,
    confirmActionLabel: '確認列印標籤',
    toastSummary: '批次印標完成',
    // 已取號才能印標;不管出貨階段(備貨中/已出貨…)
    isSelectable: (o) => !!o.trackingStatus,
    performAction: () => {
      // 列印動作交給實際列印邏輯,mock 只跳 toast
    },
    rowSecondaryText: (o) => `${o.buyerName} · ${o.carrierName ?? '未設定物流'} · 取號 ${o.trackingStatus ?? '—'}`,
  },
  shipping_list: {
    bannerTitle: '批次印出貨單模式',
    confirmTitle: '批次印出貨單確認',
    confirmDescription: (count) => `將為下列 ${count} 筆訂單批次列印出貨單(含商品明細)。`,
    nextStepLabel: '下一步:確認列印出貨單',
    footerCountLabel: (count) => `將列印出貨單 ${count} 筆訂單`,
    confirmActionLabel: '確認列印出貨單',
    toastSummary: '批次印出貨單完成',
    // 尚未結束的訂單(排除已完成 / 退換貨 / 已取消 等終止狀態)都可列印出貨單
    isSelectable: (o) => !['completed', 'returned', 'cancelled'].includes(o.shippingStatus),
    performAction: () => {
      // 列印動作交給實際列印邏輯,mock 只跳 toast
    },
    rowSecondaryText: (o) => `${o.buyerName} · ${o.itemCount} 件 · NT$ ${o.amount.toLocaleString()}`,
  },
}
const activeBatchConfig = computed<BatchConfig | null>(() =>
  batchMode.value ? BATCH_CONFIGS[batchMode.value] : null,
)

function isBatchSelectable(o: OrderRow): boolean {
  return activeBatchConfig.value?.isSelectable(o) ?? false
}
const batchSelectableOrders = computed<OrderRow[]>(() =>
  activeBatchConfig.value ? filtered.value.filter(activeBatchConfig.value.isSelectable) : [],
)
const batchSelectableCount = computed(() => batchSelectableOrders.value.length)
const allSelectableSelected = computed(() =>
  batchSelectableCount.value > 0 && batchSelectableOrders.value.every((o) => selectedForBatch.value.has(o.id)),
)

function enterBatchMode(mode: Exclude<BatchMode, null>): void {
  batchMode.value = mode
  selectedForBatch.value = new Set()
}
function exitBatchMode(): void {
  batchMode.value = null
  selectedForBatch.value = new Set()
}
function toggleSelectAllSelectable(): void {
  if (allSelectableSelected.value) {
    selectedForBatch.value = new Set()
  } else {
    selectedForBatch.value = new Set(batchSelectableOrders.value.map((o) => o.id))
  }
}
function toggleRowSelection(id: string): void {
  const next = new Set(selectedForBatch.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selectedForBatch.value = next
}
/** 選中的訂單完整物件(給確認 Dialog 用) */
const selectedForBatchOrders = computed<OrderRow[]>(() =>
  orders.value.filter((o) => selectedForBatch.value.has(o.id)),
)

// ── 匯出 CSV：需先套用任一篩選或勾選 ≥1 筆才可匯出（mock，實際受權限控制）──
const hasAppliedFilter = computed<boolean>(() => {
  const a = applied.value
  return a.keyword !== '' || a.dateRange !== null || a.payment.length > 0 || a.shippingStatus.length > 0
    || a.quickFilter !== 'all' || a.orderSource.length > 0 || a.socialPlatform.length > 0 || a.multiCart.length > 0
    || a.sessionName.length > 0 || a.orderStatus.length > 0 || a.precisionValue !== ''
    || a.shipping.length > 0 || a.paymentMethod.length > 0 || a.carrier.length > 0 || a.tracking.length > 0
})
const canExport = computed<boolean>(() => hasAppliedFilter.value || selectedForBatch.value.size > 0)
const exportMenuRef = ref<PopoverApi | null>(null)
function toggleExportMenu(event: Event): void {
  exportMenuRef.value?.toggle(event)
}
function exportCsv(withDetail: boolean): void {
  if (!canExport.value) return
  const scope = selectedForBatch.value.size > 0 ? `已勾選 ${selectedForBatch.value.size} 筆` : '符合篩選的訂單'
  toast.add({
    severity: 'success',
    summary: withDetail ? '匯出訂單列表（含商品明細）' : '匯出訂單列表',
    detail: `已開始匯出 CSV（${scope}）`,
    life: 2500,
  })
}
/** 匯出選單項目：未達匯出條件時 disabled（用 Menu 取得內建鍵盤導覽 / a11y / 選單高度） */
const exportMenuItems = computed<MenuItem[]>(() => [
  { label: '匯出訂單列表', icon: 'pi pi-file-export', disabled: !canExport.value, command: () => exportCsv(false) },
  { label: '匯出訂單列表（含商品明細）', icon: 'pi pi-file-export', disabled: !canExport.value, command: () => exportCsv(true) },
])

// ── 表格橫向捲動提示：資料還沒捲到底時，在固定操作欄左側顯示漸層 + 可點的 chevron ──
const tableScrollWrap = ref<HTMLElement | null>(null)
const canScrollLeft = ref(false)
const canScrollRight = ref(false)
const overlayTop = ref(0)
const overlayHeight = ref(0)
const frozenColWidth = ref(0)
let scrollEl: HTMLElement | null = null
function measureTable(): void {
  const wrap = tableScrollWrap.value
  if (!wrap) return
  scrollEl = wrap.querySelector('.p-datatable-table-container')
  if (!scrollEl) return
  overlayTop.value = scrollEl.offsetTop
  overlayHeight.value = scrollEl.clientHeight
  const frozen = wrap.querySelector<HTMLElement>('.p-datatable-thead .p-datatable-frozen-column')
  frozenColWidth.value = frozen ? frozen.offsetWidth : 0
  updateScrollState()
}
function updateScrollState(): void {
  if (!scrollEl) return
  canScrollLeft.value = scrollEl.scrollLeft > 1
  // 剩餘可捲距離 > 16px 才算還能往右（扣掉 scrollbar-gutter / 常駐捲軸保留的 ~12px 殘差，避免捲到底仍顯示）
  canScrollRight.value = scrollEl.scrollWidth - (scrollEl.scrollLeft + scrollEl.clientWidth) > 16
}
function scrollTableBy(dir: 1 | -1): void {
  scrollEl?.scrollBy({ left: dir * Math.round((scrollEl.clientWidth || 400) * 0.6), behavior: 'smooth' })
}
let tableRO: ResizeObserver | null = null
onMounted(async () => {
  await nextTick()
  measureTable()
  scrollEl?.addEventListener('scroll', updateScrollState, { passive: true })
  tableRO = new ResizeObserver(() => measureTable())
  if (tableScrollWrap.value) tableRO.observe(tableScrollWrap.value)
})
onBeforeUnmount(() => {
  scrollEl?.removeEventListener('scroll', updateScrollState)
  tableRO?.disconnect()
})
// 換頁 / 篩選改變後行高變動，重新量測
watch(filtered, () => nextTick(measureTable))

function openBatchConfirmDialog(): void {
  if (selectedForBatch.value.size === 0) return
  batchConfirmDialogVisible.value = true
}
function confirmBatchAction(): void {
  const cfg = activeBatchConfig.value
  if (!cfg) return
  cfg.performAction(selectedForBatchOrders.value)
  batchConfirmDialogVisible.value = false
  toast.add({
    severity: 'success',
    summary: cfg.toastSummary,
    detail: `${selectedForBatchOrders.value.length} 筆訂單已完成`,
    life: 2500,
  })
  exitBatchMode()
}

/** 訂單狀態(異常處理 / 待處理 / 處理中 / 已完成 / 已取消)依 orderStatus.ts 的貨態×付款矩陣推導 */
function orderRowStatusMeta(o: OrderRow): { label: string; severity: 'success' | 'info' | 'warn' | 'danger' | 'secondary' } {
  return orderStatusMeta(orderStatusOf(o))
}

/** 付款狀態 → tag 文字/severity(六種:待付款/付款中/已付款/付款失敗/待退款/已退款) */
function paymentTagMeta(s: OrderRow['paymentStatus']): { label: string; severity: 'success' | 'info' | 'warn' | 'danger' | 'secondary' } {
  if (s === 'paid') return { label: '已付款', severity: 'success' }
  if (s === 'paying') return { label: '付款中', severity: 'info' }
  if (s === 'payment_failed') return { label: '付款失敗', severity: 'danger' }
  if (s === 'pending_refund') return { label: '待退款', severity: 'warn' }
  if (s === 'refunded') return { label: '已退款', severity: 'secondary' }
  return { label: '待付款', severity: 'warn' }
}

/** 出貨狀態 → dialog 內顯示的 tag 文字/severity */
function shippingStatusTagMeta(s: OrderRow['shippingStatus']): { label: string; severity: 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast' } {
  const map: Record<OrderRow['shippingStatus'], { label: string; severity: 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast' }> = {
    pending:           { label: '待出貨', severity: 'secondary' },
    preparing:         { label: '備貨中', severity: 'secondary' },
    shipping:          { label: '已出貨', severity: 'secondary' },
    awaiting_receipt:  { label: '待收貨', severity: 'secondary' },
    arrived:           { label: '已送達', severity: 'success' },
    completed:         { label: '已完成', severity: 'secondary' },
    returned:          { label: '退換貨', severity: 'warn' },
    cancelled:         { label: '已取消', severity: 'danger' },
    returning:         { label: '退貨中', severity: 'warn' },
    return_done:       { label: '已退貨', severity: 'secondary' },
    exchanged:         { label: '已換貨', severity: 'info' },
    delivery_abnormal: { label: '配送異常', severity: 'danger' },
  }
  return map[s]
}

// ── 合併訂單 ─────────────────────────
// 條件:同買家 + 同址 + 同配送方式 + 同溫層 + 尚未取號 → 可合併(至少 2 筆才算一組)
const mergeGroups = computed<MergeOrderGroup[]>(() => {
  const map = new Map<string, OrderRow[]>()
  orders.value.forEach((o) => {
    if (o.trackingStatus) return
    if (!o.receiverAddress) return
    const temp = o.temperature ?? o.shippingMethod
    const key = `${o.buyerName}|${o.receiverAddress}|${o.shippingMethod}|${temp}`
    const arr = map.get(key) ?? []
    arr.push(o)
    map.set(key, arr)
  })
  const groups: MergeOrderGroup[] = []
  map.forEach((arr, key) => {
    if (arr.length < 2) return
    const [buyer, address, shippingMethod, temperature] = key.split('|')
    groups.push({
      key,
      buyer,
      address,
      shippingMethod,
      temperature,
      orders: arr,
      total: arr.reduce((s, o) => s + o.amount, 0),
    })
  })
  return groups
})
/** header badge：有幾組需要合併的訂單（＝可合併群組數，非各群組訂單總數） */
const mergeableOrderCount = computed(() => mergeGroups.value.length)
const mergeDialogVisible = ref(false)
/** 合併彈窗分兩步:'list' 選擇要合併的訂單、'editor' 進入合併編輯表單 */
const mergeStep = ref<'list' | 'editor'>('list')
function openMergeDialog(): void {
  if (mergeGroups.value.length === 0) return
  mergeSelectedIds.value = new Set()
  mergeStep.value = 'list'
  mergeDialogVisible.value = true
}
/** 合併訂單彈窗內已勾選的訂單 id 集合(限單一 group / 單一買家) */
const mergeSelectedIds = ref<Set<string>>(new Set())
const mergeSelectedOrders = computed<OrderRow[]>(() =>
  mergeGroups.value.flatMap((g) => g.orders).filter((o) => mergeSelectedIds.value.has(o.id)),
)
const mergeSelectedTotal = computed(() =>
  mergeSelectedOrders.value.reduce((s, o) => s + o.amount, 0),
)
/** 當下已勾選訂單所屬的 group;第一筆勾選後鎖定,其他 group 不能再勾 */
const mergeLockedGroupKey = computed<string | null>(() => {
  if (mergeSelectedIds.value.size === 0) return null
  const first = mergeSelectedOrders.value[0]
  if (!first) return null
  const g = mergeGroups.value.find((g) => g.orders.some((o) => o.id === first.id))
  return g?.key ?? null
})
function isGroupSelectable(g: MergeOrderGroup): boolean {
  return mergeLockedGroupKey.value === null || mergeLockedGroupKey.value === g.key
}
function toggleMergeRow(id: string): void {
  const next = new Set(mergeSelectedIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  mergeSelectedIds.value = next
}
function isGroupAllSelected(g: MergeOrderGroup): boolean {
  return g.orders.length > 0 && g.orders.every((o) => mergeSelectedIds.value.has(o.id))
}
function toggleGroupAll(g: MergeOrderGroup): void {
  if (!isGroupSelectable(g)) return
  const all = isGroupAllSelected(g)
  const next = new Set(mergeSelectedIds.value)
  g.orders.forEach((o) => {
    if (all) next.delete(o.id)
    else next.add(o.id)
  })
  mergeSelectedIds.value = next
}
function clearMergeSelection(): void {
  mergeSelectedIds.value = new Set()
}
/** 點按「合併編輯」→ 進第二步表單 */
function goToMergeEditor(): void {
  if (mergeSelectedOrders.value.length < 2) return
  // 初始化編輯表單 state(收件人 / 電話 / 地址、運費、勾選的優惠券)
  const first = mergeSelectedOrders.value[0]
  mergeForm.value = {
    receiverName: first.buyerName,
    phone: first.buyerPhone,
    address: first.receiverAddress ?? '',
    shippingFee: 120,
  }
  // 預設全部優惠券都套用
  mergeCouponSelected.value = new Set(
    mergeSelectedOrders.value.filter((o) => (o.couponDiscount ?? 0) > 0).map((o) => o.id),
  )
  mergeStep.value = 'editor'
}
function backToMergeList(): void {
  mergeStep.value = 'list'
}
/** 編輯表單可調欄位 */
const mergeForm = ref({
  receiverName: '',
  phone: '',
  address: '',
  shippingFee: 120,
})
/** 已勾選要套用的優惠券 → 對應到訂單 id */
const mergeCouponSelected = ref<Set<string>>(new Set())
function toggleMergeCoupon(id: string): void {
  const next = new Set(mergeCouponSelected.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  mergeCouponSelected.value = next
}
/** 合併後試算:商品 / 運費 / 點數折抵 / 優惠券折抵 / 總計 */
const mergeSummary = computed(() => {
  const subtotal = mergeSelectedOrders.value.reduce((s, o) => s + o.amount, 0)
  const shippingFee = mergeForm.value.shippingFee
  const pointsDiscount = 0
  const couponDiscount = mergeSelectedOrders.value
    .filter((o) => mergeCouponSelected.value.has(o.id))
    .reduce((s, o) => s + (o.couponDiscount ?? 0), 0)
  const total = subtotal + shippingFee - pointsDiscount - couponDiscount
  return { subtotal, shippingFee, pointsDiscount, couponDiscount, total }
})
/** 合併後可得紅利點數合計 */
const mergePointsEarnedTotal = computed(() =>
  mergeSelectedOrders.value.reduce((s, o) => s + Math.floor(o.amount / 100), 0),
)
function confirmMerge(): void {
  // 破壞性動作:原訂單會被作廢、未勾選的優惠券自動退回;需二次確認,預設焦點在「取消」
  confirm.require({
    header: '確認合併訂單?',
    message: `即將把 ${mergeSelectedOrders.value.length} 筆訂單合併為 1 筆,原訂單會作廢,未勾選的優惠券會退回客人帳號。此動作無法復原,確定執行?`,
    icon: 'pi pi-exclamation-triangle',
    defaultFocus: 'reject',
    rejectProps: { label: '取消', severity: 'secondary', outlined: true },
    acceptProps: { label: '確認合併', severity: 'danger' },
    accept: () => {
      toast.add({
        severity: 'success',
        summary: '合併訂單完成',
        detail: `${mergeSelectedOrders.value.length} 筆訂單合併為 1 筆,總計 $${mergeSummary.value.total.toLocaleString()}`,
        life: 2500,
      })
      mergeDialogVisible.value = false
    },
  })
}
/** 買家姓名頭像:取名字第一個中文字 */
function buyerAvatarChar(name: string): string {
  return name.slice(0, 1)
}

/** 手動檢查合併條件:多行訂單號輸入 */
const manualCheckInput = ref('')
function manualCheck(): void {
  const nos = manualCheckInput.value
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
  toast.add({
    severity: 'info',
    summary: '手動檢查',
    detail: `已檢查 ${nos.length} 筆訂單號,結果請見下方分組`,
    life: 2500,
  })
}

/** 出貨狀態進度條 5 階段（待出貨 → 備貨中 → 已出貨 → 已送達 → 已完成）。 */
interface ProgressStep { key: OrderRow['shippingStatus']; label: string }
const PROGRESS_STEPS: ProgressStep[] = [
  { key: 'pending',   label: '待出貨' },
  { key: 'preparing', label: '備貨中' },
  { key: 'shipping',  label: '已出貨' },
  { key: 'arrived',   label: '已送達' },
  { key: 'completed', label: '已完成' },
]
/**
 * 終止狀態同樣走進度條,並「取代最後一站(已完成)」:退貨中 / 已退貨 / 已換貨 / 已取消。
 * 這些狀態都視同走到最後一站(滿條),只是最後一站改顯示對應終態文字。
 */
const LAST_STEP_OVERRIDE: Partial<Record<OrderRow['shippingStatus'], string>> = {
  returning:   '退貨中',
  return_done: '已退貨',
  exchanged:   '已換貨',
  cancelled:   '已取消',
}
/** 訂單目前在進度條的 index（終態取代已完成 → 最後一站;找不到 → 視為第一階段）。 */
function currentStepIndex(s: OrderRow['shippingStatus']): number {
  if (LAST_STEP_OVERRIDE[s]) return PROGRESS_STEPS.length - 1
  const i = PROGRESS_STEPS.findIndex(x => x.key === s)
  return i === -1 ? 0 : i
}
/** 把 PROGRESS_STEPS 變成 Timeline 用的資料：附加 isCurrent / isPast；終態改寫最後一站文字。 */
interface ProgressItem extends ProgressStep { isCurrent: boolean; isPast: boolean }
function progressItemsFor(s: OrderRow['shippingStatus']): ProgressItem[] {
  const idx = currentStepIndex(s)
  const override = LAST_STEP_OVERRIDE[s]
  const lastIdx = PROGRESS_STEPS.length - 1
  return PROGRESS_STEPS.map((step, i) => ({
    ...step,
    label: i === lastIdx && override ? override : step.label,
    isCurrent: i === idx,
    isPast: i < idx,
  }))
}
/** 是否走進度條(含終態取代已完成);否則(如配送異常)顯示 Tag。 */
function isShippingProgress(s: OrderRow['shippingStatus']): boolean {
  return PROGRESS_STEPS.some(x => x.key === s) || !!LAST_STEP_OVERRIDE[s]
}
</script>

<template>
  <div class="flex flex-col gap-4 flex-1 min-h-0">

    <!-- 頁首：標題 + 麵包屑，獨立一行（卡片外，見 design.md §6.7） -->
    <div class="flex flex-wrap items-center gap-3">
      <div class="flex items-center gap-2">
        <h1 class="text-2xl font-bold text-neutral-700 dark:text-neutral-100">訂單管理</h1>
        <button
          v-tooltip.top="'手動刷新訂單資訊'"
          aria-label="手動刷新訂單資訊"
          class="size-[28px] flex items-center justify-center rounded-full hover:bg-[var(--p-primary-50)]"
          style="color: var(--p-primary-color)"
          @click="onRefresh"
        >
          <i class="pi pi-sync" style="font-size: 15px"></i>
        </button>
      </div>
      <div class="ml-auto flex items-center gap-2 text-sm">
        <span class="text-color-secondary">訂單管理</span>
        <i class="pi pi-chevron-right text-color-secondary" style="font-size: 10px"></i>
        <span class="text-primary cursor-default">訂單列表</span>
      </div>
    </div>

    <!-- ── 篩選 Card：副標 + 右側批次操作 + 搜尋 / 篩選 — shrink-0 鎖內容高度，不隨 viewport 壓縮 ── -->
    <Card
      :pt="{
        root: { class: 'w-full shrink-0 overflow-hidden' },
        body: { class: 'p-0' },
        content: { class: 'p-0' },
      }"
    >
      <template #content>
        <!-- 副標 + 右側批次操作(標題與麵包屑已移至卡片外頁首列) -->
        <div class="flex items-start justify-between gap-3 px-5 pt-5 pb-2 flex-wrap">
          <p class="text-sm text-[var(--p-text-muted-color)]">
            查看與管理所有來自商城與直播的訂單，可篩選狀態、查詢訂單編號或買家姓名。
          </p>
          <div class="flex items-center gap-2 flex-wrap">
            <Button
              label="批次作業"
              icon="pi pi-chevron-down"
              icon-pos="right"
              severity="secondary"
              variant="outlined"
              aria-haspopup="true"
              aria-controls="batch-menu"
              @click="openBatchMenu"
            />
            <Menu ref="batchMenuRef" id="batch-menu" :model="batchMenuItems" :popup="true">
              <template #start>
                <div class="px-3 py-2 text-xs text-[var(--p-text-muted-color)]">選擇批次動作</div>
              </template>
            </Menu>
            <!-- 合併訂單:先隱藏(功能暫緩) -->
            <Button
              v-if="false"
              severity="secondary"
              variant="outlined"
              :disabled="mergeableOrderCount === 0"
              @click="openMergeDialog"
            >
              <i class="pi pi-link mr-2" style="font-size: 13px"></i>
              <span>合併訂單</span>
              <Badge
                v-if="mergeableOrderCount > 0"
                :value="mergeableOrderCount"
                severity="danger"
                class="ml-2"
              />
            </Button>
            <Button label="預設配送設定" severity="secondary" variant="outlined" @click="defaultShippingConfigDialogVisible = true" />
            <Button
              label="匯出 CSV"
              icon="pi pi-file-export"
              severity="secondary"
              variant="outlined"
              aria-haspopup="true"
              aria-controls="export-menu"
              @click="toggleExportMenu"
            />
            <Menu ref="exportMenuRef" id="export-menu" :model="exportMenuItems" :popup="true">
              <!-- 未達匯出條件時的警告（Menu #start 插槽） -->
              <template #start>
                <Message v-if="!canExport" severity="warn" :closable="false" size="small" class="mx-2 my-2">
                  尚未套用任何篩選，也未勾選訂單。請先套用篩選條件或至少勾選一筆再匯出。
                </Message>
              </template>
              <!-- 權限提示（Menu #end 插槽） -->
              <template #end>
                <div class="mt-1 pt-2 border-t border-[var(--p-content-border-color)] flex items-center gap-1 px-3 py-2 text-xs text-[var(--p-text-muted-color)]">
                  <i class="pi pi-info-circle"></i>
                  此功能受權限控制
                </div>
              </template>
            </Menu>
          </div>
        </div>

        <!-- 搜尋 + 日期區間 + 快速日期 -->
        <div class="flex items-center gap-3 px-5 py-3 flex-wrap">
          <InputText v-model="keyword" placeholder="搜尋訂單編號 / 買家姓名" class="!w-[260px]" />

          <!-- 日期區間：PrimeVue DatePicker range 模式 -->
          <DatePicker
            v-model="dateRange"
            selection-mode="range"
            show-icon
            date-format="yy-mm-dd"
            placeholder="年 / 月 / 日  至  年 / 月 / 日"
            class="!w-[320px]"
          />

          <div class="flex items-center gap-2">
            <Button label="今日"     severity="secondary" variant="outlined" size="small" @click="setDateRangePreset('today')" />
            <Button label="近 7 天"  severity="secondary" variant="outlined" size="small" @click="setDateRangePreset('last7')" />
            <Button label="本月"     severity="secondary" variant="outlined" size="small" @click="setDateRangePreset('thisMonth')" />
            <Button label="上月"     severity="secondary" variant="outlined" size="small" @click="setDateRangePreset('lastMonth')" />
          </div>

          <!-- 搜尋:訂單關鍵字 / 日期查詢的主按鈕,緊接快速日期鈕;commit 所有已填條件並套用 -->
          <Button label="搜尋" class="shrink-0" @click="onApplyFilters" />
        </div>

        <!-- 進階搜尋 / 精準搜尋 toggle:同一列,各自獨立展開下方內容 -->
        <div class="px-5 py-2 flex items-center gap-6 flex-wrap">
          <button
            type="button"
            class="inline-flex items-center gap-2 text-sm text-[var(--p-text-color)] hover:text-[var(--p-primary-color)]"
            @click="advancedFilterExpanded = !advancedFilterExpanded"
          >
            <span class="font-medium">進階搜尋</span>
            <span
              v-if="appliedAdvancedCount > 0"
              class="bg-[var(--p-primary-color)] text-white text-xs font-bold leading-none rounded-full min-w-[16px] h-[16px] px-1 inline-flex items-center justify-center"
            >{{ appliedAdvancedCount }}</span>
            <i :class="advancedFilterExpanded ? 'pi pi-chevron-up' : 'pi pi-chevron-down'" style="font-size: 11px"></i>
          </button>
          <button
            type="button"
            class="inline-flex items-center gap-2 text-sm text-[var(--p-text-color)] hover:text-[var(--p-primary-color)]"
            @click="precisionExpanded = !precisionExpanded"
          >
            <span class="font-medium">精準搜尋</span>
            <span
              v-if="appliedPrecisionCount > 0"
              class="bg-[var(--p-primary-color)] text-white text-xs font-bold leading-none rounded-full min-w-[16px] h-[16px] px-1 inline-flex items-center justify-center"
            >{{ appliedPrecisionCount }}</span>
            <i :class="precisionExpanded ? 'pi pi-chevron-up' : 'pi pi-chevron-down'" style="font-size: 11px"></i>
          </button>
        </div>

        <!-- 進階搜尋展開區:各 Select + 清除 / 搜尋 -->
        <div v-if="advancedFilterExpanded" class="flex flex-col gap-2 px-5 pb-3">
          <!-- 既有 Select 群 -->
          <div class="adv-filters flex items-center gap-2 flex-wrap">
          <MultiSelect v-model="filterOrderStatus"   :options="ORDER_STATUS_OPTIONS"  option-label="label" option-value="value" placeholder="訂單狀態" :max-selected-labels="0" :show-toggle-all="false" class="!w-[156px]">
            <template #value="{ value }"><span class="inline-flex items-center gap-2">訂單狀態<Badge v-if="value?.length" :value="value.length" /></span></template>
          </MultiSelect>
          <MultiSelect v-model="filterShipping"      :options="shippingMethodOptions" option-label="label" option-value="value" placeholder="出貨方式" :max-selected-labels="0" :show-toggle-all="false" class="!w-[156px]">
            <template #value="{ value }"><span class="inline-flex items-center gap-2">出貨方式<Badge v-if="value?.length" :value="value.length" /></span></template>
          </MultiSelect>
          <MultiSelect v-model="filterShippingStatus" :options="shippingStatusOptions" option-label="label" option-value="value" placeholder="出貨狀態" :max-selected-labels="0" :show-toggle-all="false" scroll-height="auto" class="!w-[156px]">
            <template #value="{ value }"><span class="inline-flex items-center gap-2">出貨狀態<Badge v-if="value?.length" :value="value.length" /></span></template>
          </MultiSelect>
          <MultiSelect v-model="filterCarrier"       :options="carrierOptionGroups"   option-label="label" option-value="value" option-group-label="group" option-group-children="items" placeholder="物流商" :max-selected-labels="0" :show-toggle-all="false" class="!w-[156px]">
            <template #value="{ value }"><span class="inline-flex items-center gap-2">物流商<Badge v-if="value?.length" :value="value.length" /></span></template>
          </MultiSelect>
          <MultiSelect v-model="filterTracking"      :options="trackingStatusOptions" option-label="label" option-value="value" placeholder="取號狀態" :max-selected-labels="0" :show-toggle-all="false" class="!w-[156px]">
            <template #value="{ value }"><span class="inline-flex items-center gap-2">取號狀態<Badge v-if="value?.length" :value="value.length" /></span></template>
          </MultiSelect>
          <MultiSelect v-model="filterPaymentMethod" :options="paymentMethodOptions"  option-label="label" option-value="value" placeholder="付款方式" :max-selected-labels="0" :show-toggle-all="false" scroll-height="auto" class="!w-[156px]">
            <template #value="{ value }"><span class="inline-flex items-center gap-2">付款方式<Badge v-if="value?.length" :value="value.length" /></span></template>
          </MultiSelect>
          <MultiSelect v-model="filterPayment"       :options="paymentStatusOptions"  option-label="label" option-value="value" placeholder="付款狀態" :max-selected-labels="0" :show-toggle-all="false" scroll-height="auto" class="!w-[156px]">
            <template #value="{ value }"><span class="inline-flex items-center gap-2">付款狀態<Badge v-if="value?.length" :value="value.length" /></span></template>
          </MultiSelect>
          <MultiSelect v-model="filterOrderSource"   :options="orderSourceOptions"    option-label="label" option-value="value" placeholder="訂單來源" :max-selected-labels="0" :show-toggle-all="false" class="!w-[156px]">
            <template #value="{ value }"><span class="inline-flex items-center gap-2">訂單來源<Badge v-if="value?.length" :value="value.length" /></span></template>
          </MultiSelect>
          <MultiSelect v-model="filterSocialPlatform" :options="socialPlatformOptions" option-label="label" option-value="value" placeholder="社群平台" :max-selected-labels="0" :show-toggle-all="false" class="!w-[156px]">
            <template #value="{ value }"><span class="inline-flex items-center gap-2">社群平台<Badge v-if="value?.length" :value="value.length" /></span></template>
          </MultiSelect>
          <MultiSelect v-model="filterMultiCart"     :options="multiCartOptions"      option-label="label" option-value="value" placeholder="多購物車" :max-selected-labels="0" :show-toggle-all="false" class="!w-[156px]">
            <template #value="{ value }"><span class="inline-flex items-center gap-2">多購物車<Badge v-if="value?.length" :value="value.length" /></span></template>
          </MultiSelect>
          <MultiSelect v-model="filterSessionName"   :options="sessionNameOptions"    option-label="label" option-value="value" placeholder="場次名稱" :max-selected-labels="0" :show-toggle-all="false" class="!w-[156px]">
            <template #value="{ value }"><span class="inline-flex items-center gap-2">場次名稱<Badge v-if="value?.length" :value="value.length" /></span></template>
          </MultiSelect>
          <!-- 進階搜尋自己的 清除 / 套用:清除只清進階條件,套用 commit 全部條件並查詢 -->
          <Button label="清除" severity="secondary" variant="outlined" class="shrink-0" @click="clearAdvancedFilters" />
          <Button label="套用" class="shrink-0" @click="onApplyFilters" />
          </div>
        </div>

        <!-- 精準搜尋展開區:toggle 已移至上方與進階搜尋同列;展開後有獨立「套用」再觸發一次搜尋 -->
        <div v-if="precisionExpanded" class="px-5 pb-3 flex items-stretch gap-2 flex-wrap">
          <Select
            v-model="filterPrecisionField"
            :options="precisionFieldOptions"
            option-label="label"
            option-value="value"
            class="!w-[200px]"
            scroll-height="auto"
          />
          <InputText
            v-model="filterPrecisionValue"
            :placeholder="precisionPlaceholder"
            class="flex-1 min-w-[240px]"
            @keyup.enter="onApplyFilters"
          />
          <Button label="套用" class="shrink-0" @click="onApplyFilters" />
        </div>

        <!-- 快速篩選 chips + 搜尋按鈕 + 總筆數 -->
        <div class="flex items-center justify-between gap-3 px-5 py-2 flex-wrap">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-sm text-[var(--p-text-muted-color)] shrink-0 mr-1">快速篩選</span>
            <!-- 訂單狀態快速篩選：異常處理(帶數量 badge)、待處理；點選中的 chip 或其 ✕ 可清除回全部 -->
            <button
              v-for="q in orderStatusQuickFilters"
              :key="q.value"
              class="inline-flex items-center gap-2 px-3 py-2 rounded-full text-sm border transition-colors"
              :style="quickFilter === q.value
                ? 'background: var(--p-primary-50); color: var(--p-primary-color); border-color: var(--p-primary-color)'
                : 'background: var(--p-content-background); color: var(--p-text-muted-color); border-color: var(--p-content-border-color)'"
              @click="quickFilter = quickFilter === q.value ? 'all' : q.value"
            >
              {{ q.label }}
              <Tag v-if="q.showCount" :value="String(orderStatusCounts[q.statusKey])" severity="danger" class="!py-0 !px-1.5 !text-xs !leading-tight" />
              <i v-if="quickFilter === q.value" class="pi pi-times text-xs" @click.stop="quickFilter = 'all'"></i>
            </button>
            <span
              class="w-px h-5 mx-1 shrink-0"
              :style="{ background: 'var(--p-content-border-color)' }"
              aria-hidden="true"
            />
            <template v-for="q in quickFilters" :key="q.value">
              <span
                v-if="q.value === 'paid'"
                class="w-px h-5 mx-1 shrink-0"
                :style="{ background: 'var(--p-content-border-color)' }"
                aria-hidden="true"
              />
              <button
                class="inline-flex items-center gap-2 px-3 py-2 rounded-full text-sm border transition-colors"
                :style="quickFilter === q.value
                  ? 'background: var(--p-primary-50); color: var(--p-primary-color); border-color: var(--p-primary-color)'
                  : 'background: var(--p-content-background); color: var(--p-text-muted-color); border-color: var(--p-content-border-color)'"
                @click="quickFilter = quickFilter === q.value ? 'all' : q.value"
              >
                {{ q.label }}
                <i v-if="quickFilter === q.value" class="pi pi-times text-xs" @click.stop="quickFilter = 'all'"></i>
              </button>
            </template>
          </div>
          <span class="text-sm text-[var(--p-text-muted-color)]">
            共 <span class="text-[var(--p-text-color)] font-bold">{{ filtered.length }}</span> 筆訂單
          </span>
        </div>

      </template>
    </Card>

    <!-- ── 表格 Card:高度依內容自然撐開,不鎖 flex 高度 ── -->
    <Card
      :pt="{
        root: { class: 'w-full shrink-0 overflow-hidden' },
        body: { class: 'p-0' },
        content: { class: 'p-0' },
      }"
    >
      <template #content>
        <div class="p-5 relative">
          <!-- Loading 蓋層：用 PrimeVue 標準 ProgressSpinner，不走品牌 logo 動畫 -->
          <div
            v-if="isLoading"
            class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[var(--p-content-background)]/85 backdrop-blur-sm rounded-lg"
          >
            <ProgressSpinner style="width: 48px; height: 48px" stroke-width="4" animation-duration=".9s" />
            <span class="text-sm text-[var(--p-text-muted-color)]">載入中…</span>
          </div>

          <!-- 批次作業模式 banner(取號/印標共用):提示已選/可選數 + 全選/下一步/取消 -->
          <div
            v-if="batchMode && activeBatchConfig"
            class="mb-3 rounded-md border border-[var(--p-primary-color)] bg-[var(--p-primary-50)] px-4 py-3 flex items-center justify-between gap-3 flex-wrap"
          >
            <div class="flex items-center gap-3 flex-wrap">
              <span class="font-medium text-[var(--p-primary-color)]">{{ activeBatchConfig.bannerTitle }}</span>
              <span class="text-sm text-[var(--p-text-color)]">
                已選 <span class="font-bold">{{ selectedForBatch.size }}</span> 筆 ·
                可選 <span class="font-bold">{{ batchSelectableCount }}</span> 筆(依目前篩選)
              </span>
            </div>
            <div class="flex items-center gap-2 flex-wrap">
              <Button
                :label="activeBatchConfig.nextStepLabel"
                :disabled="selectedForBatch.size === 0"
                @click="openBatchConfirmDialog"
              />
              <Button
                label="取消"
                severity="secondary"
                variant="text"
                @click="exitBatchMode"
              />
            </div>
          </div>

          <div ref="tableScrollWrap" class="relative">
          <DataTable
            :value="filtered"
            :striped-rows="true"
            scrollable
            data-key="id"
            class="w-full order-main-table"
            paginator
            :rows="20"
            :rows-per-page-options="[10, 20, 50, 100]"
            current-page-report-template="{first} - {last} / 共 {totalRecords} 筆"
            paginator-template="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown CurrentPageReport"
            :pt="{
              column: {
                headerCell: { style: 'white-space: nowrap;' },
                bodyCell:   { style: 'white-space: nowrap;' },
              },
            }"
          >
          <!-- 批次作業模式勾選欄:只有符合當下作業條件的訂單可勾;不可勾者顯示 dash;header 為全選 -->
          <Column v-if="batchMode" style="width: 48px" frozen>
            <template #header>
              <Checkbox
                :model-value="allSelectableSelected"
                binary
                :disabled="batchSelectableCount === 0"
                @update:model-value="toggleSelectAllSelectable"
              />
            </template>
            <template #body="{ data }">
              <Checkbox
                v-if="isBatchSelectable(data)"
                :model-value="selectedForBatch.has(data.id)"
                binary
                @update:model-value="toggleRowSelection(data.id)"
              />
              <span v-else class="text-[var(--p-text-muted-color)]">—</span>
            </template>
          </Column>

          <Column header="建立時間" field="createdAt" sortable>
            <template #body="{ data }">
              <span class="text-[var(--p-text-color)]">{{ data.createdAt }}</span>
            </template>
          </Column>

          <Column header="購物車 / 訂單編號">
            <template #body="{ data }">
              <div class="flex flex-col gap-1">
                <div class="flex items-center gap-2 flex-wrap">
                  <Tag
                    :value="data.cartTag.label"
                    :pt="{ root: { style: { background: data.cartTag.bg, color: data.cartTag.color } } }"
                  />
                  <!-- 已分批 N 批 tag:分批出貨功能先隱藏(移除 false 即恢復) -->
                  <Tag
                    v-if="false && (data.dispatchBatchCount ?? 0) > 0"
                    :value="`已分批 ${data.dispatchBatchCount} 批`"
                    severity="info"
                  />
                </div>
                <div class="flex items-center gap-2">
                  <span class="font-medium text-[var(--p-text-color)]">{{ data.orderNo }}</span>
                  <Button
                    v-tooltip.top="'複製'"
                    :aria-label="`複製訂單編號 ${data.orderNo}`"
                    icon="pi pi-copy"
                    severity="secondary"
                    variant="text"
                    size="small"
                    rounded
                    @click="onCopyOrderNo(data.orderNo)"
                  />
                </div>
              </div>
            </template>
          </Column>

          <Column header="訂購人">
            <template #body="{ data }">
              <div class="flex flex-col gap-1">
                <span class="text-[var(--p-text-color)]">{{ data.buyerName }}</span>
                <span class="text-xs text-[var(--p-text-muted-color)]">{{ data.buyerPhone }}</span>
              </div>
            </template>
          </Column>

          <Column header="訂單狀態">
            <template #body="{ data }">
              <!-- 異常處理:tag 內文字後加驚嘆號,hover 顯示異常原因 -->
              <Tag
                v-if="orderAbnormalReason(data)"
                :severity="orderRowStatusMeta(data).severity"
                class="cursor-help"
                v-tooltip.top="orderAbnormalReason(data)"
              >
                <span class="inline-flex items-center gap-1">
                  {{ orderRowStatusMeta(data).label }}
                  <i class="pi pi-exclamation-circle text-xs"></i>
                </span>
              </Tag>
              <Tag v-else :value="orderRowStatusMeta(data).label" :severity="orderRowStatusMeta(data).severity" />
            </template>
          </Column>

          <Column header="金額" field="amount" sortable body-class="text-right" header-class="text-right">
            <template #body="{ data }">
              <span class="text-[var(--p-primary-color)]">${{ data.amount.toLocaleString() }}</span>
            </template>
          </Column>

          <Column header="商品數量" field="itemCount" sortable body-class="text-right" header-class="text-right">
            <template #body="{ data }">
              <span class="text-[var(--p-text-color)]">{{ data.itemCount }}</span>
            </template>
          </Column>

          <Column header="出貨方式">
            <template #body="{ data }">
              <span class="inline-flex items-center gap-2 text-[var(--p-text-color)]">
                <i class="pi pi-truck" style="font-size: 13px; color: var(--p-text-muted-color)"></i>
                {{ data.shippingMethod }}
              </span>
            </template>
          </Column>

          <Column header="付款狀態">
            <template #body="{ data }">
              <!-- 編輯模式：Select + 打勾 / 取消 -->
              <span v-if="editingPaymentRowId === data.id" class="inline-flex items-center gap-1" @click.stop>
                <Select
                  v-model="editPaymentValueMap[data.id]"
                  :options="paymentEditOptions"
                  option-label="label"
                  option-value="value"
                  size="small"
                  class="!w-[110px]"
                  scroll-height="auto"
                />
                <Button v-tooltip.top="'確認'" aria-label="確認付款狀態" icon="pi pi-check" severity="secondary" variant="text" size="small" rounded @click="commitPayment(data, $event)" />
                <Button v-tooltip.top="'取消'" aria-label="取消編輯" icon="pi pi-times" severity="secondary" variant="text" size="small" rounded @click="cancelEditPayment" />
              </span>
              <!-- 檢視模式：Tag 可直接點按進編輯 -->
              <button
                v-else
                type="button"
                class="inline-flex items-center gap-1 cursor-pointer"
                v-tooltip.top="'點擊修改'"
                aria-label="修改付款狀態"
                @click="startEditPayment(data, $event)"
              >
                <Tag
                  :value="paymentTagMeta(data.paymentStatus).label"
                  :severity="paymentTagMeta(data.paymentStatus).severity"
                />
                <i class="pi pi-pencil text-xs text-[var(--p-text-muted-color)]"></i>
              </button>
            </template>
          </Column>

          <Column header="出貨狀態">
            <template #body="{ data }">
              <!-- 配送異常:tag 內文字後加驚嘆號,hover 顯示物流商回報的異常原因 -->
              <Tag
                v-if="data.shippingStatus === 'delivery_abnormal'"
                :severity="shippingStatusTagMeta(data.shippingStatus).severity"
                class="cursor-help"
                v-tooltip.top="data.abnormalReason ?? '物流回報配送異常'"
              >
                <span class="inline-flex items-center gap-1">
                  {{ shippingStatusTagMeta(data.shippingStatus).label }}
                  <i class="pi pi-exclamation-circle text-xs"></i>
                </span>
              </Tag>
              <!-- 其餘終止狀態(已取消 / 退換貨):只顯示 tag,不顯示進度條 -->
              <Tag
                v-else-if="!isShippingProgress(data.shippingStatus)"
                :value="shippingStatusTagMeta(data.shippingStatus).label"
                :severity="shippingStatusTagMeta(data.shippingStatus).severity"
              />
              <!-- PrimeVue Timeline 顯示 5 階段,水平排列,目前階段主色加粗 -->
              <Timeline
                v-else
                :value="progressItemsFor(data.shippingStatus)"
                layout="horizontal"
                align="top"
                class="order-shipping-timeline min-w-[260px]"
              >
                <template #marker="{ item }">
                  <span
                    class="rounded-full shrink-0"
                    :style="{
                      width: item.isCurrent ? '12px' : '8px',
                      height: item.isCurrent ? '12px' : '8px',
                      background: item.isCurrent ? 'var(--p-primary-color)' : 'var(--p-content-border-color)',
                    }"
                  ></span>
                </template>
                <template #content="{ item }">
                  <span
                    class="text-xs whitespace-nowrap pt-1.5 pr-2"
                    :style="item.isCurrent
                      ? 'color: var(--p-primary-color); font-weight: 600'
                      : 'color: var(--p-text-muted-color)'"
                  >{{ item.label }}</span>
                </template>
                <template #connector>
                  <span class="block h-px w-full" style="background: var(--p-content-border-color)"></span>
                </template>
              </Timeline>
            </template>
          </Column>

          <Column header="物流商資訊">
            <template #body="{ data }">
              <!-- 已設定：只顯示物流商名稱（取號另在「取號狀態」欄顯示）；未設定：設定配送按鈕 -->
              <span v-if="data.carrierStatus === 'configured'" class="inline-flex items-center gap-2 text-[var(--p-text-color)]">
                <i class="pi pi-truck text-[var(--p-primary-color)] text-sm"></i>
                <span class="font-medium">{{ data.carrierName }}</span>
              </span>
              <Button v-else label="設定配送" icon="pi pi-truck" size="small" @click="openShippingConfig(data, $event)" />
            </template>
          </Column>

          <Column header="取號狀態">
            <template #body="{ data }">
              <!-- 有取號 → 綠色「已取號」;已啟用物流商但沒取號 → 黃色「未取號」;未啟用 → dash -->
              <Tag v-if="data.trackingStatus" value="已取號" severity="success" />
              <Tag v-else-if="data.carrierStatus === 'configured'" value="未取號" severity="warn" />
              <span v-else class="text-[var(--p-text-muted-color)]">—</span>
            </template>
          </Column>

          <Column
            header="操作"
            frozen
            align-frozen="right"
            header-class="text-right"
            body-class="text-right"
          >
            <template #body="{ data }">
              <div class="flex items-center justify-end gap-1">
                <Button
                  v-tooltip.top="'出貨單列印'"
                  aria-label="出貨單列印"
                  icon="pi pi-print"
                  severity="secondary"
                  variant="text"
                  size="small"
                  rounded
                  @click="openPrintDialog(data, $event)"
                />
                <span class="relative inline-flex">
                  <Button
                    v-tooltip.top="labelPrintedIds.has(data.id) ? '標籤已列印（可重印）' : '標籤列印'"
                    :aria-label="labelPrintedIds.has(data.id) ? '標籤已列印（可重印）' : '標籤列印'"
                    icon="pi pi-tag"
                    severity="secondary"
                    variant="text"
                    size="small"
                    rounded
                    @click="onPrintLabel(data, $event)"
                  />
                  <i
                    v-if="labelPrintedIds.has(data.id)"
                    class="pi pi-check-circle absolute -top-0.5 -right-0.5 text-green-600 dark:text-green-400 pointer-events-none"
                    style="font-size: 13px; background: var(--p-content-background); border-radius: 9999px"
                  ></i>
                </span>
                <span class="relative inline-flex">
                  <Button
                    v-tooltip.top="invoiceActionMeta(data).tooltip"
                    :aria-label="invoiceActionMeta(data).tooltip"
                    icon="pi pi-file"
                    :severity="invoiceActionMeta(data).severity"
                    variant="text"
                    size="small"
                    rounded
                    @click="openIssueInvoice(data, $event)"
                  />
                  <i
                    v-if="invoiceActionMeta(data).issued"
                    class="pi pi-check-circle absolute -top-0.5 -right-0.5 text-green-600 dark:text-green-400 pointer-events-none"
                    style="font-size: 13px; background: var(--p-content-background); border-radius: 9999px"
                  ></i>
                </span>
                <Button
                  v-tooltip.top="'查看更多'"
                  aria-label="查看訂單詳情"
                  icon="pi pi-eye"
                  severity="secondary"
                  variant="text"
                  size="small"
                  rounded
                  @click="openDetailDialog(data)"
                />
              </div>
            </template>
          </Column>

          <template #empty>
            <div class="py-12 text-center text-sm text-[var(--p-text-muted-color)]">
              目前無訂單。
            </div>
          </template>
          </DataTable>

          <!-- 左側捲動提示：已向右捲動時出現，點擊往回捲 -->
          <div
            v-show="canScrollLeft"
            class="pointer-events-none absolute z-10 flex items-start justify-start pl-1"
            :style="{ top: overlayTop + 'px', height: overlayHeight + 'px', left: '0px', width: '56px', background: 'linear-gradient(to left, transparent, var(--p-content-background))' }"
          >
            <button
              type="button"
              class="pointer-events-auto mt-3 size-7 rounded-full bg-[var(--p-content-background)] border border-[var(--p-content-border-color)] shadow flex items-center justify-center text-[var(--p-text-color)] hover:bg-[var(--p-content-hover-background)]"
              aria-label="向左捲動"
              @click="scrollTableBy(-1)"
            >
              <i class="pi pi-chevron-left" style="font-size: 12px"></i>
            </button>
          </div>

          <!-- 右側捲動提示：資料尚未捲到底時出現，貼在固定操作欄左側，點擊往右捲看更多欄位 -->
          <div
            v-show="canScrollRight"
            class="pointer-events-none absolute z-10 flex items-start justify-end pr-1"
            :style="{ top: overlayTop + 'px', height: overlayHeight + 'px', right: frozenColWidth + 'px', width: '56px', background: 'linear-gradient(to right, transparent, var(--p-content-background))' }"
          >
            <button
              type="button"
              class="pointer-events-auto mt-3 size-7 rounded-full bg-[var(--p-content-background)] border border-[var(--p-content-border-color)] shadow flex items-center justify-center text-[var(--p-text-color)] hover:bg-[var(--p-content-hover-background)]"
              aria-label="向右捲動查看更多欄位"
              @click="scrollTableBy(1)"
            >
              <i class="pi pi-chevron-right" style="font-size: 12px"></i>
            </button>
          </div>
          </div>
        </div>
      </template>
    </Card>

    <!-- 「查看更多」彈窗：點訂單列眼睛 icon 開啟，顯示 OrderRowDetail 完整資訊 -->
    <Dialog
      v-model:visible="detailDialogVisible"
      modal
      :draggable="false"
      :header="detailDialogOrder ? `訂單 ${detailDialogOrder.orderNo}` : '訂單詳情'"
      :style="{ width: 'min(1200px, calc(100vw - 32px))' }"
      :pt="{ content: { style: 'padding: 0' } }"
    >
      <OrderRowDetail v-if="detailDialogOrder" :order="detailDialogOrder" @open-split-page="openSplitPage" />
      <!-- footer：取消訂單獨立靠左（destructive 動作分區）；右側維持取消/儲存 -->
      <template #footer>
        <div class="flex items-center justify-between gap-2 w-full">
          <!-- 不可取消時按鈕呈 disabled 樣式,但仍可點按 → 跳「此訂單無法取消」提示 -->
          <Button
            label="取消訂單"
            icon="pi pi-ban"
            :severity="canCancelOrder ? 'danger' : 'secondary'"
            variant="outlined"
            :class="canCancelOrder ? '' : 'opacity-50'"
            @click="openCancelOrderDialog"
          />
          <div class="flex items-center gap-2">
            <Button label="取消" severity="secondary" variant="outlined" @click="detailDialogVisible = false" />
            <Button label="儲存" @click="saveDetailDialog" />
          </div>
        </div>
      </template>
    </Dialog>

    <!-- 取消訂單確認彈窗 -->
    <CancelOrderDialog
      v-if="detailDialogOrder"
      v-model:visible="cancelOrderDialogVisible"
      :order-no="detailDialogOrder.orderNo"
      :amount="detailDialogOrder.amount"
      :is-paid="detailDialogOrder.paymentStatus === 'paid'"
      @confirm="onCancelOrderConfirm"
    />

    <!-- 此訂單無法取消提示彈窗 -->
    <Dialog
      v-model:visible="cancelBlockedDialogVisible"
      modal
      :draggable="false"
      :style="{ width: 'min(440px, calc(100vw - 32px))' }"
    >
      <template #header>
        <div class="flex items-center gap-3">
          <div class="size-10 shrink-0 rounded-full bg-yellow-100 dark:bg-yellow-950/40 flex items-center justify-center">
            <i class="pi pi-lock text-yellow-600 dark:text-yellow-400 text-lg"></i>
          </div>
          <div class="flex flex-col gap-1">
            <span class="text-base font-bold text-[var(--p-text-color)]">此訂單無法取消</span>
            <span v-if="detailDialogOrder" class="text-xs text-[var(--p-text-muted-color)]">
              訂單 {{ detailDialogOrder.orderNo }} · 目前貨態 {{ shippingStatusTagMeta(detailDialogOrder.shippingStatus).label }}
            </span>
          </div>
        </div>
      </template>
      <div v-if="detailDialogOrder" class="flex flex-col gap-3">
        <!-- 原因 -->
        <div class="rounded-md bg-[var(--p-content-hover-background)] px-3 py-2.5 flex flex-col gap-1">
          <span class="text-xs text-[var(--p-text-muted-color)]">原因</span>
          <span class="text-sm text-[var(--p-text-color)]">
            {{ cancelBlockedKind === 'completed'
              ? '此訂單目前為「已完成」,商品已送達買家手上。'
              : `此訂單已完成取號（${detailDialogOrder.trackingStatus ?? '—'}）,託運單號已經交付物流商。` }}
          </span>
        </div>
        <!-- 可以怎麼做 -->
        <div class="rounded-md border border-[var(--p-primary-200)] bg-[var(--p-primary-50)] px-3 py-2.5 flex flex-col gap-1">
          <span class="text-xs font-medium text-[var(--p-primary-color)]">可以怎麼做</span>
          <span class="text-sm text-[var(--p-primary-color)]">
            {{ cancelBlockedKind === 'completed'
              ? '已結案的訂單不再開放取消或編輯,後續請按「標記退貨」或「標記換貨」處理。'
              : '若需取消或編輯,請先至配送貨態頁執行「重新取號」,作廢原單號並退回至待出貨。' }}
          </span>
        </div>
      </div>
      <template #footer>
        <Button label="我知道了" @click="cancelBlockedDialogVisible = false" />
      </template>
    </Dialog>

    <!-- 分批出貨作業彈窗：從訂單詳情「分批出貨」開啟 -->
    <SplitShippingDialog
      v-if="splitDialogOrder"
      :visible="splitDialogVisible"
      :order="splitDialogOrder"
      @update:visible="onSplitDialogVisible"
    />

    <!-- 表格「設定配送」共用彈窗 -->
    <ShippingConfigDialog
      v-model:visible="shippingConfigDialogVisible"
      :order="shippingConfigOrder"
      @confirm="onShippingConfigConfirm"
    />

    <!-- 表格「開立發票」共用彈窗 -->
    <IssueInvoiceDialog
      v-model:visible="issueInvoiceDialogVisible"
      :order="issueInvoiceOrder"
      @confirm="onIssueInvoiceConfirm"
    />

<!-- 表格「出貨單列印」共用彈窗 -->
    <ShippingListPrintDialog v-model:visible="printDialogVisible" :order="printOrder" />

    <!-- 頁首「預設配送設定」彈窗 -->
    <DefaultShippingConfigDialog v-model:visible="defaultShippingConfigDialogVisible" />

    <!-- 合併訂單彈窗:分兩步 - list(選訂單) → editor(編輯合併資料) -->
    <Dialog
      v-model:visible="mergeDialogVisible"
      modal
      :draggable="false"
      :style="{ width: 'calc(100vw - 32px)' }"
      :pt="{ content: { style: 'padding: 0' } }"
    >
      <template #header>
        <div class="flex flex-col gap-1">
          <!-- 第一步:標題「合併訂單」+ 副標;第二步:← 返回 + 「合併 N 筆訂單」+ 來源訂單編號列 -->
          <template v-if="mergeStep === 'list'">
            <div class="flex items-center gap-2">
              <span class="text-lg font-bold text-[var(--p-text-color)]">合併訂單</span>
              <i
                class="pi pi-question-circle text-[var(--p-text-muted-color)] cursor-help"
                style="font-size: 14px"
                v-tooltip.top="'系統自動篩選出可合併的訂單(同買家、同址、同配送、同溫層、未取號)'"
              ></i>
            </div>
            <span class="text-xs text-[var(--p-text-muted-color)]">
              此頁面將自動篩選出同一購買人、同地址、同配送方式、同溫層,尚未取號之可合併訂單。
            </span>
          </template>
          <template v-else>
            <div class="flex items-center gap-2">
              <Button icon="pi pi-arrow-left" severity="secondary" variant="text" rounded @click="backToMergeList" />
              <span class="text-lg font-bold text-[var(--p-text-color)]">合併 {{ mergeSelectedOrders.length }} 筆訂單</span>
            </div>
            <span class="text-xs text-[var(--p-text-muted-color)] pl-11">
              來源:{{ mergeSelectedOrders.map(o => o.orderNo).join('、') }} · {{ mergeSelectedOrders[0]?.buyerName }}
            </span>
          </template>
        </div>
      </template>

      <div v-if="mergeStep === 'list'" class="flex flex-col gap-4 p-5">
        <!-- 手動檢查合併條件 accordion -->
        <Accordion>
          <AccordionPanel value="manual">
            <AccordionHeader>
              <div class="flex items-center gap-2">
                <i class="pi pi-file-edit text-[var(--p-primary-color)]" style="font-size: 14px"></i>
                <span class="font-medium text-[var(--p-text-color)]">手動檢查合併條件</span>
                <span class="text-xs text-[var(--p-text-muted-color)]">貼上訂單號 — 系統自動逐項判斷</span>
              </div>
            </AccordionHeader>
            <AccordionContent>
              <div class="flex items-start gap-3">
                <!-- 左側:Step 標籤 + label + textarea -->
                <div class="flex-1 flex flex-col gap-2">
                  <div class="flex items-center gap-2">
                    <Tag value="Step 1" severity="secondary" />
                    <span class="font-medium text-[var(--p-text-color)]">貼上訂單號</span>
                    <span class="text-xs text-[var(--p-text-muted-color)]">一行一筆或用逗號分隔</span>
                  </div>
                  <Textarea
                    v-model="manualCheckInput"
                    :rows="4"
                    class="w-full font-mono"
                    placeholder="020260628007&#10;020260628012&#10;020260628015"
                  />
                </div>
                <!-- 右側:檢查(主色) + 清除(secondary outlined) 垂直排 -->
                <div class="flex flex-col gap-2 shrink-0">
                  <Button label="檢查" @click="manualCheck" />
                  <Button label="清除" severity="secondary" variant="outlined" @click="manualCheckInput = ''" />
                </div>
              </div>
            </AccordionContent>
          </AccordionPanel>
        </Accordion>

        <!-- Groups:每組買家用 PrimeVue Panel;有其他 group 已選時,本 group 整組 disabled(合併限單一買家) -->
        <Panel
          v-for="g in mergeGroups"
          :key="g.key"
          :pt="{
            root: { class: isGroupSelectable(g) ? 'overflow-hidden' : 'overflow-hidden opacity-50' },
            header: { style: 'padding: 12px 16px; background: var(--p-content-hover-background)' },
            content: { style: 'padding: 0 16px 16px' },
          }"
        >
          <template #header>
            <div class="flex items-center gap-2">
              <span class="font-bold text-[var(--p-text-color)]">{{ g.buyer }}</span>
              <span class="text-sm text-[var(--p-text-muted-color)]">· {{ g.orders.length }} 筆訂單</span>
              <Tag v-if="!isGroupSelectable(g)" value="不同買家,無法一起合併" severity="secondary" class="ml-2" />
            </div>
          </template>
          <template #icons>
            <span class="text-sm text-[var(--p-text-color)]">
              合計 <span class="font-bold text-[var(--p-primary-color)]">${{ g.total.toLocaleString() }}</span>
            </span>
          </template>

          <!-- Group table:走 PrimeVue Aura 預設樣式 -->
          <DataTable :value="g.orders" data-key="id" :striped-rows="true">
            <Column style="width: 40px">
              <template #header>
                <Checkbox
                  :model-value="isGroupAllSelected(g)"
                  binary
                  :disabled="!isGroupSelectable(g)"
                  @update:model-value="toggleGroupAll(g)"
                />
              </template>
              <template #body="{ data }">
                <Checkbox
                  :model-value="mergeSelectedIds.has(data.id)"
                  binary
                  :disabled="!isGroupSelectable(g)"
                  @update:model-value="toggleMergeRow(data.id)"
                />
              </template>
            </Column>
            <Column header="訂單編號" field="orderNo">
              <template #body="{ data }"><span class="font-medium text-[var(--p-text-color)]">{{ data.orderNo }}</span></template>
            </Column>
            <Column header="建立時間" field="createdAt" />
            <Column header="商品摘要">
              <template #body="{ data }">{{ data.productSummary }}</template>
            </Column>
            <Column header="付款方式">
              <template #body="{ data }">{{ data.paymentMethodLabel ?? '—' }}</template>
            </Column>
            <Column header="付款狀態">
              <template #body="{ data }">
                <Tag
                  :value="paymentTagMeta(data.paymentStatus).label"
                  :severity="paymentTagMeta(data.paymentStatus).severity"
                />
              </template>
            </Column>
            <Column header="交易 ID">
              <template #body="{ data }">
                <span v-if="data.transactionId" class="text-[var(--p-text-color)]">{{ data.transactionId }}</span>
                <span v-else class="text-[var(--p-text-muted-color)]">—</span>
              </template>
            </Column>
            <Column header="出貨方式">
              <template #body="{ data }">
                <Tag :value="data.shippingMethod" severity="secondary" />
              </template>
            </Column>
            <Column header="收件地址">
              <template #body="{ data }"><span class="text-[var(--p-text-color)]">{{ data.receiverAddress }}</span></template>
            </Column>
            <Column header="金額" header-class="text-right" body-class="text-right">
              <template #body="{ data }"><span class="font-medium text-[var(--p-text-color)]">${{ data.amount.toLocaleString() }}</span></template>
            </Column>
          </DataTable>
        </Panel>
      </div>

      <!-- 第二步:合併編輯表單(對照 Design.md 7.8:label 上方、editor 下方 flex-col;max-width 960px 避免全滿版留白) -->
      <div v-else class="flex flex-col gap-4 p-5 mx-auto w-full max-w-[960px]">
        <div class="divide-y divide-[var(--p-content-border-color)] border border-[var(--p-content-border-color)] rounded-md">
          <!-- 付款方式(唯讀) -->
          <div class="flex flex-col gap-2 px-4 py-3">
            <label class="text-sm text-[var(--p-text-muted-color)]">付款方式</label>
            <div class="text-sm text-[var(--p-text-color)]">{{ mergeSelectedOrders[0]?.paymentMethodLabel ?? '—' }}</div>
          </div>
          <!-- 配送方式(唯讀) + 未指派物流商 warning tag + 指派連結 -->
          <div class="flex flex-col gap-2 px-4 py-3">
            <label class="text-sm text-[var(--p-text-muted-color)]">配送方式</label>
            <div class="flex items-center gap-2 flex-wrap text-sm text-[var(--p-text-color)]">
              <span>{{ mergeSelectedOrders[0]?.shippingMethod === '常溫宅配' ? '宅配' : mergeSelectedOrders[0]?.shippingMethod }}</span>
              <Tag value="未指派物流商" severity="warn" />
              <Button
                v-if="mergeSelectedOrders[0]"
                label="指派物流商"
                link
                size="small"
                @click="openShippingConfig(mergeSelectedOrders[0], $event)"
              />
            </div>
          </div>
          <!-- 訂購人(鎖 + tooltip) -->
          <div class="flex flex-col gap-2 px-4 py-3">
            <label class="text-sm text-[var(--p-text-muted-color)] flex items-center gap-1">
              訂購人 <i class="pi pi-lock text-xs" v-tooltip.top="'合併後不可調整'" aria-label="合併後不可調整"></i>
            </label>
            <div class="text-sm text-[var(--p-text-color)]">{{ mergeSelectedOrders[0]?.buyerName }}</div>
          </div>
          <!-- 收件人 -->
          <div class="flex flex-col gap-2 px-4 py-3">
            <label class="text-sm text-[var(--p-text-muted-color)]">收件人</label>
            <InputText v-model="mergeForm.receiverName" class="!w-full sm:!w-[320px]" />
          </div>
          <!-- 電話 -->
          <div class="flex flex-col gap-2 px-4 py-3">
            <label class="text-sm text-[var(--p-text-muted-color)]">電話</label>
            <InputText v-model="mergeForm.phone" class="!w-full sm:!w-[320px]" />
          </div>
          <!-- 收件地址 -->
          <div class="flex flex-col gap-2 px-4 py-3">
            <label class="text-sm text-[var(--p-text-muted-color)]">收件地址</label>
            <InputText v-model="mergeForm.address" class="!w-full" />
          </div>
          <!-- 商品金額(鎖 + 各訂單列出) -->
          <div class="flex flex-col gap-2 px-4 py-3">
            <label class="text-sm text-[var(--p-text-muted-color)] flex items-center gap-1">
              商品金額 <i class="pi pi-lock text-xs" v-tooltip.top="'合併後不可調整'" aria-label="合併後不可調整"></i>
            </label>
            <div class="flex flex-col gap-1 text-sm">
              <div v-for="o in mergeSelectedOrders" :key="o.id" class="text-[var(--p-text-color)]">
                <span class="text-[var(--p-primary-color)]">{{ o.orderNo }}</span>
                <span class="mx-1 text-[var(--p-text-muted-color)]">：</span>
                <span>${{ o.amount.toLocaleString() }}</span>
              </div>
              <div class="pt-1 text-[var(--p-text-color)]">
                合計 <span class="text-[var(--p-primary-color)] font-medium">${{ mergeSummary.subtotal.toLocaleString() }}</span>
              </div>
            </div>
          </div>
          <!-- 運費(各訂單列出 + 一個可編輯的合併後運費) -->
          <div class="flex flex-col gap-2 px-4 py-3">
            <label class="text-sm text-[var(--p-text-muted-color)]">運費</label>
            <div class="flex flex-col gap-1 text-sm">
              <div v-for="o in mergeSelectedOrders" :key="o.id" class="text-[var(--p-text-color)]">
                <span class="text-[var(--p-primary-color)]">{{ o.orderNo }}</span>
                <span class="mx-1 text-[var(--p-text-muted-color)]">：</span>
                <span>$120</span>
              </div>
              <div class="pt-2">
                <InputNumber v-model="mergeForm.shippingFee" :min="0" mode="decimal" show-buttons class="!w-[200px]" fluid />
              </div>
            </div>
          </div>
          <!-- 使用點數(鎖) -->
          <div class="flex flex-col gap-2 px-4 py-3">
            <label class="text-sm text-[var(--p-text-muted-color)] flex items-center gap-1">
              使用點數 <i class="pi pi-lock text-xs" v-tooltip.top="'合併後不可調整'" aria-label="合併後不可調整"></i>
            </label>
            <div class="flex flex-col gap-1 text-sm">
              <div v-for="o in mergeSelectedOrders" :key="o.id" class="text-[var(--p-text-color)]">
                <span class="text-[var(--p-primary-color)]">{{ o.orderNo }}</span>
                <span class="mx-1 text-[var(--p-text-muted-color)]">：</span>
                <span>0</span>
              </div>
              <div class="pt-1 text-[var(--p-text-color)]">0 點(折抵 $0)</div>
            </div>
          </div>
          <!-- 優惠券(每張券可勾選是否套用) -->
          <div class="flex flex-col gap-2 px-4 py-3">
            <label class="text-sm text-[var(--p-text-muted-color)]">優惠券</label>
            <div class="flex flex-col gap-2 text-sm">
              <div v-for="o in mergeSelectedOrders" :key="o.id" class="text-[var(--p-text-color)]">
                <span class="text-[var(--p-primary-color)]">{{ o.orderNo }}</span>
                <span class="mx-1 text-[var(--p-text-muted-color)]">：</span>
                <template v-if="(o.couponDiscount ?? 0) > 0">
                  <span>${{ o.couponDiscount }}({{ o.couponActivity }})</span>
                </template>
                <template v-else>
                  <span class="text-[var(--p-text-muted-color)]">無</span>
                </template>
              </div>
              <!-- 可套用的優惠券卡:主色 Soft #F2EBFF 底 -->
              <div
                v-for="o in mergeSelectedOrders.filter(o => (o.couponDiscount ?? 0) > 0)"
                :key="`c-${o.id}`"
                class="flex items-center gap-2 px-3 py-2 border border-[var(--p-primary-200)] rounded-md bg-[#F2EBFF]"
              >
                <Checkbox :model-value="mergeCouponSelected.has(o.id)" binary @update:model-value="toggleMergeCoupon(o.id)" />
                <span class="text-[var(--p-text-color)]">{{ o.couponActivity }}({{ o.orderNo }})</span>
                <span class="ml-auto text-[var(--p-primary-color)] font-medium">−${{ o.couponDiscount }}</span>
              </div>
              <div class="text-[var(--p-text-color)]">
                套用 <span class="font-medium">{{ mergeCouponSelected.size }}</span> 張,共折抵 <span class="text-[var(--p-primary-color)] font-medium">−${{ mergeSummary.couponDiscount.toLocaleString() }}</span>
              </div>
              <div class="text-xs text-[var(--p-text-muted-color)]">未勾選的券會隨原訂單作廢自動退回客人帳號</div>
            </div>
          </div>
          <!-- 可得紅利點數(鎖) -->
          <div class="flex flex-col gap-2 px-4 py-3">
            <label class="text-sm text-[var(--p-text-muted-color)] flex items-center gap-1">
              可得紅利點數 <i class="pi pi-lock text-xs" v-tooltip.top="'合併後不可調整'" aria-label="合併後不可調整"></i>
            </label>
            <div class="flex flex-col gap-1 text-sm">
              <div v-for="o in mergeSelectedOrders" :key="o.id" class="text-[var(--p-text-color)]">
                <span class="text-[var(--p-primary-color)]">{{ o.orderNo }}</span>
                <span class="mx-1 text-[var(--p-text-muted-color)]">：</span>
                <span>{{ Math.floor(o.amount / 100) }}</span>
              </div>
              <div class="pt-1 text-[var(--p-text-color)]">{{ mergePointsEarnedTotal }} 點</div>
            </div>
          </div>
          <!-- 發票載具 -->
          <div class="flex flex-col gap-2 px-4 py-3">
            <label class="text-sm text-[var(--p-text-muted-color)]">發票載具</label>
            <div class="flex flex-col gap-1 text-sm">
              <div v-for="o in mergeSelectedOrders" :key="o.id" class="text-[var(--p-text-color)]">
                <span class="text-[var(--p-primary-color)]">{{ o.orderNo }}</span>
                <span class="mx-1 text-[var(--p-text-muted-color)]">：</span>
                <span>二聯式收據</span>
              </div>
              <div class="pt-1 text-[var(--p-text-color)]">二聯式收據</div>
            </div>
          </div>
        </div>

        <!-- 合併後試算總計 card:主色 Soft #F2EBFF 底 -->
        <div class="flex items-center justify-between gap-4 px-4 py-3 rounded-md bg-[#F2EBFF] border border-[var(--p-primary-200)]">
          <div class="flex flex-col gap-1">
            <div class="flex items-center gap-2 text-sm text-[var(--p-text-color)]">
              <i class="pi pi-calculator" style="font-size: 14px"></i>
              合併後試算總計
            </div>
            <div class="flex items-center gap-4 text-sm text-[var(--p-text-muted-color)]">
              <span>商品 <span class="text-[var(--p-text-color)]">${{ mergeSummary.subtotal.toLocaleString() }}</span></span>
              <span>運費 <span class="text-[var(--p-text-color)]">+${{ mergeSummary.shippingFee.toLocaleString() }}</span></span>
              <span>點數 <span class="text-[var(--p-primary-color)]">−${{ mergeSummary.pointsDiscount }}</span></span>
              <span>優惠券 <span class="text-[var(--p-primary-color)]">−${{ mergeSummary.couponDiscount.toLocaleString() }}</span></span>
            </div>
          </div>
          <div class="text-right">
            <div class="text-xs text-[var(--p-text-muted-color)]">總計</div>
            <div class="text-2xl font-bold text-[var(--p-primary-color)]">${{ mergeSummary.total.toLocaleString() }}</div>
          </div>
        </div>
      </div>

      <template #footer>
        <!-- List step footer:已選數 + 清除 + 合併編輯 -->
        <div v-if="mergeStep === 'list'" class="flex items-center justify-between gap-3 w-full">
          <span class="text-sm text-[var(--p-text-color)]">
            <i class="pi pi-check-circle text-[var(--p-primary-color)] mr-2" style="font-size: 14px"></i>
            已選 <span class="font-bold">{{ mergeSelectedOrders.length }}</span> 筆訂單 ·
            合計 <span class="font-bold text-[var(--p-primary-color)]">${{ mergeSelectedTotal.toLocaleString() }}</span>
          </span>
          <div class="flex items-center gap-2">
            <Button label="清除" severity="secondary" variant="outlined" :disabled="mergeSelectedOrders.length === 0" @click="clearMergeSelection" />
            <Button label="合併編輯" :disabled="mergeSelectedOrders.length < 2" @click="goToMergeEditor" />
          </div>
        </div>
        <!-- Editor step footer:取消(次要) + 確認合併(主色);與 List step「清除+合併編輯」操作模型對稱 -->
        <div v-else class="flex items-center justify-end gap-2 w-full">
          <Button label="取消" severity="secondary" variant="outlined" @click="backToMergeList" />
          <Button label="確認合併" @click="confirmMerge" />
        </div>
      </template>
    </Dialog>

    <!-- 批次作業確認彈窗(取號 / 印標共用):列出所有勾選訂單,依 activeBatchConfig 切換文案 -->
    <Dialog
      v-if="activeBatchConfig"
      v-model:visible="batchConfirmDialogVisible"
      modal
      :draggable="false"
      :header="activeBatchConfig.confirmTitle"
      :style="{ width: 'min(560px, calc(100vw - 32px))' }"
      :pt="{ content: { style: 'padding: 0' } }"
    >
      <div class="flex flex-col">
        <!-- 說明 banner(綠色成功語意) -->
        <div class="px-5 py-3 border-b border-[var(--p-content-border-color)] bg-[#DCFCE7] flex items-center gap-2">
          <i class="pi pi-info-circle text-green-600 dark:text-green-400" style="font-size: 14px"></i>
          <span class="text-sm text-[var(--p-text-color)]">
            {{ activeBatchConfig.confirmDescription(selectedForBatchOrders.length) }}
          </span>
        </div>
        <!-- 訂單清單:副標由 activeBatchConfig.rowSecondaryText 決定;右側 tag 依 shippingStatus -->
        <div class="max-h-[440px] overflow-y-auto divide-y divide-[var(--p-content-border-color)]">
          <div
            v-for="o in selectedForBatchOrders"
            :key="o.id"
            class="px-5 py-3 flex items-center justify-between gap-3"
          >
            <div class="flex flex-col gap-1 min-w-0">
              <span class="font-medium text-[var(--p-text-color)]">{{ o.orderNo }}</span>
              <span class="text-xs text-[var(--p-text-muted-color)] truncate">
                {{ activeBatchConfig.rowSecondaryText(o) }}
              </span>
            </div>
            <Tag :value="shippingStatusTagMeta(o.shippingStatus).label" :severity="shippingStatusTagMeta(o.shippingStatus).severity" />
          </div>
        </div>
      </div>

      <template #footer>
        <div class="flex items-center justify-between gap-2 w-full">
          <span class="text-sm text-[var(--p-text-muted-color)]">
            {{ activeBatchConfig.footerCountLabel(selectedForBatchOrders.length) }}
          </span>
          <div class="flex items-center gap-2">
            <Button label="取消" severity="secondary" variant="outlined" @click="batchConfirmDialogVisible = false" />
            <Button :label="activeBatchConfig.confirmActionLabel" @click="confirmBatchAction" />
          </div>
        </div>
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
/* 訂單表格橫向捲軸強制永遠顯示,提示使用者右側還有欄位可看 */
:deep(.order-main-table .p-datatable-table-container) {
  overflow-x: scroll !important;
  scrollbar-gutter: stable;
}
:deep(.p-datatable-table-container::-webkit-scrollbar) {
  height: 12px !important;
  width: 12px !important;
  -webkit-appearance: none !important;
  background: var(--p-surface-100) !important;
}
:deep(.p-datatable-table-container::-webkit-scrollbar-track) {
  background: var(--p-surface-100) !important;
  border-radius: 6px !important;
}
:deep(.p-datatable-table-container::-webkit-scrollbar-thumb) {
  background: var(--p-surface-400) !important;
  border-radius: 6px !important;
  border: 2px solid var(--p-surface-100) !important;
}
:deep(.p-datatable-table-container::-webkit-scrollbar-thumb:hover) {
  background: var(--p-surface-500) !important;
}
/* 凍結欄(操作 / 批次勾選)補不透明底色 + 疊在時間軸圓點之上,
   避免橫向捲動時下方進度條紫色圓點(position:relative; z-index:1)透出 */
:deep(.order-main-table .p-datatable-tbody > tr > td.p-datatable-frozen-column),
:deep(.order-main-table .p-datatable-thead > tr > th.p-datatable-frozen-column) {
  background: var(--p-content-background);
  z-index: 3;
}
:deep(.order-main-table .p-datatable-tbody > tr:nth-child(even) > td.p-datatable-frozen-column) {
  background: var(--p-datatable-row-striped-background, var(--p-content-background));
}
:deep(.order-main-table .p-datatable-tbody > tr:hover > td.p-datatable-frozen-column) {
  background: var(--p-datatable-row-hover-background, var(--p-content-background));
}
/* 進階搜尋 MultiSelect:複選數量 badge 不被 chevron 蓋住 / 裁切
   (欄位加寬到 156px,並縮小 label 右內距,讓「欄名 + 數量 badge」在下拉箭頭前完整顯示) */
:deep(.adv-filters .p-multiselect-label) {
  overflow: visible;
  text-overflow: clip;
  padding-right: 4px;
}
</style>
