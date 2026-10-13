<script setup lang="ts">
import FreeTypeInfoDialog from './FreeTypeInfoDialog.vue'
import FormField from '@/admin/components/ui/FormField.vue'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { mockCheckoutSettingOptions, mockExcludedRegionOptions, mockProductOptions } from '../mockData'
import {
  FreeShippingFreeType,
  FreeShippingIncludeCoupon,
  FreeShippingTargetType,
  type FreeShippingRow,
} from '../types'

/**
 * 免運活動新增／編輯／檢視彈窗（prototype，mock 送出）。
 * 條件欄位依免運方式與免運來源顯示；驗證為手動（存檔時檢查）。
 */
const props = withDefaults(defineProps<{
  mode?: 'create' | 'edit' | 'view'
  row?: FreeShippingRow | null
}>(), { mode: 'create', row: null })

const emit = defineEmits<{ submit: [row: FreeShippingRow] }>()

const visible = defineModel<boolean>('visible', { default: false })

const { t } = useI18n()

const isView = computed(() => props.mode === 'view')
const isEdit = computed(() => props.mode === 'edit')
const dialogHeader = computed(() => isView.value
  ? t('free_shipping.form_dialog.header.view')
  : isEdit.value
    ? t('free_shipping.form_dialog.header.edit')
    : t('free_shipping.form_dialog.header.create'))

// 欄位狀態
const enabled = ref(true)
const name = ref('')
const freeType = ref<number>(FreeShippingFreeType.LimitedTime)
const targetType = ref<number>(FreeShippingTargetType.All)
const targetName = ref('')
const minAmount = ref<number | null>(null)
const minQuantity = ref<number | null>(null)
const maxUnlimited = ref(true)
const maxEligibleAmount = ref<number | null>(null)
const includeCouponAmount = ref<number>(FreeShippingIncludeCoupon.Excluded)
const usageUnlimited = ref(true)
const usageLimit = ref<number | null>(null)
const productName = ref('')
const excludedRegions = ref<string[]>([])
const period = ref<[Date, Date] | null>(null)
const description = ref('')
const remark = ref('')

const isInfoDialogVisible = ref(false)
const hasError = ref(false)

// 條件顯示
const isSingleItem = computed(() => freeType.value === FreeShippingFreeType.SingleItem)
const isMinAmount = computed(() => freeType.value === FreeShippingFreeType.MinAmount)
const isMinQuantity = computed(() => freeType.value === FreeShippingFreeType.MinQuantity)
const isCheckoutSetting = computed(() => targetType.value === FreeShippingTargetType.CheckoutSetting)

// 驗證（僅在嘗試存檔後顯示）
const nameInvalid = computed(() => hasError.value && !name.value.trim())
const periodInvalid = computed(() => hasError.value && !period.value)
const targetInvalid = computed(() => hasError.value && isCheckoutSetting.value && !targetName.value)
const minAmountInvalid = computed(() => hasError.value && isMinAmount.value && !minAmount.value)
const minQuantityInvalid = computed(() => hasError.value && isMinQuantity.value && !minQuantity.value)
const productInvalid = computed(() => hasError.value && isSingleItem.value && !productName.value)

const freeTypeOptions = computed(() =>
  Object.values(FreeShippingFreeType).map((value) => ({ value, label: t(`free_shipping.option.free_type.${freeTypeKey(value)}`) })))
const targetTypeOptions = computed(() => [
  { value: FreeShippingTargetType.All, label: t('free_shipping.option.target_type.all') },
  { value: FreeShippingTargetType.CheckoutSetting, label: t('free_shipping.option.target_type.checkout_setting') },
])
const includeCouponOptions = computed(() => [
  { value: FreeShippingIncludeCoupon.Included, label: t('free_shipping.option.include_coupon_amount.included') },
  { value: FreeShippingIncludeCoupon.Excluded, label: t('free_shipping.option.include_coupon_amount.excluded') },
])

const FREE_TYPE_KEY: Record<number, string> = {
  [FreeShippingFreeType.FirstPurchase]: 'first_purchase',
  [FreeShippingFreeType.SingleItem]: 'single_item',
  [FreeShippingFreeType.MinAmount]: 'min_amount',
  [FreeShippingFreeType.MinQuantity]: 'min_quantity',
  [FreeShippingFreeType.LimitedTime]: 'limited_time',
  [FreeShippingFreeType.PromoFirst]: 'promo_first',
}
function freeTypeKey(value: number): string {
  return FREE_TYPE_KEY[value] ?? 'limited_time'
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}
function formatDateTime(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}
function parseDateTime(value: string): Date | null {
  if (!value) {
    return null
  }
  const date = new Date(value.replace(' ', 'T'))
  return Number.isNaN(date.getTime()) ? null : date
}

