<template>
  <Dialog
    v-model:visible="innerVisible"
    modal :draggable="false"
    :style="{ width: 'min(760px, calc(100vw - 32px))' }"
    :pt="{
      header:  { style: 'padding: 17.5px' },
      content: { style: 'padding: 0 17.5px 17.5px' },
      footer:  { style: 'padding: 0 17.5px 17.5px' },
    }"
    @update:visible="v => emit('update:visible', v)">

    <template #header>
      <span class="font-semibold text-[var(--p-text-color)]" style="font-size:17.5px">{{ t('live_order.dialog.batch_edit_header') }}</span>
    </template>

    <div class="flex flex-col gap-4">

      <!-- 步驟指示 -->
      <div class="flex items-center gap-2">
        <template v-for="(s, i) in steps" :key="s.step">
          <div class="flex items-center gap-2">
            <span
              class="w-[24px] h-[24px] rounded-full flex items-center justify-center text-[13px] font-bold"
              :class="currentStep >= s.step
                ? 'bg-[var(--p-primary-color)] text-white'
                : 'bg-[var(--p-content-hover-background)] text-[var(--p-text-muted-color)]'"
            >{{ s.step }}</span>
            <span
              class="text-sm font-medium"
              :class="currentStep === s.step ? 'text-[var(--p-text-color)]' : 'text-[var(--p-text-muted-color)]'"
            >{{ s.label }}</span>
          </div>
          <div v-if="i < steps.length - 1" class="flex-1 h-px bg-[var(--p-content-border-color)]"></div>
        </template>
      </div>

      <div class="border-t border-[var(--p-content-border-color)]"></div>

      <!-- 步驟 1：勾選要套用的商品卡 -->
      <div v-show="currentStep === 1" class="flex flex-col gap-3">
        <div class="text-[13px] text-[var(--p-text-color)]">{{ t('live_order.form.hint.batch_pick_products') }}</div>
        <DataTable :value="products" v-model:selection="selectedRows"
          data-key="id" :striped-rows="true"
          scrollable scroll-height="360px" class="w-full">
          <Column selection-mode="multiple" header-style="width:48px" />
          <Column :header="t('live_order.table.column.product_image')" header-style="width:120px">
            <template #body>
              <div class="w-[56px] h-[56px] rounded border border-dashed border-[var(--p-content-border-color)] bg-[var(--p-content-hover-background)] flex items-center justify-center">
                <i class="pi pi-image text-[var(--p-text-muted-color)]" style="font-size:20px"></i>
              </div>
            </template>
          </Column>
          <Column :header="t('live_order.table.column.product_name')" field="name">
            <template #body="{ data }">
              <span class="text-sm text-[var(--p-text-color)]">{{ data.name || t('live_order.table.value.unnamed_product') }}</span>
            </template>
          </Column>
          <template #empty>
            <div class="flex flex-col items-center justify-center gap-2 py-12">
              <i class="pi pi-inbox text-5xl text-[var(--p-text-muted-color)]"></i>
              <span class="text-sm text-[var(--p-text-muted-color)]">{{ t('live_order.empty.no_session_product') }}</span>
            </div>
          </template>
        </DataTable>
      </div>

      <!-- 步驟 2：對已選商品設定得標設定 -->
      <div v-show="currentStep === 2" class="flex flex-col gap-4">
        <i18n-t
          keypath="live_order.form.hint.batch_selected_count"
          tag="div"
          scope="global"
          class="text-[13px] text-[var(--p-text-muted-color)]"
        >
          <template #count>
            <span class="text-primary font-semibold">{{ selectedRows.length }}</span>
          </template>
        </i18n-t>

        <!-- 下拉 / 數值欄位：2 欄等寬（只有改動過的欄位會套用） -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
          <!-- 結帳類型 -->
          <div class="flex flex-col gap-2">
            <span class="text-[13px] text-[var(--p-text-color)]">
              {{ t('live_order.form.field.checkout_type') }}
            </span>
            <Select v-model="form.checkoutType" :options="checkoutTypeOptions"
              option-label="label" option-value="value" class="w-full" />
          </div>

          <!-- 多購物車：只有結帳類型 = 多購物車-獨立結帳 才可選；一般 / 預購 → disabled -->
          <div class="flex flex-col gap-2">
            <span class="text-[13px] text-[var(--p-text-color)]">
              {{ t('live_order.form.field.multi_cart') }}
            </span>
            <Select v-model="form.multiCart" :options="multiCartOptions"
              option-label="label" option-value="value"
              :disabled="form.checkoutType !== '多購物車-獨立結帳'"
              :placeholder="t('live_order.form.placeholder.multi_cart_name')" class="w-full" />
          </div>

          <!-- +1 數量限制 -->
          <div class="flex flex-col gap-2">
            <span class="text-[13px] text-[var(--p-text-color)]">
              {{ t('live_order.form.field.plus_one_limit') }}
            </span>
            <InputNumber v-model="form.plusLimit" :min="0" :show-buttons="false" class="w-full" inputClass="w-full" />
          </div>

          <!-- 星等過濾 -->
          <div class="flex flex-col gap-2">
            <span class="text-[13px] text-[var(--p-text-color)]">
              {{ t('live_order.form.field.star_filter') }}
            </span>
            <Select v-model="form.starFilter" :options="starOptions"
              option-label="label" option-value="value" class="w-full" />
          </div>
        </div>

        <!-- 開關選項：每列 label 左、switch 右，外框＋分隔線收齊 -->
        <div class="flex flex-col rounded-md border border-[var(--p-content-border-color)] divide-y divide-[var(--p-content-border-color)]">
          <div class="flex items-center justify-between gap-3 px-3 py-3">
            <span class="text-[13px] text-[var(--p-text-color)]">{{ t('live_order.form.field.bidding') }}</span>
            <ToggleSwitch v-model="form.bidding" />
          </div>
          <!-- 競價價格：競價模式正下方就地展開（一刀價格 + 起標價格） -->
          <div v-if="form.bidding" class="px-3 py-3 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
            <div class="flex flex-col gap-2">
              <span class="text-[13px] text-[var(--p-text-color)]">{{ t('live_order.form.field.flat_price') }}</span>
              <InputNumber v-model="form.flatPrice" :min="0" :show-buttons="false" class="w-full" inputClass="w-full" />
            </div>
            <div class="flex flex-col gap-2">
              <span class="text-[13px] text-[var(--p-text-color)]">{{ t('live_order.form.field.starting_bid') }}</span>
              <InputNumber v-model="form.startingBid" :min="0" :show-buttons="false" class="w-full" inputClass="w-full" />
            </div>
          </div>
          <div class="flex items-center justify-between gap-3 px-3 py-3">
            <span class="text-[13px] text-[var(--p-text-color)]">{{ t('live_order.form.field.allow_mix_color') }}</span>
            <ToggleSwitch v-model="form.allowMixColor" />
          </div>
          <div class="flex items-center justify-between gap-3 px-3 py-3">
            <span class="text-[13px] text-[var(--p-text-color)]">{{ t('live_order.form.field.allow_oversell') }}</span>
            <ToggleSwitch v-model="form.allowOversell" />
          </div>
          <div v-if="!isPreorder" class="flex items-center justify-between gap-3 px-3 py-3">
            <span class="text-[13px] text-[var(--p-text-color)]">{{ t('live_order.form.field.pick_spec_after_winning') }}</span>
            <ToggleSwitch v-model="form.pickSpecAfterWinning" />
          </div>
          <div class="flex items-center justify-between gap-3 px-3 py-3">
            <span class="text-[13px] text-[var(--p-text-color)]">{{ t('live_order.form.field.new_customer_any_star') }}</span>
            <ToggleSwitch v-model="form.newCustomerAnyStar" />
          </div>
          <div class="flex items-center justify-between gap-3 px-3 py-3">
            <span class="text-[13px] text-[var(--p-text-color)]">{{ t('live_order.form.field.member_only') }}</span>
            <ToggleSwitch v-model="form.memberOnly" />
          </div>
        </div>

        <!-- 提示 -->
        <div class="text-xs text-[var(--p-text-muted-color)]">
          {{ t('live_order.form.hint.batch_apply_hint') }}
        </div>
      </div>
    </div>

    <template #footer>
      <div class="flex justify-between items-center gap-2 w-full">
        <!-- 步驟 1：左側放刪除（destructive），右側放取消 / 下一步 -->
        <template v-if="currentStep === 1">
          <Button :label="t('live_order.button.bulk_delete')" severity="danger" outlined
            :disabled="selectedRows.length === 0"
            v-tooltip.top="selectedRows.length === 0 ? t('live_order.tooltip.no_row_selected') : ''"
            @click="onBulkDelete">
            <template #icon>
              <FontAwesomeIcon :icon="['far', 'trash']" />
            </template>
          </Button>
          <div class="flex gap-2">
            <Button :label="t('live_order.button.cancel')" severity="secondary" outlined @click="emit('update:visible', false)" />
            <Button :label="t('live_order.button.next_step')" icon="pi pi-arrow-right" icon-pos="right"
              :disabled="selectedRows.length === 0"
              v-tooltip.top="selectedRows.length === 0 ? t('live_order.tooltip.no_row_selected') : ''"
              @click="currentStep = 2" />
          </div>
        </template>
        <!-- 步驟 2 -->
        <template v-else>
          <span></span>
          <div class="flex gap-2">
            <Button :label="t('live_order.button.prev_step')" icon="pi pi-arrow-left" severity="secondary" outlined @click="currentStep = 1" />
            <Button :label="t('live_order.button.save')" :disabled="!canSave"
              v-tooltip.top="saveTooltip" @click="onSave" />
          </div>
        </template>
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, reactive, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'

