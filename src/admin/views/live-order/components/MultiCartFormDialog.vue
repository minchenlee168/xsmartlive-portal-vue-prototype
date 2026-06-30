<script setup lang="ts">
import { computed, ref, watch } from 'vue'

/**
 * 新增 / 編輯多購物車 dialog。
 *
 * 區塊：
 * - 多購物車名稱
 * - 結帳行為（5 個 toggle card：允許購物車結帳 / 允許使用紅利點數 / 允許自送結帳 / 允許棄標 / 前台結帳發票顯示）
 * - 選擇金流方式（多選 card：轉帳匯款 / 貨到付款 / 自取 / 藍新信用卡 / 藍新 ATM / iPASS / LINE Pay）
 * - 貨到付款過濾（3 個 checkbox + 星等門檻輸入框，僅勾「啟用貨到付款星等過濾」時 enable）
 * - 選擇物流方式（多選 card：宅配 / 超商取貨）
 *
 * 儲存後 emit `saved`，父層自行 push 到 carts 列表。
 */

interface BehaviorState {
  canCheckout: boolean
  allowBonus: boolean
  allowSelfShip: boolean
  allowAbandon: boolean
  showInvoice: boolean
}
interface PaymentFilters {
  byStar: boolean
  starThreshold: number
  byCvs: boolean
  byHomeShipping: boolean
}
export interface MultiCartFormPayload {
  /** 編輯模式才會帶；新增模式 undefined */
  id?: number
  name: string
  behaviors: BehaviorState
  payments: string[]
  paymentFilters: PaymentFilters
  shippings: string[]
}

/** 父層帶進來預填的多購物車（編輯模式） */
export interface MultiCartInitial {
  id: number
  name: string
  behaviors?: Partial<BehaviorState>
  payments?: string[]
  paymentFilters?: Partial<PaymentFilters>
  shippings?: string[]
}

interface Props {
  visible?: boolean
  /** 帶資料 = 編輯該購物車；不帶 = 新增 */
  initial?: MultiCartInitial | null
}
const props = withDefaults(defineProps<Props>(), {
  visible: false,
  initial: null,
})
const emit = defineEmits<{
  'update:visible': [value: boolean]
  saved: [payload: MultiCartFormPayload]
}>()

const isEditMode = computed(() => !!props.initial)
const dialogTitle = computed(() => isEditMode.value ? '編輯多購物車' : '新增多購物車')

const innerVisible = computed<boolean>({
  get: () => props.visible,
  set: (v) => emit('update:visible', v),
})

// ── 表單 state ─────────────────────────────────
const name = ref('')
const behaviors = ref<BehaviorState>({
  canCheckout: true,
  allowBonus: false,
  allowSelfShip: false,
  allowAbandon: false,
  showInvoice: false,
})
const selectedPayments = ref<Set<string>>(new Set())
const paymentFilters = ref<PaymentFilters>({
  byStar: false,
  starThreshold: 3,
  byCvs: false,
  byHomeShipping: false,
})
const selectedShippings = ref<Set<string>>(new Set())

// 每次開 dialog 時重置 / 預填（編輯模式）
watch(() => props.visible, (v) => {
  if (!v) return
  const init = props.initial
  if (init) {
    name.value = init.name
    behaviors.value = {
      canCheckout: true,
      allowBonus: false,
      allowSelfShip: false,
      allowAbandon: false,
      showInvoice: false,
      ...init.behaviors,
    }
    selectedPayments.value = new Set(init.payments ?? [])
    paymentFilters.value = {
      byStar: false,
      starThreshold: 3,
      byCvs: false,
      byHomeShipping: false,
      ...init.paymentFilters,
    }
    selectedShippings.value = new Set(init.shippings ?? [])
    return
  }
  name.value = ''
  behaviors.value = {
    canCheckout: true,
    allowBonus: false,
    allowSelfShip: false,
    allowAbandon: false,
    showInvoice: false,
  }
  selectedPayments.value = new Set()
  paymentFilters.value = { byStar: false, starThreshold: 3, byCvs: false, byHomeShipping: false }
  selectedShippings.value = new Set()
})

