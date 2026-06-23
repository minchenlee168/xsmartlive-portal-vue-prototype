<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

/**
 * 得標設定表單：選完商品後設定該商品在直播中的「下標行為」。
 * 商品基本資料（名稱 / 圖片 / 價格 / 庫存）由 picker 帶入，這裡只設下標行為。
 *
 * 欄位（依需求）：
 * 結帳類型 / 多購物車 / 競價模式 / 一刀價格 / 允許包色 / 允許超賣 /
 * 得標後再選規格 / SKU / +1 數量限制 / 星等過濾 / 新客不限星等 / 僅限會員得標
 */

interface PickedProduct {
  id?: number
  name?: string
  sku?: string
  cost?: number
  price?: number
  stock?: number
  [key: string]: unknown
}

/**
 * 數量優惠（階梯定價）：達到 quantity 件時，每件依優惠方式計價。
 * 用金額（折抵售價）或趴數（折扣百分比）表示，因多商品共用設定、各自售價不同。
 */
export interface QuantityDiscount {
  quantity: number
  discountType: 'amount' | 'percent'
  discountValue: number
}

export interface OrderSettingFormData {
  checkoutType: string
  multiCart: string | null
  bidding: boolean
  flatPrice: number
  /** 起標價格：僅競價模式有意義（bidding 關閉時歸 0） */
  startingBid: number
  allowMixColor: boolean
  allowOversell: boolean
  pickSpecAfterWinning: boolean
  /** 後選規：留言下單時不選規格，僅以關鍵字下單；得標後再個別選規格 */
  postPickSpec: boolean
  sku: string
  plusLimit: number
  starFilter: string
  newCustomerAnyStar: boolean
  memberOnly: boolean
  /** 數量優惠階梯，可多筆 */
  quantityDiscounts: QuantityDiscount[]
}

interface Props {
  product?: PickedProduct
  /** 多選模式：共同設定一次套用到多個商品（隱藏單筆 SKU、改顯示已選摘要）。 */
  multiple?: boolean
  /** 多選模式下已選商品名稱，用於顯示摘要 chips。 */
  pickedNames?: string[]
}
const props = withDefaults(defineProps<Props>(), {
  product: () => ({}),
  multiple: false,
  pickedNames: () => [],
})

const { t } = useI18n()

const form = reactive<OrderSettingFormData>({
  checkoutType: '一般購物車',
  multiCart: null,
  bidding: false,
  flatPrice: 0,
  startingBid: 0,
  allowMixColor: false,
  allowOversell: false,
  pickSpecAfterWinning: false,
  postPickSpec: false,
  sku: '',
  plusLimit: 0,
  starFilter: 'any',
  newCustomerAnyStar: false,
  memberOnly: false,
  quantityDiscounts: [],
})

watch(
  () => props.product,
  (p) => {
    if (!p) return
    form.sku = p.sku ?? ''
    // 編輯既有商品時，預填先前儲存過的得標設定欄位。
    // 型別相符才覆蓋；可為 null 的欄位（如 multiCart）放寬接受字串值。
    const src = p as Record<string, unknown>
    ;(Object.keys(form) as Array<keyof OrderSettingFormData>).forEach((k) => {
      const v = src[k as string]
      if (v !== undefined && (typeof v === typeof form[k] || form[k] === null)) {
        ;(form as Record<string, unknown>)[k as string] = v
      }
    })
    // 數量優惠是陣列：深拷貝避免與商品物件共用參考（編輯時直接改到原資料）
    form.quantityDiscounts = Array.isArray(src.quantityDiscounts)
      ? (src.quantityDiscounts as QuantityDiscount[]).map(t => ({ ...t }))
      : []
  },
  { immediate: true, deep: true },
)

const checkoutTypes = computed(() => [
  { label: t('live_order.checkout_type.normal'),               value: '一般購物車' },
  { label: t('live_order.checkout_type.preorder_on_arrival'),  value: '預購-到貨再結帳' },
  { label: t('live_order.checkout_type.multi_cart_separate'),  value: '多購物車-獨立結帳' },
])

/** 預購結帳類型：得標後一律於結帳時選規格，故隱藏「得標後再選規格」開關。 */
const PREORDER_CHECKOUT = '預購-到貨再結帳'
const isPreorder = computed(() => form.checkoutType === PREORDER_CHECKOUT)

// 切到預購時把「得標後再選規格」歸 false，避免存進與此模式無關的設定
watch(isPreorder, (preorder) => {
  if (preorder) form.pickSpecAfterWinning = false
})

