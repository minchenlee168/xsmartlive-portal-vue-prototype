<script setup lang="ts">
import { computed, ref, watch } from 'vue'

/**
 * 新增 / 編輯多購物車 dialog（依規劃原始設計 + 設計決議）。
 *
 * 區塊：
 * 1. 購物車基本設定：名稱（必填）/ 購物車 ID（唯讀自動產生）/ 說明
 * 2. 金流設定：結帳模式（單選，ⓘ hover 說明）/ 支付方式設定（複選 10 種）
 *    勾「轉帳匯款」時顯示「轉帳匯款金流備註」（文字編輯器）
 * 3. 物流設定：配送溫層（單選）/ 物流方式設定（複選，自取不計運費）/
 *    運費設定（物流方式 × 付款方式 × 地區 × 溫層 矩陣，帶預設值可編輯）
 * 4. 行銷設定：優惠券 / 紅利點數 / 免運設定（留空表示不設定）
 *
 * 設計決議：不放「結帳發票顯示」；ⓘ 說明用 hover 顯示。
 * 驗證：名稱未填、免運或運費金額為負數 → 紅框標示且不可儲存。
 */

export type CheckoutMode = '標單必結' | '自選結帳' | '棄標結帳' | '暫停結帳' | '商城結帳'
export type TempLayer = '常溫' | '冷藏' | '冷凍'

export interface MultiCartRecord {
  date: string
  name: string
  id: string
  desc: string
  locked?: boolean
  /** 轉帳匯款金流備註（HTML） */
  note?: string
  mode: CheckoutMode
  temp: TempLayer
  coupon: boolean
  reward: boolean
  /** 免運門檻；null = 未設定 */
  freeShip: number | null
  on: boolean
  payList: string[]
  logiList: string[]
  /** 運費矩陣：使用者調整過的格子（key = scope|物流|sub|付款|格index） */
  feeVals?: Record<string, number>
  /** 運費矩陣：關閉的「物流 × 付款」組合（key = scope|物流|sub|付款） */
  feeOff?: Record<string, boolean>
  deleted?: boolean
}

export interface MultiCartFormPayload {
  /** 編輯模式帶原 ID；新增模式 undefined */
  editingId?: string
  record: MultiCartRecord
}

interface Props {
  visible?: boolean
  /** 帶資料 = 編輯該購物車；不帶 = 新增 */
  initial?: MultiCartRecord | null
  /** 新增時作為範本的預設購物車 */
  template?: MultiCartRecord | null
  /** 新增模式顯示的自動產生 ID（唯讀） */
  generatedId?: string
}
const props = withDefaults(defineProps<Props>(), {
  visible: false,
  initial: null,
  template: null,
  generatedId: '',
})
const emit = defineEmits<{
  'update:visible': [value: boolean]
  saved: [payload: MultiCartFormPayload]
}>()

const isEditMode = computed(() => !!props.initial)
const dialogTitle = computed(() => (isEditMode.value ? '編輯多購物車' : '新增多購物車'))
const cartId = computed(() => props.initial?.id ?? props.generatedId)

const innerVisible = computed<boolean>({
  get: () => props.visible,
  set: (v) => emit('update:visible', v),
})

// ── 選項定義（與規劃一致） ─────────────────────
const MODE_OPTIONS: Array<{ value: CheckoutMode; info: string }> = [
  { value: '標單必結', info: '標單必結：客人標到的商品一定強制進行整單結帳。' },
  { value: '自選結帳', info: '自選結帳：客人挑選自己想結帳的商品；即使是標單的商品，也可延後至下次結帳。' },
  { value: '棄標結帳', info: '棄標結帳：客人可先移除不要的商品後，剩下的商品需一次整單結帳。' },
  { value: '暫停結帳', info: '暫停結帳：暫時關閉此購物車結帳功能，買家看得到但無法進行結帳。' },
  { value: '商城結帳', info: '商城結帳：與一般電商相同，可自由勾選、移除商品後結帳。' },
]
/** 收單下標結帳模式：4 種直播模式（單選）；商城通路另以獨立開關呈現 */
const liveModeOptions = MODE_OPTIONS.filter((o) => o.value !== '商城結帳')
const PAY_OPTIONS = [
  '線上信用卡（藍新）',
  '線上信用卡（數位鎏）',
  'Apple Pay',
  'ATM 繳費帳號',
  '超商代碼繳費',
  '轉帳匯款',
  'LINE Pay',
  'iPASS MONEY',
  '貨到付款',
  '現金付款（限自取）',
]
/** 物流方式；自取不計運費 */
const LOGI_OPTIONS: Array<{ value: string; noFee?: boolean }> = [
  { value: '宅配' },
  { value: '超商配送' },
  { value: '跨境' },
  { value: '自取', noFee: true },
  { value: '商家自建（如郵局）' },
]
/** checkbox 群組只放「會計運費」的物流方式；自取獨立為開關（見下方 selfPickupOn） */
const logiMethodOptions = LOGI_OPTIONS.filter((o) => o.value !== '自取')
const TEMP_OPTIONS: TempLayer[] = ['常溫', '冷藏', '冷凍']