function resetForm() {
  hasError.value = false
  const row = props.row
  if (row && (isEdit.value || isView.value)) {
    enabled.value = row.enabled
    name.value = row.name
    freeType.value = row.freeType
    targetType.value = row.targetType
    targetName.value = row.targetName
    minAmount.value = row.minAmount
    minQuantity.value = row.minQuantity
    maxUnlimited.value = row.maxEligibleAmount === null
    maxEligibleAmount.value = row.maxEligibleAmount
    includeCouponAmount.value = row.includeCouponAmount
    usageUnlimited.value = row.usageLimit === null
    usageLimit.value = row.usageLimit
    productName.value = row.productName
    excludedRegions.value = [...row.excludedRegions]
    const start = parseDateTime(row.startAt)
    const end = parseDateTime(row.endAt)
    period.value = start && end ? [start, end] : null
    description.value = row.description
    remark.value = row.remark
    return
  }
  enabled.value = true
  name.value = ''
  freeType.value = FreeShippingFreeType.LimitedTime
  targetType.value = FreeShippingTargetType.All
  targetName.value = ''
  minAmount.value = null
  minQuantity.value = null
  maxUnlimited.value = true
  maxEligibleAmount.value = null
  includeCouponAmount.value = FreeShippingIncludeCoupon.Excluded
  usageUnlimited.value = true
  usageLimit.value = null
  productName.value = ''
  excludedRegions.value = []
  period.value = null
  description.value = ''
  remark.value = ''
}

watch(visible, (isVisible) => {
  if (isVisible) {
    resetForm()
  }
})

// 切換免運來源／方式時清掉已不適用的值
watch(isCheckoutSetting, (value) => {
  if (!value) {
    targetName.value = ''
  }
})
watch(freeType, () => {
  productName.value = ''
})
watch(maxUnlimited, (value) => {
  if (value) {
    maxEligibleAmount.value = null
  }
})
watch(usageUnlimited, (value) => {
  if (value) {
    usageLimit.value = null
  }
})

function handleCancel() {
  visible.value = false
}