// ── 結帳行為 5 個 toggle card ─────────────────
const behaviorCards: Array<{ key: keyof BehaviorState; label: string; desc: string }> = [
  { key: 'canCheckout',   label: '允許購物車結帳',   desc: '關閉後此多購物車不接受結帳' },
  { key: 'allowBonus',    label: '允許使用紅利點數', desc: '結帳頁顯示紅利金折抵欄位' },
  { key: 'allowSelfShip', label: '允許自送結帳',     desc: '商家自行配送、不走第三方物流' },
  { key: 'allowAbandon',  label: '允許棄標',         desc: '得標者可於結帳前取消訂單' },
  { key: 'showInvoice',   label: '前台結帳發票顯示', desc: '在前台結帳頁顯示發票相關欄位' },
]

// ── 金流選項 ──────────────────────────────────
interface PaymentOption {
  id: string
  label: string
  sub: string
}
const paymentOptions: PaymentOption[] = [
  { id: 'transfer',        label: '轉帳匯款',   sub: '商家自有' },
  { id: 'cod',             label: '貨到付款',   sub: '商家自有' },
  { id: 'pickup',          label: '自取',       sub: '商家自有' },
  { id: 'newebpay-credit', label: '藍新金流',   sub: '線上信用卡' },
  { id: 'newebpay-atm',    label: '藍新金流',   sub: 'ATM 繳費帳號' },
  { id: 'ipass',           label: 'iPASS MONEY', sub: 'iPASS MONEY' },
  { id: 'linepay',         label: 'LINE Pay',   sub: 'LINE Pay' },
]
function togglePayment(id: string): void {
  const next = new Set(selectedPayments.value)
  next.has(id) ? next.delete(id) : next.add(id)
  selectedPayments.value = next
}
function isPaymentSelected(id: string): boolean {
  return selectedPayments.value.has(id)
}

// ── 物流選項 ──────────────────────────────────
interface ShippingOption {
  id: string
  label: string
  sub: string
}
const shippingOptions: ShippingOption[] = [
  { id: 'home', label: '宅配',     sub: '7-11 (Mock)、嘉里大榮 (Mock)' },
  { id: 'cvs',  label: '超商取貨', sub: '7-11 (Mock)' },
]
function toggleShipping(id: string): void {
  const next = new Set(selectedShippings.value)
  next.has(id) ? next.delete(id) : next.add(id)
  selectedShippings.value = next
}
function isShippingSelected(id: string): boolean {
  return selectedShippings.value.has(id)
}

// ── 動作 ──────────────────────────────────────
const canSave = computed(() => name.value.trim() !== '')

function onCancel(): void {
  innerVisible.value = false
}
function onSave(): void {
  if (!canSave.value) return
  emit('saved', {
    id: props.initial?.id,
    name: name.value.trim(),
    behaviors: { ...behaviors.value },
    payments: Array.from(selectedPayments.value),
    paymentFilters: { ...paymentFilters.value },
    shippings: Array.from(selectedShippings.value),
  })
  innerVisible.value = false
}
</script>

