<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import type { MenuItem } from 'primevue/menuitem'
import { useLayoutStore } from '@/admin/stores/layout'
import { useToast } from 'primevue/usetoast'
import OrderRowDetail from './components/OrderRowDetail.vue'
import ShippingConfigDialog from './components/ShippingConfigDialog.vue'
import IssueInvoiceDialog from './components/IssueInvoiceDialog.vue'
import SplitShippingPage from './components/SplitShippingPage.vue'
import ShippingListPrintDialog from './components/ShippingListPrintDialog.vue'

/**
 * 訂單管理 → 訂單列表頁。
 *
 * 排版：頁首（標題 + 副標 + 右側 4 顆批次操作鈕）置於 Card 外；篩選列、進階篩選、
 * 快速篩選 chips 與訂單 table 全部裝進一張 Card。
 *
 * 欄位：建立時間 / 購物車 + 訂單編號 / 訂購人 / 金額 / 商品數量 /
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
  paymentStatus: 'paid' | 'unpaid'
  shippingStatus: 'pending' | 'preparing' | 'shipping' | 'awaiting_receipt' | 'arrived' | 'completed' | 'cancelled'
  carrierStatus: 'unconfigured' | 'configured'
  trackingStatus: string | null
  /** 已設定的物流商顯示名稱（配送設定 confirm 後寫入） */
  carrierName?: string
  /** 進階篩選欄位（不顯示在表格內，僅參與篩選） */
  orderSource: 'live' | 'shop'
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
  /** 差額調整（欄位字典 order.diffAdj） */
  diffAdj?: DiffAdj
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