interface LiveProduct {
  id: number
  name?: string
  [key: string]: unknown
}

interface BatchForm {
  checkoutType: string
  multiCart: string | null
  bidding: boolean
  flatPrice: number
  startingBid: number
  allowMixColor: boolean
  allowOversell: boolean
  pickSpecAfterWinning: boolean
  plusLimit: number
  starFilter: string
  newCustomerAnyStar: boolean
  memberOnly: boolean
}

interface BatchApplyPayload {
  productIds: number[]
  patch: Record<string, unknown>
}

interface Props {
  visible?: boolean
  products?: LiveProduct[]
}
const props = withDefaults(defineProps<Props>(), {
  visible: false,
  products: () => [],
})
const emit = defineEmits<{
  'update:visible': [value: boolean]
  apply: [payload: BatchApplyPayload]
  /** 批次刪除已勾選商品；payload 為被刪除商品的 id 清單。 */
  delete: [productIds: number[]]
}>()

const { t } = useI18n()

const innerVisible = ref(props.visible)
watch(() => props.visible, v => {
  innerVisible.value = v
  if (v) resetForm()
})

// 步驟：1 選擇商品 → 2 得標設定
const currentStep = ref<1 | 2>(1)
const steps = computed(() => [
  { step: 1, label: t('live_order.label.batch_step_select') },
  { step: 2, label: t('live_order.label.batch_step_setting') },
])