// ── 運費矩陣定義（與規劃原始設計一致） ─────────
interface FeeGroup {
  name: string
  dot: string
  sub?: string
  /** [物流商名稱, 客代數, 支援溫層] */
  carriers: Array<[string, number, TempLayer[]]>
}
/** 國內預設運費（本島常溫/冷藏/冷凍、離島常溫/冷藏/冷凍） */
const DOMESTIC_FEE: Record<string, number[]> = {
  on: [60, 110, 130, 100, 150, 170],
  cod: [70, 120, 140, 110, 160, 180],
}
/** 跨境預設運費（馬來西亞常溫/冷藏/冷凍、香港常溫/冷藏/冷凍） */
const CB_FEE: Record<string, number[]> = {
  on: [100, 200, 200, 0, 0, 0],
  cod: [100, 200, 200, 0, 0, 0],
}
/** 「全溫層皆支援」標記；沿用 TEMP_OPTIONS 以免溫層順序漂移導致運費索引對不上 */
const ALL_TEMPS: TempLayer[] = TEMP_OPTIONS
const METHOD_CONFIG: Record<string, FeeGroup[]> = {
  宅配: [
    {
      name: '宅配',
      dot: '#3b82f6',
      carriers: [
        ['新竹物流', 3, ['常溫']],
        ['嘉里大榮常溫', 2, ['常溫']],
        ['嘉里大榮低溫', 0, ['冷藏', '冷凍']],
        ['嘉里快遞', 0, ALL_TEMPS],
        ['黑貓宅急便', 0, ALL_TEMPS],
      ],
    },
  ],
  超商配送: [
    { name: '超商配送 - 黑貓', dot: '#f97316', carriers: [['黑貓宅急便（門市寄件）', 0, ['常溫']]] },
    {
      name: '超商配送 - 7-11',
      dot: '#f97316',
      carriers: [
        ['7-11 B2C 到府收件', 0, ['常溫']],
        ['7-11 B2C 冷凍到府收件', 0, ['冷凍']],
        ['7-11 交貨便（門市寄件）', 0, ['常溫']],
      ],
    },
    {
      name: '超商配送 - 全家',
      dot: '#f97316',
      carriers: [
        ['全家常溫到府收件', 0, ['常溫']],
        ['全家冷凍到府收件', 0, ['冷凍']],
      ],
    },
  ],
  '商家自建（如郵局）': [
    { name: '商家自建（如郵局）', dot: '#8b5cf6', carriers: [['中華郵局', 0, ALL_TEMPS]] },
  ],
}
const CB_GROUPS: FeeGroup[] = [
  { name: 'Presco 跨境物流', dot: '#a855f7', sub: '宅配', carriers: [['Presco 跨境物流（宅配＋超商代收）', 1, ['常溫']]] },
  { name: 'Presco 跨境物流', dot: '#a855f7', sub: '超商配送', carriers: [['Presco 跨境物流（宅配＋超商代收）', 1, ['常溫']]] },
]
const DOMESTIC_REGIONS = ['台灣本島', '台灣離島']
const CB_REGIONS = ['馬來西亞（目的地）', '香港（目的地）']

// ── 表單 state ─────────────────────────────────
const name = ref('')
const desc = ref('')
const mode = ref<CheckoutMode>('標單必結')
const temp = ref<TempLayer>('常溫')
const payList = ref<Set<string>>(new Set())
const logiList = ref<Set<string>>(new Set())
const transferNote = ref('')
const couponOn = ref(true)
const rewardOn = ref(true)
const freeShip = ref<number | null>(null)
const feeVals = ref<Record<string, number>>({})
const feeOff = ref<Record<string, boolean>>({})
const feeEdit = ref<Record<string, boolean>>({})
const hasTriedSave = ref(false)