/** 差額調整（欄位字典第 4 節） */
export interface DiffAdj {
  amount: number
  settleType: 'absorb' | 'charge' | 'refund'
  payMethod?: 'link' | 'atm' | 'cod'
  refundMethod?: 'refund' | 'coupon' | 'points'
  reason?: string
  invoiceMode?: 'auto' | 'manual'
  validity?: '90' | '180' | '365' | 'none'
  faceValue?: number
  status: string
  at: number
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
]
const paymentStatusOptions: FilterOption[] = [
  { label: '已付款', value: 'paid' },
  { label: '待付款', value: 'unpaid' },
]
const shippingStatusOptions: FilterOption[] = [
  { label: '待出貨', value: 'pending' },
  { label: '備貨中', value: 'preparing' },
  { label: '出貨中', value: 'shipping' },
  { label: '待收貨', value: 'awaiting_receipt' },
  { label: '已送達', value: 'arrived' },
  { label: '已完成', value: 'completed' },
  { label: '已取消', value: 'cancelled' },
]
const carrierOptions: FilterOption[] = [
  { label: '7-11 B2C 冷凍到府收件',       value: 'cvs711_b2c_cold' },
  { label: '7-11 B2C 到府收件',            value: 'cvs711_b2c_normal' },
  { label: '7-11 交貨便（門市寄件）',      value: 'cvs711_handover' },
  { label: 'Presco 跨境物流（宅配）',      value: 'presco_home' },
  { label: 'Presco 跨境物流（超商取貨）',  value: 'presco_cvs' },
  { label: '全家冷凍到府收件',             value: 'fm_cold_home' },
  { label: '全家常溫',                     value: 'fm_normal' },
  { label: '嘉里大榮低溫',                 value: 'kerry_cold' },
  { label: '嘉里大榮常溫',                 value: 'kerry_normal' },
  { label: '新竹物流',                     value: 'hct' },
  { label: '郵局（商家自建）',             value: 'post_self' },
  { label: '黑貓宅急便',                   value: 'tcat' },
  { label: '黑貓宅急便（門市寄件）',       value: 'tcat_handover' },
  { label: '未分類',                       value: 'uncategorized' },
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
]
const trackingStatusOptions: FilterOption[] = [
  { label: '已取號', value: 'taken' },
  { label: '未取號', value: 'untaken' },
]
const channelOptions: FilterOption[] = [
  { label: '全部',         value: '' },
  { label: '商城',         value: 'shop' },
  { label: 'Facebook',     value: 'facebook' },
  { label: 'LINE',         value: 'line' },
  { label: 'Instagram',    value: 'instagram' },
  { label: 'YouTube Live', value: 'youtube' },
  { label: '蝦皮',         value: 'shopee' },
  { label: 'PChome',       value: 'pchome' },
]
const orderSourceOptions: FilterOption[] = [
  { label: '直播', value: 'live' },
  { label: '商城', value: 'shop' },
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
  { label: '6/20 開箱直播',     value: 'session_0620' },
  { label: '6/22 美妝直播',     value: 'session_0622' },
  { label: '6/24 晚間生鮮直播', value: 'session_0624' },
  { label: '6/25 服飾團',       value: 'session_0625' },
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

const filterShipping = ref('')
const filterPayment = ref('')
const filterShippingStatus = ref('')
const filterCarrier = ref('')
const filterPaymentMethod = ref('')
const filterTracking = ref('')
const filterChannel = ref('')
const filterOrderSource = ref('')
const filterSocialPlatform = ref('')
const filterMultiCart = ref('')
const filterSessionName = ref('')
/** 精準欄位篩選：選哪個欄位 + 輸入要比對的值 */
const filterPrecisionField = ref<string>('buyerName')
const filterPrecisionValue = ref<string>('')
/** placeholder 隨選擇欄位變動：精準比對「XXX」欄位 */
const precisionPlaceholder = computed<string>(() => {
  const opt = precisionFieldOptions.find(o => o.value === filterPrecisionField.value)
  return opt ? `精準比對「${opt.label}」欄位` : ''
})

/** 進階篩選收摺：預設收起，點 toggle button 才展開（11 個 Select 太占空間） */
const advancedFilterExpanded = ref(false)
/** 顯示已套用的進階篩選數量，提示使用者「進階篩選 (N)」 */
const appliedAdvancedCount = computed<number>(() => {
  return [
    filterShipping.value, filterPayment.value, filterShippingStatus.value,
    filterCarrier.value, filterPaymentMethod.value, filterTracking.value, filterChannel.value,
    filterOrderSource.value, filterSocialPlatform.value, filterMultiCart.value, filterSessionName.value,
    filterPrecisionValue.value.trim(),
  ].filter(Boolean).length
})
/** 一鍵清除所有進階篩選 Select 的值 + 立即從 applied 移除 → 表格重新顯示未過濾結果。 */
function clearAdvancedFilters(): void {
  filterShipping.value = ''
  filterPayment.value = ''
  filterShippingStatus.value = ''
  filterCarrier.value = ''
  filterPaymentMethod.value = ''
  filterTracking.value = ''
  filterChannel.value = ''
  filterOrderSource.value = ''
  filterSocialPlatform.value = ''
  filterMultiCart.value = ''
  filterSessionName.value = ''
  filterPrecisionValue.value = ''
  onApplyFilters()
}

type QuickFilter = 'all' | 'pending' | 'preparing' | 'shipping' | 'arrived' | 'paid' | 'unpaid'
const quickFilter = ref<QuickFilter>('all')
const quickFilters: Array<{ value: QuickFilter; label: string }> = [
  { value: 'all',       label: '全部' },
  { value: 'pending',   label: '待出貨' },
  { value: 'preparing', label: '備貨中' },
  { value: 'shipping',  label: '出貨中' },
  { value: 'arrived',   label: '待收貨' },
  { value: 'paid',      label: '已付款' },
  { value: 'unpaid',    label: '待付款' },
]

// 篩選「已套用」狀態：computed 過濾依此計算。按下「搜尋」才會把草稿值寫進來。
interface AppliedFilter {
  keyword: string
  dateRange: Date[] | null
  payment: string
  shippingStatus: string
  quickFilter: QuickFilter
  orderSource: string
  socialPlatform: string
  multiCart: string
  sessionName: string
  precisionField: string
  precisionValue: string
}
const applied = ref<AppliedFilter>({
  keyword: '',
  dateRange: null,
  payment: '',
  shippingStatus: '',
  quickFilter: 'all',
  orderSource: '',
  socialPlatform: '',
  multiCart: '',
  sessionName: '',
  precisionField: '',
  precisionValue: '',
})
function onApplyFilters(): void {
  applied.value = {
    keyword: keyword.value,
    dateRange: dateRange.value,
    payment: filterPayment.value,
    shippingStatus: filterShippingStatus.value,
    quickFilter: quickFilter.value,
    orderSource: filterOrderSource.value,
    socialPlatform: filterSocialPlatform.value,
    multiCart: filterMultiCart.value,
    sessionName: filterSessionName.value,
    precisionField: filterPrecisionField.value,
    precisionValue: filterPrecisionValue.value.trim(),
  }
}

// 快速篩選 chip 點按 → 只更新 applied.quickFilter 即時過濾表格,不需按套用
watch(quickFilter, (v) => { applied.value.quickFilter = v })

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
  { id: '3', createdAt: '2026-05-10 11:30', cartTag: tagFor('服飾專區'), orderNo: 'A20260510103', buyerName: '蔡明宏', buyerPhone: '0936-333-444', amount: 1300, itemCount: 2, shippingMethod: '常溫宅配', paymentStatus: 'unpaid', shippingStatus: 'pending', carrierStatus: 'configured', carrierName: '新竹物流',   trackingStatus: null, orderSource: 'live', socialPlatform: 'line',      multiCart: 'main',        sessionName: 'session_0622', channel: 'LINE',                                          pointsDiscount: 100, dispatchBatchCount: 2 },
  { id: '4', createdAt: '2026-05-11 09:00', cartTag: tagFor('服飾專區'), orderNo: 'A20260511101', buyerName: '何併併', buyerPhone: '0912-345-678', amount:  510, itemCount: 1, shippingMethod: '常溫宅配', paymentStatus: 'paid',   shippingStatus: 'pending', carrierStatus: 'configured', carrierName: '黑貓宅急便', trackingStatus: null, orderSource: 'live', socialPlatform: 'instagram', multiCart: 'default',     sessionName: 'session_0624', channel: 'Instagram',                                                                                                          },
  { id: '5', createdAt: '2026-05-11 10:30', cartTag: tagFor('服飾專區'), orderNo: 'A20260511102', buyerName: '何併併', buyerPhone: '0912-345-678', amount: 1250, itemCount: 1, shippingMethod: '常溫宅配', paymentStatus: 'paid',   shippingStatus: 'preparing', carrierStatus: 'configured', carrierName: '黑貓宅急便', trackingStatus: 'TCAT-260511-A101', orderSource: 'shop',                              multiCart: 'main',                                     channel: '商城',      couponActivity: '春季新品優惠', couponDiscount: 100,                                                                                          invoiceNumber: 'CD98765432', invoiceIssuedAt: '2026-05-11 11:15' },
  { id: '6', createdAt: '2026-05-11 13:15', cartTag: tagFor('服飾專區'), orderNo: 'A20260511103', buyerName: '何併併', buyerPhone: '0912-345-678', amount: 1250, itemCount: 2, shippingMethod: '常溫宅配', paymentStatus: 'paid',   shippingStatus: 'pending', carrierStatus: 'configured', carrierName: '黑貓宅急便', trackingStatus: null, orderSource: 'live', socialPlatform: 'tiktok',    multiCart: 'ice',         sessionName: 'session_0625', channel: 'TikTok',                                                             dispatchBatchCount: 1 },

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
  { id: 'm7', createdAt: '2026-06-16 18:57', cartTag: tagFor('服飾專區'), orderNo: 'A20260512101', buyerName: '林大華', buyerPhone: '0938-777-999', amount: 1200, itemCount: 2, shippingMethod: '常溫宅配', paymentStatus: 'unpaid', shippingStatus: 'pending', carrierStatus: 'unconfigured', trackingStatus: null, orderSource: 'shop', multiCart: 'default', channel: '商城', receiverAddress: '高雄市三民區建工路300號',      productSummary: '純棉素色短T(黑) × 2',   paymentMethodLabel: '貨到付款', temperature: '常溫' },
  { id: 'm8', createdAt: '2026-06-17 09:10', cartTag: tagFor('生活雜貨'), orderNo: 'A20260512102', buyerName: '林大華', buyerPhone: '0938-777-999', amount:  500, itemCount: 4, shippingMethod: '常溫宅配', paymentStatus: 'unpaid', shippingStatus: 'pending', carrierStatus: 'unconfigured', trackingStatus: null, orderSource: 'shop', multiCart: 'default', channel: '商城', receiverAddress: '高雄市三民區建工路300號',      productSummary: '燕麥奶 × 4',              paymentMethodLabel: '貨到付款', temperature: '常溫' },
  { id: 'm9', createdAt: '2026-06-18 10:23', cartTag: tagFor('服飾專區'), orderNo: 'A20260512103', buyerName: '林大華', buyerPhone: '0938-777-999', amount: 1250, itemCount: 1, shippingMethod: '常溫宅配', paymentStatus: 'unpaid', shippingStatus: 'pending', carrierStatus: 'unconfigured', trackingStatus: null, orderSource: 'shop', multiCart: 'default', channel: '商城', receiverAddress: '高雄市三民區建工路300號',      productSummary: '韓版寬鬆連帽外套(黑) × 1', paymentMethodLabel: '貨到付款', temperature: '常溫' },
  { id: 'm10', createdAt: '2026-06-19 11:36', cartTag: tagFor('服飾專區'), orderNo: 'A20260512104', buyerName: '林大華', buyerPhone: '0938-777-999', amount: 1890, itemCount: 3, shippingMethod: '常溫宅配', paymentStatus: 'unpaid', shippingStatus: 'pending', carrierStatus: 'unconfigured', trackingStatus: null, orderSource: 'shop', multiCart: 'default', channel: '商城', receiverAddress: '高雄市三民區建工路300號',      productSummary: '純棉素色短T(白) × 3',   paymentMethodLabel: '貨到付款', temperature: '常溫' },
])

