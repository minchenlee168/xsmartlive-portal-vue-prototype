<script setup lang="ts">
/**
 * 菲律賓收件地址欄位——大區 → 省 → 市 → 村里 四層連動下拉 ＋ 詳細地址。
 * 對齊正式專案 libs/philippine-address：連動邏輯收於 usePhilippineAddressCascade，
 * 四層選值與詳細地址以 v-model 對外，由呼叫端（分流器）組合成完整地址字串。
 */
import { usePhilippineAddressCascade } from './usePhilippineAddressCascade'
import BaseFormField from '@/admin/components/ui/BaseFormField.vue'

withDefaults(
  defineProps<{
    disabled?: boolean
    invalid?: boolean
    size?: 'small' | 'large'
  }>(),
  { disabled: false, invalid: false, size: 'small' },
)

const region = defineModel<string | null>('region', { default: null })
const province = defineModel<string | null>('province', { default: null })
const city = defineModel<string | null>('city', { default: null })
const barangay = defineModel<string | null>('barangay', { default: null })
const detail = defineModel<string>('detail', { default: '' })

const { regionOptions, provinceOptions, cityOptions, barangayOptions, selectRegion, selectProvince, selectCity } =
  usePhilippineAddressCascade({ region, province, city, barangay })
</script>

<template>
  <div class="flex flex-col gap-4">
    <BaseFormField label="大區（Region）" required class-name="max-w-none">
      <Select
        :model-value="region"
        :options="regionOptions"
        placeholder="請選擇大區"
        :disabled="disabled"
        :invalid="invalid"
        :size="size"
        class="w-full"
        @update:model-value="selectRegion"
      />
    </BaseFormField>
    <BaseFormField label="省（Province）" required class-name="max-w-none">
      <Select
        :model-value="province"
        :options="provinceOptions"
        placeholder="請選擇省"
        :disabled="disabled || !region"
        :invalid="invalid"
        :size="size"
        class="w-full"
        @update:model-value="selectProvince"
      />
    </BaseFormField>
    <BaseFormField label="市（City）" required class-name="max-w-none">
      <Select
        :model-value="city"
        :options="cityOptions"
        placeholder="請選擇市"
        :disabled="disabled || !province"
        :invalid="invalid"
        :size="size"
        class="w-full"
        @update:model-value="selectCity"
      />
    </BaseFormField>
    <BaseFormField label="村里（Barangay）" required class-name="max-w-none">
      <Select
        v-model="barangay"
        :options="barangayOptions"
        placeholder="請選擇村里"
        :disabled="disabled || !city"
        :invalid="invalid"
        :size="size"
        class="w-full"
      />
    </BaseFormField>
    <BaseFormField label="詳細收件地址" required class-name="max-w-none">
      <InputText
        v-model="detail"
        placeholder="詳細收件地址"
        :disabled="disabled"
        :invalid="invalid"
        :size="size"
        class="w-full"
      />
    </BaseFormField>
  </div>
</template>