// 選項對齊 OrderSettingForm，確保批次與單筆得標設定產出同一份資料
const checkoutTypeOptions = computed(() => [
  { label: t('live_order.checkout_type.normal'),               value: '一般購物車' },
  { label: t('live_order.checkout_type.preorder_on_arrival'),  value: '預購-到貨再結帳' },
  { label: t('live_order.checkout_type.multi_cart_separate'),  value: '多購物車-獨立結帳' },
])
const multiCartOptions = computed(() => [
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

/** 得標設定欄位的預設值；同時作為「未變更」的比較基準。 */
function createDefaultForm(): BatchForm {
  return {
    checkoutType:         '一般購物車',
    multiCart:            null,
    bidding:              false,
    flatPrice:            0,
    startingBid:          0,
    allowMixColor:        false,
    allowOversell:        true,
    pickSpecAfterWinning: false,
    plusLimit:            0,
    starFilter:           'any',
    newCustomerAnyStar:   false,
    memberOnly:           false,
  }
}

const form = reactive<BatchForm>(createDefaultForm())

// 與 OrderSettingForm 一致的連動
const PREORDER_CHECKOUT = '預購-到貨再結帳'
const isPreorder = computed(() => form.checkoutType === PREORDER_CHECKOUT)
// 切到預購時把「得標後再選規格」歸 false（與其無關，避免列入 patch）
watch(isPreorder, (preorder) => {
  if (preorder) form.pickSpecAfterWinning = false
})
// 競價關閉時把一刀價格、起標價格歸 0（兩者僅競價模式有意義）
watch(() => form.bidding, (bidding) => {
  if (!bidding) {
    form.flatPrice = 0
    form.startingBid = 0
  }
})

/** 開窗當下的欄位快照，存檔時用來判斷哪些欄位被使用者改過。 */
let initialForm: BatchForm = createDefaultForm()

const selectedRows = ref<LiveProduct[]>([])

/** Restore the wizard step, form snapshot, and row selection to defaults. */
function resetForm(): void {
  currentStep.value = 1
  Object.assign(form, createDefaultForm())
  initialForm = createDefaultForm()
  selectedRows.value = []
}

/** 相對開窗快照被改動過的欄位 key（只有這些會套用）。 */
const dirtyKeys = computed(() =>
  (Object.keys(form) as Array<keyof BatchForm>).filter(k => form[k] !== initialForm[k]),
)
const canSave = computed(() => dirtyKeys.value.length > 0 && selectedRows.value.length > 0)
const saveTooltip = computed(() => {
  if (dirtyKeys.value.length === 0) return t('live_order.tooltip.no_field_changed')
  if (selectedRows.value.length === 0) return t('live_order.tooltip.no_row_selected')
  return ''
})

/** Emit the changed fields as a patch for the selected rows, then close the dialog. */
function onSave(): void {
  if (!canSave.value) return
  const patch: Record<string, unknown> = {}
  dirtyKeys.value.forEach(k => { patch[k] = form[k] })
  emit('apply', {
    productIds: selectedRows.value.map(r => r.id),
    patch,
  })
  emit('update:visible', false)
}

/** 批次刪除已勾選商品；emit ids 給父層，由父層真正從 session 移除，並關閉 dialog。 */
function onBulkDelete(): void {
  if (selectedRows.value.length === 0) return
  emit('delete', selectedRows.value.map(r => r.id))
  emit('update:visible', false)
}
</script>