/** 全站合計 85 筆（圖中右上的總數）— 顯示用，篩選後仍顯示原始總數。 */
const TOTAL_ORDERS = 85

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
  if (a.payment) list = list.filter(o => o.paymentStatus === a.payment)
  if (a.shippingStatus) list = list.filter(o => o.shippingStatus === a.shippingStatus)
  if (a.orderSource) list = list.filter(o => o.orderSource === a.orderSource)
  if (a.socialPlatform) list = list.filter(o => o.socialPlatform === a.socialPlatform)
  if (a.multiCart) list = list.filter(o => o.multiCart === a.multiCart)
  if (a.sessionName) list = list.filter(o => o.sessionName === a.sessionName)
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

/** 「查看更多」彈窗：點眼睛 icon 開 Dialog 顯示 OrderRowDetail */
const detailDialogVisible = ref(false)
const detailDialogOrder = ref<OrderRow | null>(null)
function openDetailDialog(o: OrderRow): void {
  detailDialogOrder.value = o
  detailDialogVisible.value = true
}

/** 付款狀態 inline 編輯：點 Tag → Select 模式；按打勾 commit 回 Tag */
const paymentEditOptions = [
  { label: '已付款', value: 'paid' as const },
  { label: '待付款', value: 'unpaid' as const },
]
const editingPaymentRowId = ref<string | null>(null)
const editPaymentValueMap = ref<Record<string, 'paid' | 'unpaid'>>({})
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
}