// 競價模式關閉時把一刀價格、起標價格歸 0（兩者僅競價模式有意義）
watch(() => form.bidding, (bidding) => {
  if (!bidding) {
    form.flatPrice = 0
    form.startingBid = 0
  }
})
const multiCarts = computed(() => [
  { label: t('live_order.multi_cart.live_cart'),    value: 'live-cart' },
  { label: t('live_order.multi_cart.vip_cart'),     value: 'vip-cart' },
  { label: t('live_order.multi_cart.frozen_cart'),  value: 'frozen-cart' },
  { label: t('live_order.multi_cart.ambient_cart'), value: 'ambient-cart' },
])
const starOptions = computed(() => [
  { label: t('live_order.star_filter.any'),        value: 'any' },
  { label: t('live_order.star_filter.one_plus'),   value: '1' },
  { label: t('live_order.star_filter.two_plus'),   value: '2' },
  { label: t('live_order.star_filter.three_plus'), value: '3' },
  { label: t('live_order.star_filter.four_plus'),  value: '4' },
  { label: t('live_order.star_filter.five'),       value: '5' },
])
const discountTypeOptions = computed(() => [
  { label: t('live_order.label.discount_amount'),  value: 'amount' },
  { label: t('live_order.label.discount_percent'), value: 'percent' },
])

const displayPicked = computed(() => {
  const p = props.product
  if (!p) return ''
  return p.name ?? ''
})

const hasError = ref(false)

function validate(): boolean {
  return true
}

/** 把表單資料 + picker 帶入的基本資料合併成可加進 session 的商品物件 */
function getData(): Record<string, unknown> {
  return {
    ...form,
    // 商品基本資料維持 picker 提供的
    id: Date.now(),
    name: props.product?.name ?? '',
    cost: props.product?.cost ?? 0,
    price: props.product?.price ?? 0,
    stock: props.product?.stock ?? 0,
    sku: form.sku || props.product?.sku || `NEW-${Date.now()}`,
  }
}

function reset(): void {
  Object.assign(form, {
    checkoutType: '一般購物車',
    multiCart: null,
    bidding: false,
    flatPrice: 0,
    startingBid: 0,
    allowMixColor: false,
    allowOversell: false,
    pickSpecAfterWinning: false,
    postPickSpec: false,
    sku: '',
    plusLimit: 0,
    starFilter: 'any',
    newCustomerAnyStar: false,
    memberOnly: false,
    quantityDiscounts: [],
  })
  hasError.value = false
}

/** 新增一筆數量優惠階梯（預設用金額折抵）。 */
function addQuantityDiscount(): void {
  form.quantityDiscounts.push({ quantity: 0, discountType: 'amount', discountValue: 0 })
}

/** 移除指定數量優惠階梯。 */
function removeQuantityDiscount(index: number): void {
  form.quantityDiscounts.splice(index, 1)
}

/** 只取得標設定欄位（不含 picker 帶入的基本資料）。 */
function getSettings(): OrderSettingFormData {
  return { ...form, quantityDiscounts: form.quantityDiscounts.map(t => ({ ...t })) }
}

/** 外部觸發改寫單一欄位（例如庫存問題彈窗選了「啟用超賣」→ 強制 allowOversell=true）。 */
function setAllowOversell(value: boolean): void {
  form.allowOversell = value
}