/** 將某購物車設定填入表單（編輯預填、新增帶入預設範本共用） */
function applyRecord(d: MultiCartRecord): void {
  name.value = d.name
  desc.value = d.desc ?? ''
  transferNote.value = d.note ?? ''
  mode.value = d.mode
  temp.value = d.temp
  payList.value = new Set(d.payList)
  logiList.value = new Set(d.logiList)
  couponOn.value = d.coupon
  rewardOn.value = d.reward
  freeShip.value = d.freeShip
  feeVals.value = { ...(d.feeVals ?? {}) }
  feeOff.value = { ...(d.feeOff ?? {}) }
}

// 每次開 dialog 時重置 / 預填
watch(
  () => props.visible,
  (v) => {
    if (!v) return
    hasTriedSave.value = false
    feeEdit.value = {}
    if (props.initial) {
      applyRecord(props.initial)
      return
    }
    // 新增：帶入「預設購物車」的設定作為範本（名稱／說明留空）
    if (props.template) applyRecord(props.template)
    // 新增車只在 4 種直播模式中選（範本若為商城結帳則退回標單必結）
    if (mode.value === '商城結帳') mode.value = '標單必結'
    name.value = ''
    desc.value = ''
    feeVals.value = {}
    feeOff.value = {}
  },
)

// ── 勾選邏輯 ──────────────────────────────────
function togglePay(v: string): void {
  const next = new Set(payList.value)
  next.has(v) ? next.delete(v) : next.add(v)
  payList.value = next
}
function toggleLogi(v: string): void {
  const next = new Set(logiList.value)
  next.has(v) ? next.delete(v) : next.add(v)
  logiList.value = next
}
/** 自取獨立開關；資料仍存於 logiList（payload 不變），僅呈現改為 ToggleSwitch */
const selfPickupOn = computed<boolean>({
  get: () => logiList.value.has('自取'),
  set: (v) => {
    const next = new Set(logiList.value)
    v ? next.add('自取') : next.delete('自取')
    logiList.value = next
  },
})
const isTransferSelected = computed(() => payList.value.has('轉帳匯款'))

// ── 運費矩陣 ──────────────────────────────────
/** 需要運費的付款欄（線上付款＝任一非貨到付款；貨到付款） */
const feePays = computed<Array<[string, string]>>(() => {
  const pays: Array<[string, string]> = []
  if ([...payList.value].some((p) => p !== '貨到付款')) pays.push(['線上付款', 'on'])
  if (payList.value.has('貨到付款')) pays.push(['貨到付款', 'cod'])
  return pays
})
const domesticGroups = computed<FeeGroup[]>(() =>
  Object.keys(METHOD_CONFIG)
    .filter((m) => logiList.value.has(m))
    .flatMap((m) => METHOD_CONFIG[m]),
)
const showCrossBorder = computed(() => logiList.value.has('跨境'))
const isFeeEmpty = computed(
  () => feePays.value.length === 0 || (domesticGroups.value.length === 0 && !showCrossBorder.value),
)

const rowKeyOf = (scope: string, g: FeeGroup, payId: string) =>
  `${scope}|${g.name}|${g.sub ?? ''}|${payId}`
const cellKeyOf = (scope: string, g: FeeGroup, payId: string, k: number) =>
  `${rowKeyOf(scope, g, payId)}|${k}`
function defaultFeeOf(scope: string, payId: string, k: number): number {
  return (scope === 'dom' ? DOMESTIC_FEE : CB_FEE)[payId][k]
}
function cellValue(scope: string, g: FeeGroup, payId: string, k: number): number {
  return feeVals.value[cellKeyOf(scope, g, payId, k)] ?? defaultFeeOf(scope, payId, k)
}
function setCellValue(scope: string, g: FeeGroup, payId: string, k: number, v: number | null): void {
  feeVals.value[cellKeyOf(scope, g, payId, k)] = Number(v ?? 0)
}
function isRowOff(scope: string, g: FeeGroup, payId: string): boolean {
  return !!feeOff.value[rowKeyOf(scope, g, payId)]
}
function toggleRowOff(scope: string, g: FeeGroup, payId: string): void {
  const key = rowKeyOf(scope, g, payId)
  feeOff.value = { ...feeOff.value, [key]: !feeOff.value[key] }
}
function toggleFeeEdit(scope: string): void {
  feeEdit.value = { ...feeEdit.value, [scope]: !feeEdit.value[scope] }
}
/** 每個地區的 3 欄溫層順序與 TEMP_OPTIONS 相同（常溫/冷藏/冷凍）；0-based */
const selectedTempIndex = computed(() => TEMP_OPTIONS.indexOf(temp.value))