function handleSave() {
  const invalid = !name.value.trim()
    || !period.value
    || (isCheckoutSetting.value && !targetName.value)
    || (isMinAmount.value && !minAmount.value)
    || (isMinQuantity.value && !minQuantity.value)
    || (isSingleItem.value && !productName.value)
  if (invalid) {
    hasError.value = true
    return
  }

  const [start, end] = period.value ?? []
  const payload: FreeShippingRow = {
    id: props.row?.id ?? '',
    name: name.value.trim(),
    freeType: freeType.value as FreeShippingRow['freeType'],
    targetType: targetType.value as FreeShippingRow['targetType'],
    targetName: isCheckoutSetting.value ? targetName.value : '',
    minAmount: isMinAmount.value ? minAmount.value : null,
    minQuantity: isMinQuantity.value ? minQuantity.value : null,
    maxEligibleAmount: isSingleItem.value || maxUnlimited.value ? null : maxEligibleAmount.value,
    includeCouponAmount: includeCouponAmount.value as FreeShippingRow['includeCouponAmount'],
    usageLimit: usageUnlimited.value ? null : usageLimit.value,
    productName: isSingleItem.value ? productName.value : '',
    excludedRegions: [...excludedRegions.value],
    description: description.value.trim(),
    remark: remark.value.trim(),
    startAt: start ? formatDateTime(start) : '',
    endAt: end ? formatDateTime(end) : '',
    purchaseCount: props.row?.purchaseCount ?? 0,
    enabled: enabled.value,
  }
  emit('submit', payload)
  visible.value = false
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :draggable="false"
    :header="dialogHeader"
    :style="{ width: 'min(720px, calc(100vw - 32px))' }"
  >
    <div class="flex flex-col gap-5">
      <!-- 基本資訊 -->
      <h3 class="text-base font-bold text-color">
        {{ $t('free_shipping.form.section.basic') }}
      </h3>

      <FormField
        :label="$t('free_shipping.form.field.publish')"
        class-name="max-w-none"
      >
        <ToggleSwitch
          v-model="enabled"
          :disabled="isView"
        />
      </FormField>

      <FormField
        :label="$t('free_shipping.form.field.name')"
        :required="!isView"
        class-name="max-w-none"
      >
        <InputText
          v-model="name"
          fluid
          :maxlength="100"
          :placeholder="$t('free_shipping.form.placeholder.name')"
          :disabled="isView"
          :invalid="nameInvalid"
        />
        <Message
          v-if="nameInvalid"
          size="small"
          severity="error"
          variant="simple"
        >{{ $t('free_shipping.form.validation.name') }}</Message>
      </FormField>

      <!-- 免運方式：label 旁 info 圖示開說明彈窗 -->
      <div class="flex max-w-none flex-col gap-2">
        <div class="flex items-center gap-2">
          <label class="text-sm font-medium text-color">
            {{ $t('free_shipping.form.field.free_type') }}
            <span
              v-if="!isView"
              class="text-red-500"
            >*</span>
          </label>
          <button
            type="button"
            class="inline-flex items-center gap-2 text-sm text-primary-500 transition-colors hover:underline dark:text-primary-400"
            @click="isInfoDialogVisible = true"
          >
            <FontAwesomeIcon :icon="['far', 'circle-info']" />
            {{ $t('free_shipping.free_type_info.title') }}
          </button>
        </div>
        <Select
          v-model="freeType"
          :options="freeTypeOptions"
          option-label="label"
          option-value="value"
          fluid
          :placeholder="$t('free_shipping.form.placeholder.free_type')"
          :disabled="isView"
        />
      </div>

      <FormField
        :label="$t('free_shipping.form.field.target_type')"
        :hint="$t('free_shipping.form.description.target_type')"
        class-name="max-w-none"
      >
        <Select
          v-model="targetType"
          :options="targetTypeOptions"
          option-label="label"
          option-value="value"
          fluid
          :placeholder="$t('free_shipping.form.placeholder.target_type')"
          :disabled="isView"
        />
      </FormField>

      <FormField
        v-if="isCheckoutSetting"
        :label="$t('free_shipping.form.field.target')"
        :required="!isView"
        class-name="max-w-none"
      >
        <Select
          v-model="targetName"
          :options="mockCheckoutSettingOptions"
          fluid
          :placeholder="$t('free_shipping.form.placeholder.checkout_setting')"
          :disabled="isView"
          :invalid="targetInvalid"
        />
        <Message
          v-if="targetInvalid"
          size="small"
          severity="error"
          variant="simple"
        >{{ $t('free_shipping.form.validation.target_id') }}</Message>
      </FormField>

      <!-- 免運條件 -->
      <h3 class="text-base font-bold text-color">
        {{ $t('free_shipping.form.section.threshold') }}
      </h3>

      <FormField
        v-if="isMinAmount"
        :label="$t('free_shipping.form.field.min_amount')"
        :required="!isView"
        class-name="max-w-none"
      >
        <InputNumber
          v-model="minAmount"
          fluid
          :min="1"
          :max="99999999"
          prefix="$ "
          :placeholder="$t('free_shipping.form.placeholder.min_amount')"
          :disabled="isView"
          :invalid="minAmountInvalid"
        />
        <Message
          v-if="minAmountInvalid"
          size="small"
          severity="error"
          variant="simple"
        >{{ $t('free_shipping.form.validation.min_amount') }}</Message>
      </FormField>

      <FormField
        v-if="isMinQuantity"
        :label="$t('free_shipping.form.field.min_quantity')"
        :required="!isView"
        class-name="max-w-none"
      >
        <InputNumber
          v-model="minQuantity"
          fluid
          :min="1"
          :max="99999"
          :placeholder="$t('free_shipping.form.placeholder.min_quantity')"
          :disabled="isView"
          :invalid="minQuantityInvalid"
        />
        <Message
          v-if="minQuantityInvalid"
          size="small"
          severity="error"
          variant="simple"
        >{{ $t('free_shipping.form.validation.min_quantity') }}</Message>
      </FormField>

      <template v-if="!isSingleItem">
        <FormField
          :label="$t('free_shipping.form.field.max_eligible_amount')"
          class-name="max-w-none"
        >
          <div class="flex flex-col gap-2">
            <div class="flex items-center gap-2">
              <Checkbox
                v-model="maxUnlimited"
                input-id="maxUnlimited"
                binary
                :disabled="isView"
              />
              <label
                for="maxUnlimited"
                class="text-sm text-color"
              >{{ $t('free_shipping.form.field.max_eligible_amount_unlimited') }}</label>
            </div>
            <InputNumber
              v-if="!maxUnlimited"
              v-model="maxEligibleAmount"
              fluid
              :min="1"
              :max="99999999"
              prefix="$ "
              :placeholder="$t('free_shipping.form.placeholder.max_eligible_amount')"
              :disabled="isView"
            />
          </div>
        </FormField>

        <FormField
          :label="$t('free_shipping.form.field.include_coupon_amount')"
          class-name="max-w-none"
        >
          <Select
            v-model="includeCouponAmount"
            :options="includeCouponOptions"
            option-label="label"
            option-value="value"
            fluid
            :disabled="isView"
          />
        </FormField>
      </template>

      <FormField
        :label="$t('free_shipping.form.field.usage_limit')"
        class-name="max-w-none"
      >
        <div class="flex flex-col gap-2">
          <div class="flex items-center gap-2">
            <Checkbox
              v-model="usageUnlimited"
              input-id="usageUnlimited"
              binary
              :disabled="isView"
            />
            <label
              for="usageUnlimited"
              class="text-sm text-color"
            >{{ $t('free_shipping.form.field.usage_limit_unlimited') }}</label>
          </div>
          <InputNumber
            v-if="!usageUnlimited"
            v-model="usageLimit"
            fluid
            :min="1"
            :max="99999999"
            :placeholder="$t('free_shipping.form.placeholder.usage_limit')"
            :disabled="isView"
          />
        </div>
      </FormField>

      <!-- 適用範圍 -->
      <h3 class="text-base font-bold text-color">
        {{ $t('free_shipping.form.section.scope') }}
      </h3>

      <FormField
        :label="$t('free_shipping.form.field.product')"
        :hint="isSingleItem ? $t('free_shipping.form.description.product_required') : $t('free_shipping.form.description.product_single_item_only')"
        :required="isSingleItem && !isView"
        class-name="max-w-none"
      >
        <Select
          v-model="productName"
          :options="mockProductOptions"
          fluid
          show-clear
          :placeholder="$t('free_shipping.form.placeholder.product')"
          :disabled="isView || !isSingleItem"
          :invalid="productInvalid"
        />
        <Message
          v-if="productInvalid"
          size="small"
          severity="error"
          variant="simple"
        >{{ $t('free_shipping.form.validation.product') }}</Message>
      </FormField>

      <FormField
        :label="$t('free_shipping.form.field.excluded_regions')"
        :hint="$t('free_shipping.form.description.excluded_regions')"
        class-name="max-w-none"
      >
        <MultiSelect
          v-model="excludedRegions"
          :options="mockExcludedRegionOptions"
          display="chip"
          fluid
          :placeholder="$t('free_shipping.form.placeholder.excluded_regions')"
          :disabled="isView"
        />
      </FormField>

      <!-- 活動時間 -->
      <h3 class="text-base font-bold text-color">
        {{ $t('free_shipping.form.section.period') }}
      </h3>

      <FormField
        :label="$t('free_shipping.form.field.active_period')"
        :required="!isView"
        class-name="max-w-none"
      >
        <DatePicker
          v-model="period"
          selection-mode="range"
          show-time
          hour-format="24"
          date-format="yy-mm-dd"
          show-icon
          icon-display="input"
          :manual-input="false"
          fluid
          :disabled="isView"
          :invalid="periodInvalid"
        />
        <Message
          v-if="periodInvalid"
          size="small"
          severity="error"
          variant="simple"
        >{{ $t('free_shipping.form.validation.period') }}</Message>
      </FormField>

      <FormField
        :label="$t('free_shipping.form.field.description')"
        :hint="$t('free_shipping.form.description.description')"
        class-name="max-w-none"
      >
        <Textarea
          v-model="description"
          auto-resize
          rows="3"
          fluid
          :maxlength="2000"
          :placeholder="$t('free_shipping.form.placeholder.description')"
          :disabled="isView"
        />
      </FormField>

      <FormField
        :label="$t('free_shipping.form.field.remark')"
        :hint="$t('free_shipping.form.description.remark')"
        class-name="max-w-none"
      >
        <Textarea
          v-model="remark"
          auto-resize
          rows="3"
          fluid
          :maxlength="255"
          :placeholder="$t('free_shipping.form.placeholder.remark')"
          :disabled="isView"
        />
      </FormField>
    </div>

    <template #footer>
      <div class="flex items-center justify-end gap-2">
        <Button
          v-if="isView"
          type="button"
          severity="secondary"
          outlined
          :label="$t('free_shipping.form_dialog.button.close')"
          @click="handleCancel"
        />
        <template v-else>
          <Button
            type="button"
            severity="secondary"
            outlined
            :label="$t('free_shipping.form_dialog.button.cancel')"
            @click="handleCancel"
          />
          <Button
            type="button"
            :label="$t('free_shipping.form_dialog.button.save')"
            @click="handleSave"
          />
        </template>
      </div>
    </template>

    <FreeTypeInfoDialog v-model:visible="isInfoDialogVisible" />
  </Dialog>
</template>