defineExpose({ validate, getData, getSettings, reset, setAllowOversell })
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- 已選商品提示（單筆） -->
    <div
      v-if="!multiple && displayPicked"
      class="flex items-center gap-3 bg-[var(--p-content-hover-background)] border border-[var(--p-content-border-color)] rounded-[6px] px-3 py-2"
    >
      <i class="pi pi-box text-[var(--p-primary-color)]" style="font-size: 18px"></i>
      <div class="flex flex-col">
        <span class="text-[11px] text-[var(--p-text-muted-color)]">
          {{ t('live_order.label.picked_product') }}
        </span>
        <span class="text-[14px] font-medium text-[var(--p-text-color)]">
          {{ displayPicked }}
        </span>
      </div>
    </div>

    <!-- 已選商品摘要（多選）：相同得標設定一次套用到全部 -->
    <div
      v-if="multiple"
      class="flex flex-col gap-2 bg-[var(--p-content-hover-background)] border border-[var(--p-content-border-color)] rounded-[6px] px-3 py-2.5"
    >
      <i18n-t
        keypath="live_order.form.hint.multi_selected_count"
        tag="span"
        scope="global"
        class="text-[13px] text-[var(--p-text-muted-color)]"
      >
        <template #count>
          <span class="text-primary font-semibold">{{ pickedNames.length }}</span>
        </template>
      </i18n-t>
      <div
        v-if="pickedNames.length"
        class="flex flex-wrap gap-1.5"
      >
        <span
          v-for="(name, i) in pickedNames"
          :key="i"
          class="text-[12px] text-[var(--p-text-color)] bg-[var(--p-content-background)] border border-[var(--p-content-border-color)] rounded-full px-2 py-0.5"
        >
          {{ name }}
        </span>
      </div>
    </div>

    <!-- 下拉 / 數值欄位：2 欄等寬（比照批次設定排版） -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
      <!-- 結帳類型 -->
      <div class="flex flex-col gap-1.5">
        <span class="text-[13px] text-[var(--p-text-color)]">
          {{ t('live_order.form.field.checkout_type') }}
        </span>
        <Select
          v-model="form.checkoutType"
          :options="checkoutTypes"
          option-label="label"
          option-value="value"
          class="w-full"
        />
      </div>

      <!-- 多購物車：只有結帳類型 = 多購物車-獨立結帳 才可選；一般 / 預購 → disabled -->
      <div class="flex flex-col gap-1.5">
        <span class="text-[13px] text-[var(--p-text-color)]">
          {{ t('live_order.form.field.multi_cart') }}
        </span>
        <Select
          v-model="form.multiCart"
          :options="multiCarts"
          option-label="label"
          option-value="value"
          :disabled="form.checkoutType !== '多購物車-獨立結帳'"
          :placeholder="t('live_order.form.placeholder.multi_cart_name')"
          class="w-full"
        />
      </div>

      <!-- +1 數量限制 -->
      <div class="flex flex-col gap-1.5">
        <span class="text-[13px] text-[var(--p-text-color)]">
          {{ t('live_order.form.field.plus_one_limit') }}
        </span>
        <InputNumber
          v-model="form.plusLimit"
          :min="0"
          class="w-full"
          :input-style="{ width: '100%' }"
        />
      </div>

      <!-- 星等過濾 -->
      <div class="flex flex-col gap-1.5">
        <span class="text-[13px] text-[var(--p-text-color)]">
          {{ t('live_order.form.field.star_filter') }}
        </span>
        <Select
          v-model="form.starFilter"
          :options="starOptions"
          option-label="label"
          option-value="value"
          :placeholder="t('live_order.form.placeholder.no_limit')"
          class="w-full"
        />
      </div>

      <!-- SKU（多選時隱藏，各商品沿用自身 SKU） -->
      <div
        v-if="!multiple"
        class="flex flex-col gap-1.5"
      >
        <span class="text-[13px] text-[var(--p-text-color)]">
          {{ t('live_order.form.field.sku') }}
        </span>
        <InputText v-model="form.sku" class="w-full" />
      </div>
    </div>

    <!-- 開關選項：每列 label 左、switch 右，外框＋分隔線收齊 -->
    <div class="flex flex-col rounded-[6px] border border-[var(--p-content-border-color)] divide-y divide-[var(--p-content-border-color)]">
      <div class="flex items-center justify-between gap-3 px-3 py-2.5">
        <span class="text-[13px] text-[var(--p-text-color)]">{{ t('live_order.form.field.bidding') }}</span>
        <ToggleSwitch v-model="form.bidding" />
      </div>
      <!-- 競價價格：競價模式正下方就地展開（一刀價格 + 起標價格） -->
      <div v-if="form.bidding" class="px-3 py-2.5 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
        <div class="flex flex-col gap-1.5">
          <span class="text-[13px] text-[var(--p-text-color)]">{{ t('live_order.form.field.flat_price') }}</span>
          <InputNumber v-model="form.flatPrice" :min="0" class="w-full" :input-style="{ width: '100%' }" />
        </div>
        <div class="flex flex-col gap-1.5">
          <span class="text-[13px] text-[var(--p-text-color)]">{{ t('live_order.form.field.starting_bid') }}</span>
          <InputNumber v-model="form.startingBid" :min="0" class="w-full" :input-style="{ width: '100%' }" />
        </div>
      </div>
      <div class="flex items-center justify-between gap-3 px-3 py-2.5">
        <span class="flex items-center gap-1 text-[13px] text-[var(--p-text-color)]">
          {{ t('live_order.form.field.allow_mix_color') }}
          <i
            class="pi pi-info-circle text-[var(--p-text-muted-color)]"
            style="font-size: 12px"
            v-tooltip.top="t('live_order.form.hint.allow_mix_color_tooltip')"
          ></i>
        </span>
        <ToggleSwitch v-model="form.allowMixColor" />
      </div>
      <div class="flex items-center justify-between gap-3 px-3 py-2.5">
        <span class="text-[13px] text-[var(--p-text-color)]">{{ t('live_order.form.field.allow_oversell') }}</span>
        <ToggleSwitch v-model="form.allowOversell" />
      </div>
      <div
        v-if="!isPreorder"
        class="flex items-center justify-between gap-3 px-3 py-2.5"
      >
        <span class="flex items-center gap-1 text-[13px] text-[var(--p-text-color)]">
          {{ t('live_order.form.field.pick_spec_after_winning') }}
          <i
            class="pi pi-info-circle text-[var(--p-text-muted-color)]"
            style="font-size: 12px"
            v-tooltip.top="t('live_order.form.hint.pick_spec_after_winning_tooltip')"
          ></i>
        </span>
        <ToggleSwitch v-model="form.pickSpecAfterWinning" />
      </div>
      <div class="flex items-center justify-between gap-3 px-3 py-2.5">
        <span class="flex items-center gap-1 text-[13px] text-[var(--p-text-color)]">
          {{ t('live_order.form.field.post_pick_spec') }}
          <i
            class="pi pi-info-circle text-[var(--p-text-muted-color)]"
            style="font-size: 12px"
            v-tooltip.top="t('live_order.form.hint.post_pick_spec_tooltip')"
          ></i>
        </span>
        <ToggleSwitch v-model="form.postPickSpec" />
      </div>
      <div class="flex items-center justify-between gap-3 px-3 py-2.5">
        <span class="text-[13px] text-[var(--p-text-color)]">{{ t('live_order.form.field.new_customer_any_star') }}</span>
        <ToggleSwitch v-model="form.newCustomerAnyStar" />
      </div>
      <div class="flex items-center justify-between gap-3 px-3 py-2.5">
        <span class="text-[13px] text-[var(--p-text-color)]">{{ t('live_order.form.field.member_only') }}</span>
        <ToggleSwitch v-model="form.memberOnly" />
      </div>
    </div>

    <!-- 數量優惠（階梯定價，可多筆）。多商品共用設定，故用金額折抵或趴數折扣表示 -->
    <div class="flex flex-col gap-2">
      <span class="text-[13px] font-medium text-[var(--p-text-color)]">
        {{ t('live_order.form.field.quantity_discount') }}
      </span>
      <span v-if="form.quantityDiscounts.length" class="text-[12px] text-[var(--p-text-muted-color)]">
        {{ t('live_order.form.hint.quantity_discount') }}
      </span>

      <div
        v-for="(tier, i) in form.quantityDiscounts"
        :key="i"
        class="flex items-center gap-2"
      >
        <InputNumber
          v-model="tier.quantity"
          :min="0"
          suffix=" 件"
          class="w-28 shrink-0"
          :input-style="{ width: '100%' }"
        />
        <InputGroup class="flex-1">
          <Select
            v-model="tier.discountType"
            :options="discountTypeOptions"
            option-label="label"
            option-value="value"
            class="w-32 shrink-0"
          />
          <InputNumber
            v-model="tier.discountValue"
            :min="0"
            :max="tier.discountType === 'percent' ? 100 : undefined"
            :placeholder="tier.discountType === 'percent'
              ? t('live_order.form.placeholder.discount_percent')
              : t('live_order.form.placeholder.discount_amount')"
            :input-style="{ width: '100%' }"
          />
          <InputGroupAddon>
            {{ tier.discountType === 'percent' ? t('live_order.label.unit_percent') : t('live_order.label.unit_amount') }}
          </InputGroupAddon>
        </InputGroup>
        <Button
          text
          rounded
          severity="danger"
          class="w-8 h-8 shrink-0"
          v-tooltip.top="t('common.button.delete')"
          @click="removeQuantityDiscount(i)"
        >
          <template #icon>
            <i class="pi pi-trash" style="font-size: 13px" />
          </template>
        </Button>
      </div>

      <Button
        :label="t('live_order.button.add_quantity_discount')"
        icon="pi pi-plus"
        text
        size="small"
        class="self-start"
        @click="addQuantityDiscount"
      />
    </div>
  </div>
</template>