/**
 * 分批出貨作業全頁模式：splitPageOrderId 有值時，主畫面改渲染 SplitShippingPage
 * 隱藏搜尋 / 日期 / 進階篩選 / 狀態 tabs（依規範第 9 節）
 */
const splitPageOrderId = ref<string | null>(null)
const splitPageOrder = computed<OrderRow | null>(() =>
  splitPageOrderId.value ? orders.value.find(o => o.id === splitPageOrderId.value) ?? null : null,
)
function openSplitPage(orderId: string): void {
  splitPageOrderId.value = orderId
  detailDialogVisible.value = false  // 關閉詳情彈窗
}
function closeSplitPage(): void {
  splitPageOrderId.value = null
}

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
    isSelectable: (o) => o.shippingStatus === 'pending' && o.carrierStatus === 'configured' && !o.trackingStatus,
    performAction: (list) => {
      const now = Date.now()
      list.forEach((o, i) => { o.trackingStatus = `${now}${String(i).padStart(4, '0')}` })
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
    // 尚未結束的訂單(排除已完成 / 已取消)都可列印出貨單
    isSelectable: (o) => o.shippingStatus !== 'completed' && o.shippingStatus !== 'cancelled',
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

/** 出貨狀態 → dialog 內顯示的 tag 文字/severity */
function shippingStatusTagMeta(s: OrderRow['shippingStatus']): { label: string; severity: 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast' } {
  const map: Record<OrderRow['shippingStatus'], { label: string; severity: 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast' }> = {
    pending:          { label: '待出貨', severity: 'secondary' },
    preparing:        { label: '備貨中', severity: 'secondary' },
    shipping:         { label: '已出貨', severity: 'secondary' },
    awaiting_receipt: { label: '待收貨', severity: 'secondary' },
    arrived:          { label: '已送達', severity: 'success' },
    completed:        { label: '已完成', severity: 'secondary' },
    cancelled:        { label: '已取消', severity: 'danger' },
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
/** 可合併訂單總數(給 header badge 顯示;image 15 示意 badge 為 4;此處算所有 group 的 order 總和) */
const mergeableOrderCount = computed(() =>
  mergeGroups.value.reduce((s, g) => s + g.orders.length, 0),
)
const mergeDialogVisible = ref(false)
function openMergeDialog(): void {
  if (mergeGroups.value.length === 0) return
  mergeSelectedIds.value = new Set()
  mergeDialogVisible.value = true
}
/** 合併訂單彈窗內已勾選的訂單 id 集合(跨 group) */
const mergeSelectedIds = ref<Set<string>>(new Set())
const mergeSelectedOrders = computed<OrderRow[]>(() =>
  mergeGroups.value.flatMap((g) => g.orders).filter((o) => mergeSelectedIds.value.has(o.id)),
)
const mergeSelectedTotal = computed(() =>
  mergeSelectedOrders.value.reduce((s, o) => s + o.amount, 0),
)
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
function confirmMerge(): void {
  toast.add({
    severity: 'success',
    summary: '合併訂單',
    detail: `${mergeSelectedOrders.value.length} 筆訂單已進入合併編輯`,
    life: 2500,
  })
  mergeDialogVisible.value = false
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
/** 訂單目前在進度條的 index（找不到 → 視為第一階段）。 */
function currentStepIndex(s: OrderRow['shippingStatus']): number {
  const i = PROGRESS_STEPS.findIndex(x => x.key === s)
  return i === -1 ? 0 : i
}
/** 把 PROGRESS_STEPS 變成 Timeline 用的資料：附加 isCurrent / isPast。 */
interface ProgressItem extends ProgressStep { isCurrent: boolean; isPast: boolean }
function progressItemsFor(s: OrderRow['shippingStatus']): ProgressItem[] {
  const idx = currentStepIndex(s)
  return PROGRESS_STEPS.map((step, i) => ({
    ...step,
    isCurrent: i === idx,
    isPast: i < idx,
  }))
}
</script>

<template>
  <div class="flex flex-col gap-4 flex-1 min-h-0">

    <!-- 分批出貨全頁模式：訂單管理分頁改渲染 SplitShippingPage，隱藏搜尋 / 篩選 / 表格 -->
    <SplitShippingPage
      v-if="splitPageOrder"
      :order="splitPageOrder"
      @close="closeSplitPage"
    />

    <template v-else>

    <!-- ── 篩選 Card：標題 + 副標 + 右側批次操作 + 搜尋 / 篩選 — shrink-0 鎖內容高度，不隨 viewport 壓縮 ── -->
    <Card
      :pt="{
        root: { class: 'w-full shrink-0 overflow-hidden' },
        body: { class: 'p-0' },
        content: { class: 'p-0' },
      }"
    >
      <template #content>
        <!-- 頁首：標題 + 副標 + 右側批次操作 -->
        <div class="flex items-start justify-between gap-3 px-5 pt-5 pb-2 flex-wrap">
          <div class="flex flex-col gap-1">
            <div class="flex items-center gap-2">
              <h1 class="text-2xl font-bold text-[var(--p-text-color)]">訂單管理</h1>
              <button
                v-tooltip.top="'手動刷新訂單資訊'"
                class="size-[28px] flex items-center justify-center rounded-full hover:bg-[var(--p-primary-50)]"
                style="color: var(--p-primary-color)"
                @click="onRefresh"
              >
                <i class="pi pi-sync" style="font-size: 15px"></i>
              </button>
            </div>
            <p class="text-[13px] text-[var(--p-text-muted-color)]">
              查看與管理所有來自商城與直播的訂單，可篩選狀態、查詢訂單編號或買家姓名。
            </p>
          </div>
          <div class="flex items-center gap-2 flex-wrap">
            <Button
              label="批次作業"
              icon="pi pi-chevron-down"
              icon-pos="right"
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
            <!-- 合併訂單:可合併訂單筆數以 Badge 內嵌在 label 後面(button+badge 組合);無可合併時 disabled -->
            <Button
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
            <Button label="預設配送設定" variant="outlined" />
            <Button label="匯出 CSV"      icon="pi pi-upload"  severity="secondary" variant="outlined" />
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
            date-format="yy/mm/dd"
            placeholder="年 / 月 / 日  至  年 / 月 / 日"
            class="!w-[320px]"
          />

          <div class="flex items-center gap-2">
            <Button label="今日"     severity="secondary" variant="outlined" size="small" @click="setDateRangePreset('today')" />
            <Button label="近 7 天"  severity="secondary" variant="outlined" size="small" @click="setDateRangePreset('last7')" />
            <Button label="本月"     severity="secondary" variant="outlined" size="small" @click="setDateRangePreset('thisMonth')" />
            <Button label="上月"     severity="secondary" variant="outlined" size="small" @click="setDateRangePreset('lastMonth')" />
          </div>
          <!-- 搜尋按鈕:依目前搜尋 Card 內所有篩選條件 commit 到 applied 觸發過濾 -->
          <Button label="搜尋" @click="onApplyFilters" />
        </div>

        <!-- 進階篩選 toggle：預設收摺，點開展開所有 Select -->
        <div class="px-5 py-2 flex items-center gap-3">
          <button
            type="button"
            class="inline-flex items-center gap-2 text-[13px] text-[var(--p-text-color)] hover:text-[var(--p-primary-color)]"
            @click="advancedFilterExpanded = !advancedFilterExpanded"
          >
            <span class="font-medium">進階篩選</span>
            <span
              v-if="appliedAdvancedCount > 0"
              class="bg-[var(--p-primary-color)] text-white text-xs font-bold leading-none rounded-full min-w-[16px] h-[16px] px-1 inline-flex items-center justify-center"
            >{{ appliedAdvancedCount }}</span>
            <i :class="advancedFilterExpanded ? 'pi pi-chevron-up' : 'pi pi-chevron-down'" style="font-size: 11px"></i>
          </button>
        </div>

        <!-- 進階篩選展開區：11 個 Select + 精準欄位篩選（最後一列） -->
        <div v-if="advancedFilterExpanded" class="flex flex-col gap-2 px-5 pb-3">
          <!-- 既有 Select 群 -->
          <div class="flex items-center gap-2 flex-wrap">
          <Select v-model="filterShipping"      :options="shippingMethodOptions" option-label="label" option-value="value" placeholder="出貨方式" class="!w-[140px]" show-clear />
          <Select v-model="filterPayment"       :options="paymentStatusOptions"  option-label="label" option-value="value" placeholder="付款狀態" class="!w-[140px]" show-clear />
          <Select v-model="filterShippingStatus" :options="shippingStatusOptions" option-label="label" option-value="value" placeholder="出貨狀態" class="!w-[140px]" show-clear />
          <Select v-model="filterCarrier"       :options="carrierOptions"        option-label="label" option-value="value" placeholder="物流商"   class="!w-[140px]" scroll-height="auto" show-clear />
          <Select v-model="filterPaymentMethod" :options="paymentMethodOptions"  option-label="label" option-value="value" placeholder="付款方式" class="!w-[140px]" scroll-height="auto" show-clear />
          <Select v-model="filterTracking"      :options="trackingStatusOptions" option-label="label" option-value="value" placeholder="取號狀態" class="!w-[140px]" show-clear />
          <Select v-model="filterChannel"       :options="channelOptions"        option-label="label" option-value="value" placeholder="購買通路" class="!w-[140px]" show-clear />
          <Select v-model="filterOrderSource"   :options="orderSourceOptions"    option-label="label" option-value="value" placeholder="訂單來源" class="!w-[140px]" show-clear />
          <Select v-model="filterSocialPlatform" :options="socialPlatformOptions" option-label="label" option-value="value" placeholder="社群平台" class="!w-[140px]" show-clear />
          <Select v-model="filterMultiCart"     :options="multiCartOptions"      option-label="label" option-value="value" placeholder="多購物車" class="!w-[140px]" show-clear />
          <Select v-model="filterSessionName"   :options="sessionNameOptions"    option-label="label" option-value="value" placeholder="場次名稱" class="!w-[160px]" show-clear />
          </div>
          <!-- 精準欄位篩選：Select 選欄位 + InputText 輸入要比對的值 -->
          <div class="flex items-stretch gap-2 flex-wrap">
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
          </div>
          <!-- 進階篩選操作:套用把當下值 commit 到 applied、清除還原成空並立即套用 -->
          <div class="flex items-center justify-end gap-2 pt-1">
            <Button label="清除" severity="secondary" variant="outlined" @click="clearAdvancedFilters" />
            <Button label="套用" @click="onApplyFilters" />
          </div>
        </div>

        <!-- 快速篩選 chips + 搜尋按鈕 + 總筆數 -->
        <div class="flex items-center justify-between gap-3 px-5 py-2 flex-wrap">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-[13px] text-[var(--p-text-muted-color)] shrink-0 mr-1">快速篩選</span>
            <button
              v-for="q in quickFilters"
              :key="q.value"
              class="px-3 py-2 rounded-full text-[13px] border transition-colors"
              :style="quickFilter === q.value
                ? 'background: var(--p-primary-50); color: var(--p-primary-color); border-color: var(--p-primary-color)'
                : 'background: var(--p-content-background); color: var(--p-text-muted-color); border-color: var(--p-content-border-color)'"
              @click="quickFilter = q.value"
            >{{ q.label }}</button>
          </div>
          <span class="text-[13px] text-[var(--p-text-muted-color)]">
            共 <span class="text-[var(--p-text-color)] font-bold">{{ TOTAL_ORDERS }}</span> 筆訂單
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
            <span class="text-[13px] text-[var(--p-text-muted-color)]">載入中…</span>
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
                :label="allSelectableSelected ? '取消全選' : '全選可選'"
                severity="secondary"
                variant="outlined"
                :disabled="batchSelectableCount === 0"
                @click="toggleSelectAllSelectable"
              />
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
                  <!-- 已分批 N 批 tag（dispatchBatchCount > 0 才顯示） -->
                  <Tag
                    v-if="(data.dispatchBatchCount ?? 0) > 0"
                    :value="`已分批 ${data.dispatchBatchCount} 批`"
                    severity="info"
                  />
                </div>
                <div class="flex items-center gap-2">
                  <span class="font-medium text-[var(--p-text-color)]">{{ data.orderNo }}</span>
                  <Button
                    v-tooltip.top="'複製'"
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
                  class="!w-[100px]"
                />
                <Button v-tooltip.top="'確認'" icon="pi pi-check" severity="secondary" variant="text" size="small" rounded @click="commitPayment(data, $event)" />
                <Button v-tooltip.top="'取消'" icon="pi pi-times" severity="secondary" variant="text" size="small" rounded @click="cancelEditPayment" />
              </span>
              <!-- 檢視模式：Tag 可直接點按進編輯 -->
              <button
                v-else
                type="button"
                class="inline-flex items-center gap-1 cursor-pointer"
                v-tooltip.top="'點擊修改'"
                @click="startEditPayment(data, $event)"
              >
                <Tag
                  :value="data.paymentStatus === 'paid' ? '已付款' : '待付款'"
                  :severity="data.paymentStatus === 'paid' ? 'success' : 'warn'"
                />
                <i class="pi pi-pencil text-xs text-[var(--p-text-muted-color)]"></i>
              </button>
            </template>
          </Column>

          <Column header="出貨狀態">
            <template #body="{ data }">
              <!-- PrimeVue Timeline 顯示 5 階段,水平排列,目前階段主色加粗 -->
              <Timeline
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
                <i class="pi pi-truck text-[var(--p-primary-color)] text-[13px]"></i>
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
                <button
                  v-tooltip.top="'出貨單列印'"
                  class="size-[32px] flex items-center justify-center rounded-md text-[var(--p-text-color)] hover:bg-[var(--p-content-hover-background)]"
                  @click="openPrintDialog(data, $event)"
                >
                  <i class="pi pi-print" style="font-size: 15.75px"></i>
                </button>
                <button
                  v-tooltip.top="'標籤列印'"
                  class="size-[32px] flex items-center justify-center rounded-md text-[var(--p-text-color)] hover:bg-[var(--p-content-hover-background)]"
                >
                  <i class="pi pi-tag" style="font-size: 15.75px"></i>
                </button>
                <button
                  v-tooltip.top="data.invoiceNumber ? `已開立：${data.invoiceNumber}` : '開立發票'"
                  class="size-[32px] flex items-center justify-center rounded-md hover:bg-[var(--p-content-hover-background)]"
                  :class="data.invoiceNumber ? 'text-[#16A34A]' : 'text-[var(--p-text-color)]'"
                  @click="openIssueInvoice(data, $event)"
                >
                  <i class="pi pi-file" style="font-size: 15.75px"></i>
                </button>
                <button
                  v-tooltip.top="'查看更多'"
                  class="size-[32px] flex items-center justify-center rounded-md text-[var(--p-text-color)] hover:bg-[var(--p-content-hover-background)]"
                  @click="openDetailDialog(data)"
                >
                  <i class="pi pi-eye" style="font-size: 15.75px"></i>
                </button>
              </div>
            </template>
          </Column>

          <template #empty>
            <div class="py-12 text-center text-sm text-[var(--p-text-muted-color)]">
              目前無訂單。
            </div>
          </template>
          </DataTable>
        </div>
      </template>
    </Card>

    </template>

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
          <Button label="取消訂單" icon="pi pi-ban" severity="danger" variant="outlined" />
          <div class="flex items-center gap-2">
            <Button label="取消" severity="secondary" variant="outlined" @click="detailDialogVisible = false" />
            <Button label="儲存" @click="detailDialogVisible = false" />
          </div>
        </div>
      </template>
    </Dialog>

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

    <!-- 合併訂單彈窗:分組列出可合併訂單,勾選後可清除或合併編輯 -->
    <Dialog
      v-model:visible="mergeDialogVisible"
      modal
      :draggable="false"
      :style="{ width: 'calc(100vw - 32px)' }"
      :pt="{ content: { style: 'padding: 0' } }"
    >
      <template #header>
        <div class="flex flex-col gap-1">
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
        </div>
      </template>

      <div class="flex flex-col gap-4 p-5">
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

        <!-- Groups:每組買家用 PrimeVue Panel;header 顯示名稱 · 筆數,icons slot 顯示合計 -->
        <!-- header 有淺灰底、header/content 左右 padding 一致;overflow-hidden 讓 DataTable 貼齊 Panel 圓角 -->
        <Panel
          v-for="g in mergeGroups"
          :key="g.key"
          :pt="{
            root: { class: 'overflow-hidden' },
            header: { style: 'padding: 12px 16px; background: var(--p-content-hover-background)' },
            content: { style: 'padding: 0 16px 16px' },
          }"
        >
          <template #header>
            <div class="flex items-center gap-2">
              <span class="font-bold text-[var(--p-text-color)]">{{ g.buyer }}</span>
              <span class="text-sm text-[var(--p-text-muted-color)]">· {{ g.orders.length }} 筆訂單</span>
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
                <Checkbox :model-value="isGroupAllSelected(g)" binary @update:model-value="toggleGroupAll(g)" />
              </template>
              <template #body="{ data }">
                <Checkbox :model-value="mergeSelectedIds.has(data.id)" binary @update:model-value="toggleMergeRow(data.id)" />
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
                  :value="data.paymentStatus === 'paid' ? '已付款' : '待付款'"
                  :severity="data.paymentStatus === 'paid' ? 'success' : 'warn'"
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

      <template #footer>
        <div class="flex items-center justify-between gap-3 w-full">
          <span class="text-sm text-[var(--p-text-color)]">
            <i class="pi pi-check-circle text-[var(--p-primary-color)] mr-2" style="font-size: 14px"></i>
            已選 <span class="font-bold">{{ mergeSelectedOrders.length }}</span> 筆訂單 ·
            合計 <span class="font-bold text-[var(--p-primary-color)]">${{ mergeSelectedTotal.toLocaleString() }}</span>
          </span>
          <div class="flex items-center gap-2">
            <Button label="清除" severity="secondary" variant="outlined" :disabled="mergeSelectedOrders.length === 0" @click="clearMergeSelection" />
            <Button label="合併編輯" icon="pi pi-link" :disabled="mergeSelectedOrders.length < 2" @click="confirmMerge" />
          </div>
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
          <i class="pi pi-info-circle text-[#16A34A]" style="font-size: 14px"></i>
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
            <Button :label="activeBatchConfig.confirmActionLabel" icon="pi pi-check" @click="confirmBatchAction" />
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
  background: #f1f5f9 !important;
}
:deep(.p-datatable-table-container::-webkit-scrollbar-track) {
  background: #f1f5f9 !important;
  border-radius: 6px !important;
}
:deep(.p-datatable-table-container::-webkit-scrollbar-thumb) {
  background: #94a3b8 !important;
  border-radius: 6px !important;
  border: 2px solid #f1f5f9 !important;
}
:deep(.p-datatable-table-container::-webkit-scrollbar-thumb:hover) {
  background: #64748b !important;
}
</style>