// ── 溫層支援過濾（配送溫層為單選 → 矩陣收斂到該溫層） ──
function carrierSupports(c: [string, number, TempLayer[]], t: TempLayer): boolean {
  return c[2].includes(t)
}
function groupSupportsTemp(g: FeeGroup, t: TempLayer): boolean {
  return g.carriers.some((c) => carrierSupports(c, t))
}
/** 群組內只列出支援選定溫層的物流商（左欄說明清單用） */
function visibleCarriers(g: FeeGroup): Array<[string, number, TempLayer[]]> {
  return g.carriers.filter((c) => carrierSupports(c, temp.value))
}
/** 依選定溫層過濾後、實際會出現在矩陣的群組 */
const domGroupsForTemp = computed(() =>
  domesticGroups.value.filter((g) => groupSupportsTemp(g, temp.value)),
)
const cbGroupsForTemp = computed(() => CB_GROUPS.filter((g) => groupSupportsTemp(g, temp.value)))
function groupsOfScope(scope: string): FeeGroup[] {
  return scope === 'dom' ? domGroupsForTemp.value : cbGroupsForTemp.value
}

// ── 運費區塊：國內／跨境各一區塊，同一區塊內各地區以欄呈現 ──
interface FeeBlock {
  /** feeEdit / reset 狀態用的唯一鍵 */
  key: string
  title: string
  dataScope: 'dom' | 'cb'
  /** 此區塊要顯示的地區欄；idx 為 6 格運費索引中的地區序（本島=0、離島=1；跨境馬來=0、香港=1），name 供表頭與 aria-label 用 */
  regions: Array<{ name: string; idx: number }>
}
/** 國內配送為單一區塊，本島／離島各為一欄；跨境維持單一區塊（兩目的地欄） */
const feeBlocks = computed<FeeBlock[]>(() => {
  const blocks: FeeBlock[] = []
  if (domesticGroups.value.length) {
    blocks.push({ key: 'dom', title: '國內配送', dataScope: 'dom', regions: DOMESTIC_REGIONS.map((name, idx) => ({ name, idx })) })
  }
  if (showCrossBorder.value) {
    blocks.push({ key: 'cb', title: '跨境配送', dataScope: 'cb', regions: CB_REGIONS.map((name, idx) => ({ name, idx })) })
  }
  return blocks
})
/** 還原此區塊「目前顯示溫層」的格子為預設運費（不動其他地區／溫層，避免靜默清空看不到的資料） */
function resetFees(block: FeeBlock): void {
  const regionIdxs = block.regions.map((r) => r.idx)
  feeVals.value = Object.fromEntries(
    Object.entries(feeVals.value).filter(([k]) => {
      if (!k.startsWith(`${block.dataScope}|`)) return true
      const col = Number(k.split('|').pop())
      return !(regionIdxs.includes(Math.floor(col / 3)) && col % 3 === selectedTempIndex.value)
    }),
  )
}

// ── 驗證（名稱必填；免運 / 運費不可為負數） ────
const isNameInvalid = computed(() => hasTriedSave.value && name.value.trim() === '')
const isFreeShipInvalid = computed(() => freeShip.value != null && freeShip.value < 0)
const hasNegativeFee = computed(() => Object.values(feeVals.value).some((v) => v < 0))
/** 有負數運費的溫層；因畫面只顯示當前溫層，錯誤訊息需指出問題落在哪個溫層 */
const negativeFeeTemps = computed<TempLayer[]>(() => {
  const set = new Set<TempLayer>()
  for (const [k, v] of Object.entries(feeVals.value)) {
    if (v < 0) set.add(TEMP_OPTIONS[Number(k.split('|').pop()) % 3])
  }
  return [...set]
})
const canSave = computed(
  () => name.value.trim() !== '' && !isFreeShipInvalid.value && !hasNegativeFee.value,
)