<template>
  <Dialog
    v-model:visible="innerVisible"
    modal
    :draggable="false"
    :style="{ width: 'min(900px, calc(100vw - 32px))' }"
    :pt="{
      header: { style: 'padding: 17.5px' },
      content: { style: 'padding: 0 17.5px' },
      footer: { style: 'padding: 0 17.5px 17.5px' },
    }"
  >
    <template #header>
      <span class="font-semibold text-[var(--p-text-color)]" style="font-size: 17.5px">{{ dialogTitle }}</span>
    </template>

    <div class="max-h-[calc(85vh-160px)] overflow-y-auto pt-2 pb-4 flex flex-col gap-6">
      <!-- 多購物車名稱 -->
      <div class="flex flex-col gap-1.5">
        <label class="text-sm font-bold text-color">多購物車名稱</label>
        <InputText
          v-model="name"
          placeholder="例如：端午節限定、直播2026_0517"
          class="w-full"
        />
      </div>

      <!-- 結帳行為 -->
      <section class="flex flex-col gap-3">
        <h3 class="text-[16px] font-bold text-[var(--p-text-color)]">結帳行為</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div
            v-for="card in behaviorCards"
            :key="card.key"
            class="border border-[var(--p-content-border-color)] rounded-md p-4 flex items-center justify-between gap-3"
          >
            <div class="flex flex-col gap-0.5 min-w-0">
              <span class="text-[14px] font-bold text-[var(--p-text-color)]">{{ card.label }}</span>
              <span class="text-xs text-[var(--p-text-muted-color)]">{{ card.desc }}</span>
            </div>
            <ToggleSwitch v-model="behaviors[card.key]" />
          </div>
        </div>
      </section>

      <!-- 選擇金流方式 -->
      <section class="flex flex-col gap-3">
        <h3 class="flex items-center gap-2 text-[16px] font-bold text-[var(--p-text-color)]">
          <i class="pi pi-credit-card text-[var(--p-text-muted-color)]" style="font-size: 16px"></i>
          選擇金流方式
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button
            v-for="opt in paymentOptions"
            :key="opt.id"
            type="button"
            class="border rounded-md p-4 flex items-center justify-between gap-3 text-left transition-colors"
            :class="isPaymentSelected(opt.id)
              ? 'border-[var(--p-primary-color)] bg-[var(--p-primary-50)]/30'
              : 'border-[var(--p-content-border-color)] hover:bg-[var(--p-content-hover-background)]'"
            @click="togglePayment(opt.id)"
          >
            <div class="flex flex-col gap-0.5 min-w-0">
              <span class="text-[14px] font-bold text-[var(--p-text-color)]">{{ opt.label }}</span>
              <span class="text-xs text-[var(--p-text-muted-color)]">{{ opt.sub }}</span>
            </div>
            <Checkbox :model-value="isPaymentSelected(opt.id)" binary />
          </button>
        </div>

        <!-- 貨到付款過濾 -->
        <div class="mt-2 flex flex-col gap-2">
          <h4 class="text-[14px] font-bold text-[var(--p-text-color)]">貨到付款過濾</h4>
          <div class="flex flex-col gap-2 rounded-md border border-[var(--p-content-border-color)] p-3">
            <label class="flex items-center gap-2 cursor-pointer">
              <Checkbox v-model="paymentFilters.byStar" binary />
              <span class="text-[14px]">啟用貨到付款星等過濾</span>
            </label>
            <!-- 啟用時才能輸入星等門檻 -->
            <div class="ml-6 rounded-md bg-[var(--p-content-hover-background)] px-3 py-2 text-[13px]"
                 :class="paymentFilters.byStar ? 'text-[var(--p-text-color)]' : 'text-[var(--p-text-muted-color)]'">
              星等以下的客人不會顯示貨到付款選項
            </div>
            <label class="flex items-center gap-2 cursor-pointer">
              <Checkbox v-model="paymentFilters.byCvs" binary />
              <span class="text-[14px]">啟用超商貨到付款過濾</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer">
              <Checkbox v-model="paymentFilters.byHomeShipping" binary />
              <span class="text-[14px]">啟用宅配貨到付款過濾</span>
            </label>
          </div>
        </div>
      </section>

      <!-- 選擇物流方式 -->
      <section class="flex flex-col gap-3">
        <h3 class="flex items-center gap-2 text-[16px] font-bold text-[var(--p-text-color)]">
          <i class="pi pi-truck text-[var(--p-text-muted-color)]" style="font-size: 16px"></i>
          選擇物流方式
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button
            v-for="opt in shippingOptions"
            :key="opt.id"
            type="button"
            class="border rounded-md p-4 flex items-center justify-between gap-3 text-left transition-colors"
            :class="isShippingSelected(opt.id)
              ? 'border-[var(--p-primary-color)] bg-[var(--p-primary-50)]/30'
              : 'border-[var(--p-content-border-color)] hover:bg-[var(--p-content-hover-background)]'"
            @click="toggleShipping(opt.id)"
          >
            <div class="flex flex-col gap-0.5 min-w-0">
              <span class="text-[14px] font-bold text-[var(--p-text-color)]">{{ opt.label }}</span>
              <span class="text-xs text-[var(--p-text-muted-color)]">{{ opt.sub }}</span>
            </div>
            <Checkbox :model-value="isShippingSelected(opt.id)" binary />
          </button>
        </div>
      </section>
    </div>

    <template #footer>
      <div class="flex items-center justify-end gap-2">
        <Button label="取消" severity="secondary" variant="text" @click="onCancel" />
        <Button label="儲存" :disabled="!canSave" @click="onSave" />
      </div>
    </template>
  </Dialog>
</template>