// ── 動作 ──────────────────────────────────────
function onCancel(): void {
  innerVisible.value = false
}
function onSave(): void {
  hasTriedSave.value = true
  if (!canSave.value) return
  emit('saved', {
    editingId: props.initial?.id,
    record: {
      date: props.initial?.date ?? '',
      id: props.initial?.id ?? props.generatedId,
      on: props.initial?.on ?? true,
      locked: props.initial?.locked,
      name: name.value.trim(),
      desc: desc.value.trim(),
      note: transferNote.value,
      mode: mode.value,
      temp: temp.value,
      coupon: couponOn.value,
      reward: rewardOn.value,
      freeShip: freeShip.value,
      payList: PAY_OPTIONS.filter((p) => payList.value.has(p)),
      logiList: LOGI_OPTIONS.filter((o) => logiList.value.has(o.value)).map((o) => o.value),
      feeVals: { ...feeVals.value },
      feeOff: { ...feeOff.value },
    },
  })
  innerVisible.value = false
}
</script>

<template>
  <Dialog
    v-model:visible="innerVisible"
    modal
    :draggable="false"
    :style="{ width: 'min(860px, calc(100vw - 32px))' }"
    :pt="{
      header: { style: 'padding: 17.5px' },
      content: { style: 'padding: 0 17.5px' },
      footer: { style: 'padding: 0 17.5px 17.5px' },
    }"
  >
    <template #header>
      <span class="font-semibold text-[var(--p-text-color)]" style="font-size: 17.5px">{{ dialogTitle }}</span>
    </template>

    <div class="max-h-[calc(85vh-160px)] overflow-y-auto pt-2 pb-4">
      <Message v-if="hasTriedSave && !canSave" severity="error" class="mb-4" :closable="false">
        請確認紅框標示的欄位皆已正確填寫／選擇（免運金額不可為負數）。
        <template v-if="negativeFeeTemps.length">
          <br />運費為負數的溫層：{{ negativeFeeTemps.join('、') }}，請切換至該溫層修正。
        </template>
      </Message>

      <!-- ═══ 購物車基本設定 ═══ -->
      <p class="section-head">購物車基本設定</p>
      <Divider class="!mt-2 !mb-4" />
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        <div class="flex flex-col gap-2">
          <label for="mc-name" class="text-sm text-[var(--p-text-color)]">
            多購物車名稱 <span class="text-red-600 dark:text-red-400">*</span>
          </label>
          <InputText
            id="mc-name"
            v-model="name"
            :invalid="isNameInvalid"
            placeholder="請輸入名稱，例如：全功能配置"
            class="w-full"
          />
        </div>
        <div class="flex flex-col gap-2">
          <label for="mc-id" class="text-sm text-[var(--p-text-color)]">購物車 ID</label>
          <InputText id="mc-id" :model-value="cartId" disabled class="w-full" />
        </div>
      </div>
      <div class="flex flex-col gap-2 mb-4">
        <label for="mc-desc" class="text-sm text-[var(--p-text-color)]">購物車說明</label>
        <InputText
          id="mc-desc"
          v-model="desc"
          placeholder="例如：新建收單時將自動套用此設定"
          class="w-full"
        />
      </div>

      <!-- ═══ 金流設定 ═══ -->
      <p class="section-head">金流設定</p>
      <Divider class="!mt-2 !mb-4" />
      <div class="flex flex-col gap-2 mb-4">
        <span class="text-sm text-[var(--p-text-color)] flex flex-wrap items-center gap-x-2">
          <span class="inline-flex items-center gap-1">
            結帳模式
            <span class="text-xs font-normal text-[var(--p-text-muted-color)]">單選；游標移到 ⓘ 看說明</span>
          </span>
          <span class="ml-auto text-xs font-normal text-[var(--p-text-muted-color)]">＊商城商品為可自由勾選與移除商品，不屬於上述任一種模式。</span>
        </span>
        <!-- 收單下標結帳模式：4 種直播模式單選 -->
        <div class="border border-[var(--p-content-border-color)] rounded-xl p-4 flex flex-wrap items-center gap-x-5 gap-y-3">
          <span v-for="opt in liveModeOptions" :key="opt.value" class="inline-flex items-center gap-2">
            <RadioButton v-model="mode" :input-id="`mc-mode-${opt.value}`" :value="opt.value" />
            <label :for="`mc-mode-${opt.value}`" class="text-sm text-[var(--p-text-color)] cursor-pointer">
              {{ opt.value }}
            </label>
            <i
              v-tooltip.top="opt.info"
              class="pi pi-info-circle text-[var(--p-text-muted-color)] cursor-help"
              style="font-size: 13px"
            ></i>
          </span>
        </div>
      </div>
      <div class="flex flex-col gap-2 mb-4">
        <span class="text-sm text-[var(--p-text-color)]">
          支付方式設定 <span class="text-xs font-normal text-[var(--p-text-muted-color)]">複選</span>
        </span>
        <div class="border border-[var(--p-content-border-color)] rounded-xl p-4 grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2">
          <span v-for="p in PAY_OPTIONS" :key="p" class="inline-flex items-center gap-2 min-w-0">
            <Checkbox
              :model-value="payList.has(p)"
              binary
              :input-id="`mc-pay-${p}`"
              @update:model-value="togglePay(p)"
            />
            <label :for="`mc-pay-${p}`" class="text-sm text-[var(--p-text-color)] cursor-pointer whitespace-nowrap">
              {{ p }}
            </label>
          </span>
        </div>
      </div>
      <div v-if="isTransferSelected" class="flex flex-col gap-2 mb-4">
        <span class="text-sm text-[var(--p-text-color)]">轉帳匯款金流備註</span>
        <Editor v-model="transferNote" editor-style="height: 110px" placeholder="輸入轉帳匯款金流備註…" />
      </div>

      <!-- ═══ 物流設定 ═══ -->
      <p class="section-head">物流設定</p>
      <Divider class="!mt-2 !mb-4" />
      <div class="flex flex-col gap-2 mb-4">
        <span class="text-sm text-[var(--p-text-color)]">
          配送溫層 <span class="text-xs font-normal text-[var(--p-text-muted-color)]">單選</span>
        </span>
        <SelectButton v-model="temp" :options="TEMP_OPTIONS" :allow-empty="false" aria-label="配送溫層" />
      </div>
      <div class="flex flex-col gap-2 mb-4">
        <span class="text-sm text-[var(--p-text-color)]">
          物流方式設定 <span class="text-xs font-normal text-[var(--p-text-muted-color)]">複選</span>
        </span>
        <div class="border border-[var(--p-content-border-color)] rounded-xl p-4 flex flex-wrap gap-x-6 gap-y-2">
          <span v-for="o in logiMethodOptions" :key="o.value" class="inline-flex items-center gap-2">
            <Checkbox
              :model-value="logiList.has(o.value)"
              binary
              :input-id="`mc-logi-${o.value}`"
              @update:model-value="toggleLogi(o.value)"
            />
            <label :for="`mc-logi-${o.value}`" class="text-sm text-[var(--p-text-color)] cursor-pointer whitespace-nowrap">
              {{ o.value }}
            </label>
          </span>
        </div>
        <!-- 自取獨立為開關：不計運費、無物流商、不進運費矩陣，與其他物流方式性質不同 -->
        <div class="flex flex-col gap-2 mt-1">
          <span class="text-sm text-[var(--p-text-color)]">
            自取 <span class="text-xs font-normal text-[var(--p-text-muted-color)]">（不計運費）</span>
          </span>
          <label class="inline-flex items-center gap-2 cursor-pointer w-fit">
            <ToggleSwitch v-model="selfPickupOn" aria-label="自取" />
            <span class="text-sm text-[var(--p-text-color)]">{{ selfPickupOn ? '啟用' : '關閉' }}</span>
          </label>
        </div>
      </div>

      <!-- 運費設定（矩陣） -->
      <div class="flex flex-col gap-2 mb-4">
        <span class="text-sm text-[var(--p-text-color)] inline-flex items-center gap-2">
          運費設定
          <i
            v-tooltip.top="'將帶入預設物流的運費設定，可參考目前預設值直接調整運費。'"
            class="pi pi-info-circle text-[var(--p-text-muted-color)] cursor-help"
            style="font-size: 13px"
          ></i>
        </span>

        <div
          v-if="isFeeEmpty"
          class="border border-[var(--p-content-border-color)] rounded-xl px-4 py-6 text-center text-sm text-[var(--p-text-muted-color)]"
        >
          請先於上方勾選「物流方式設定」與「支付方式設定」，費用表將自動展開。
        </div>

        <template v-else>
          <!-- 國內配送（本島／離島兩欄）／跨境配送 各為獨立區塊 -->
          <template v-for="block in feeBlocks" :key="block.key">
            <div class="flex items-center gap-2 mt-1 flex-wrap">
              <span class="text-sm font-bold text-[var(--p-text-color)]">{{ block.title }}</span>
              <template v-if="groupsOfScope(block.dataScope).length">
                <Button
                  :label="feeEdit[block.key] ? '完成' : '編輯運費'"
                  :icon="feeEdit[block.key] ? 'pi pi-check' : 'pi pi-pen-to-square'"
                  severity="secondary"
                  outlined
                  size="small"
                  @click="toggleFeeEdit(block.key)"
                />
                <Button
                  v-if="feeEdit[block.key]"
                  v-tooltip.top="`還原「${temp}」的預設運費`"
                  label="還原預設"
                  icon="pi pi-refresh"
                  severity="secondary"
                  variant="text"
                  size="small"
                  @click="resetFees(block)"
                />
                <span class="text-xs text-[var(--p-text-muted-color)]">調整過的金額會以圓點標示</span>
              </template>
            </div>

            <!-- 該溫層下無任何物流方式支援 → 收起此表，改用提示 -->
            <div
              v-if="!groupsOfScope(block.dataScope).length"
              class="border border-[var(--p-content-border-color)] rounded-xl px-4 py-6 text-center text-sm text-[var(--p-text-muted-color)]"
            >
              目前選定的配送溫層「{{ temp }}」下，已勾選的{{ block.dataScope === 'dom' ? '國內' : '跨境' }}物流方式皆無支援此溫層，請調整配送溫層或物流方式設定。
            </div>

            <div v-else class="overflow-x-auto rounded-xl border border-[var(--p-content-border-color)]">
              <table class="fee-table w-full border-collapse text-xs" style="min-width: 420px">
                <thead>
                  <tr>
                    <!-- 物流方式欄不設固定寬、只設最小寬 → 吸收剩餘寬度填滿表格；付款/運費欄固定寬，輸入框不會變空盪 -->
                    <th scope="col" style="min-width: 210px">物流方式</th>
                    <th scope="col" style="width: 150px">付款方式</th>
                    <th scope="col" style="width: 150px" v-for="region in block.regions" :key="region.idx">
                      <!-- 單欄區塊：地區已在標題，欄名只顯示溫層；多欄（跨境）：欄名用「地區-溫層」區分目的地 -->
                      <template v-if="block.regions.length === 1">{{ temp }}</template>
                      <template v-else><i class="pi pi-map-marker" style="font-size: 12px"></i> {{ region.name }}-{{ temp }}</template>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <template v-for="g in groupsOfScope(block.dataScope)" :key="g.name + (g.sub ?? '')">
                    <tr v-for="([payLabel, payId], pi) in feePays" :key="payId">
                      <td v-if="pi === 0" :rowspan="feePays.length" class="fee-logi">
                        <div class="flex items-center gap-2 font-bold text-sm text-[var(--p-text-color)]">
                          <span class="inline-block w-[9px] h-[9px] rounded-full shrink-0" :style="{ background: g.dot }"></span>
                          {{ g.name }}
                        </div>
                        <div v-if="g.sub" class="text-xs font-bold mt-1 text-[var(--p-primary-color)]">{{ g.sub }}</div>
                        <div class="mt-2 flex flex-col gap-1">
                          <div
                            v-for="[cName, kdai] in visibleCarriers(g)"
                            :key="cName"
                            class="flex items-center gap-1 text-xs text-[var(--p-text-muted-color)]"
                          >
                            <span class="w-2.5 text-center">›</span>{{ cName }}
                            <Tag v-if="kdai > 0" :value="`${kdai} 客代`" severity="secondary" class="!py-0 !text-xs" />
                          </div>
                        </div>
                      </td>
                      <td class="text-center">
                        <label class="inline-flex items-center gap-2 cursor-pointer">
                          <Checkbox
                            :model-value="!isRowOff(block.dataScope, g, payId)"
                            binary
                            :aria-label="`${g.name} ${payLabel} 啟用`"
                            @update:model-value="toggleRowOff(block.dataScope, g, payId)"
                          />
                          <span
                            class="inline-block text-xs font-bold px-2 py-0.5 rounded whitespace-nowrap"
                            :class="[
                              payId === 'cod'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
                                : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
                              isRowOff(block.dataScope, g, payId) ? 'opacity-45' : '',
                            ]"
                          >{{ payLabel }}</span>
                        </label>
                      </td>
                      <template v-if="isRowOff(block.dataScope, g, payId)">
                        <td
                          v-for="region in block.regions"
                          :key="region.idx"
                          class="text-center text-[var(--p-text-muted-color)]"
                        >—</td>
                      </template>
                      <template v-else>
                        <td v-for="region in block.regions" :key="region.idx" class="text-center">
                          <InputNumber
                            v-if="feeEdit[block.key]"
                            :model-value="cellValue(block.dataScope, g, payId, region.idx * 3 + selectedTempIndex)"
                            :invalid="cellValue(block.dataScope, g, payId, region.idx * 3 + selectedTempIndex) < 0"
                            :use-grouping="false"
                            :aria-label="`${g.name} ${payLabel} ${region.name} ${temp} 運費`"
                            input-class="!w-14 !px-1 !py-1 !text-center !text-xs"
                            @update:model-value="(v) => setCellValue(block.dataScope, g, payId, region.idx * 3 + selectedTempIndex, v)"
                          />
                          <span
                            v-else
                            class="inline-block min-w-11 relative"
                            :class="cellValue(block.dataScope, g, payId, region.idx * 3 + selectedTempIndex) !== defaultFeeOf(block.dataScope, payId, region.idx * 3 + selectedTempIndex)
                              ? 'font-semibold text-amber-700 dark:text-amber-400'
                              : 'text-[var(--p-text-color)]'"
                          >
                            {{ cellValue(block.dataScope, g, payId, region.idx * 3 + selectedTempIndex) }}
                            <span
                              v-if="cellValue(block.dataScope, g, payId, region.idx * 3 + selectedTempIndex) !== defaultFeeOf(block.dataScope, payId, region.idx * 3 + selectedTempIndex)"
                              v-tooltip.top="`預設 ${defaultFeeOf(block.dataScope, payId, region.idx * 3 + selectedTempIndex)}`"
                              class="absolute -top-0.5 -right-1.5 w-1.5 h-1.5 rounded-full bg-amber-500"
                            ></span>
                          </span>
                        </td>
                      </template>
                    </tr>
                  </template>
                </tbody>
              </table>
            </div>
          </template>
        </template>
      </div>

      <!-- ═══ 行銷設定 ═══ -->
      <p class="section-head">行銷設定</p>
      <Divider class="!mt-2 !mb-4" />
      <div class="flex flex-col gap-2 mb-4">
        <span class="text-sm text-[var(--p-text-color)]">優惠券</span>
        <label class="inline-flex items-center gap-2 cursor-pointer w-fit">
          <ToggleSwitch v-model="couponOn" aria-label="優惠券" />
          <span class="text-sm text-[var(--p-text-color)]">{{ couponOn ? '啟用' : '關閉' }}</span>
        </label>
      </div>
      <div class="flex flex-col gap-2 mb-4">
        <span class="text-sm text-[var(--p-text-color)]">紅利點數</span>
        <label class="inline-flex items-center gap-2 cursor-pointer w-fit">
          <ToggleSwitch v-model="rewardOn" aria-label="紅利點數" />
          <span class="text-sm text-[var(--p-text-color)]">{{ rewardOn ? '啟用' : '關閉' }}</span>
        </label>
      </div>
      <div class="flex flex-col gap-2 mb-2">
        <label for="mc-freeship" class="text-sm text-[var(--p-text-color)]">
          免運設定 <span class="text-xs font-normal text-[var(--p-text-muted-color)]">滿多少元免運（留空表示不設定）</span>
        </label>
        <InputNumber
          v-model="freeShip"
          input-id="mc-freeship"
          :invalid="isFreeShipInvalid"
          :use-grouping="false"
          placeholder="例如 2000"
          input-class="!w-[200px]"
        />
      </div>
    </div>

    <template #footer>
      <div class="flex items-center justify-end gap-2">
        <Button label="取消" severity="secondary" variant="text" @click="onCancel" />
        <Button label="儲存" :disabled="hasTriedSave && !canSave" @click="onSave" />
      </div>
    </template>
  </Dialog>
</template>

<style scoped>
/* 區段標題：一般文字色（不用主色），分隔線改用 <Divider> 元件（見 template） */
.section-head {
  font-size: 16px;
  font-weight: 600;
  color: var(--p-text-color);
  margin: 16px 0 0;
}
.section-head:first-child {
  margin-top: 4px;
}
/* 運費矩陣表格線與表頭 */
.fee-table th,
.fee-table td {
  border: 1px solid var(--p-content-border-color);
  padding: 7px 5px;
}
.fee-table thead th {
  background: var(--p-content-hover-background);
  font-weight: 700;
  color: var(--p-text-color);
  text-align: center;
  white-space: nowrap;
}
.fee-table td.fee-logi {
  text-align: left;
  padding: 10px;
  background: var(--p-content-background);
  vertical-align: top;
  min-width: 210px;
}
</style>
