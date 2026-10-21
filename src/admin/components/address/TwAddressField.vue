<script setup lang="ts">
/**
 * 台灣地址欄位——縣市 / 鄉鎮市區兩層下拉 ＋ 詳細地址，對外仍是單一地址字串。
 * 對齊正式專案 libs/ui/TwAddressField：內部拆三段、對外合併；`v-model` 綁完整地址、
 * `v-model:post` 綁選到的 3 碼郵遞區號（改縣市 / 區時自動帶出，呼叫端不需自行查表）。
 *
 * 既有資料以 `parseTwAddress` 拆回下拉，辨識不出的部分保留在詳細地址、不清空。
 */
import {
  findTwZip,
  findTwZipByAddress,
  joinTwAddress,
  parseTwAddress,
  TW_CITY_AREA_ZIP,
} from '@/admin/constants/twAddress'
import BaseFormField from '@/admin/components/ui/BaseFormField.vue'
import { DEFAULT_TW_ADDRESS_FIELD_TEXTS, type TwAddressFieldTexts } from './twAddressFieldTexts'
import { computed, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    /** 三段控制項的文案；未給用預設。 */
    texts?: TwAddressFieldTexts
    /** 是否停用（送出中 / 唯讀情境）。 */
    disabled?: boolean
    /** 是否顯示為驗證失敗樣式。 */
    invalid?: boolean
    /** 控制項尺寸。 */
    size?: 'small' | 'large'
  }>(),
  {
    texts: () => DEFAULT_TW_ADDRESS_FIELD_TEXTS,
    disabled: false,
    invalid: false,
    size: 'small',
  },
)

/** 完整地址字串（縣市＋區＋詳細）。 */
const model = defineModel<string>({ required: true })
/** 選到的區對應的 3 碼郵遞區號；呼叫端據此預帶郵遞區號欄（可續補成 6 碼）。 */
const post = defineModel<string>('post', { default: '' })

const city = ref('')
const district = ref('')
const detail = ref('')

const cityOptions = computed(() => TW_CITY_AREA_ZIP.map((item) => item.name))
const districtOptions = computed(
  () => TW_CITY_AREA_ZIP.find((item) => item.name === city.value)?.districts.map((item) => item.name) ?? [],
)

/**
 * 外部值 → 三段。僅在外部值與目前三段組回的結果不同時才重新拆解，避免本元件自己 emit 的更新
 * 又回灌一次。解析得出縣市與區、且郵遞區號尚為空時補上 3 碼（既有資料多半只存地址字串）；
 * 郵遞區號已有值（可能是外部帶入的 6 碼）時不覆寫。
 */
watch(
  model,
  (value) => {
    if (value === joinTwAddress({ city: city.value, district: district.value, detail: detail.value })) {
      return
    }
    const parts = parseTwAddress(value ?? '')
    city.value = parts.city
    district.value = parts.district
    detail.value = parts.detail

    if (!post.value) {
      const zip = findTwZipByAddress(value ?? '')
      if (zip !== null) post.value = zip
    }
  },
  { immediate: true },
)

/** 三段 → 外部地址字串。 */
function emitAddress(): void {
  model.value = joinTwAddress({ city: city.value, district: district.value, detail: detail.value })
}

/** 換縣市：一併清掉已選的區與郵遞區號——舊的區不屬於新縣市。 */
function handleCityChange(value: string | null): void {
  city.value = value ?? ''
  district.value = ''
  post.value = ''
  emitAddress()
}

/** 換鄉鎮市區：帶出該區 3 碼郵遞區號（呼叫端可續補成 6 碼）。 */
function handleDistrictChange(value: string | null): void {
  district.value = value ?? ''
  post.value = findTwZip(city.value, district.value) ?? ''
  emitAddress()
}

/** 改詳細地址：只更新地址字串，不動郵遞區號。 */
function handleDetailChange(value: string | undefined): void {
  detail.value = value ?? ''
  emitAddress()
}
</script>

<template>
  <div class="flex flex-col gap-4" role="group">
    <BaseFormField label="城市 / 區" required class-name="max-w-none">
      <div class="flex gap-2">
        <Select
          :model-value="city"
          :options="cityOptions"
          :placeholder="texts.cityPlaceholder"
          :disabled="disabled"
          :invalid="invalid"
          :size="size"
          class="w-full"
          @update:model-value="handleCityChange"
        />
        <Select
          :model-value="district"
          :options="districtOptions"
          :placeholder="texts.districtPlaceholder"
          :disabled="disabled || !city"
          :invalid="invalid"
          :size="size"
          class="w-full"
          show-clear
          @update:model-value="handleDistrictChange"
        />
      </div>
    </BaseFormField>
    <BaseFormField label="詳細收件地址" required class-name="max-w-none">
      <InputText
        :model-value="detail"
        :placeholder="texts.detailPlaceholder"
        :disabled="disabled"
        :invalid="invalid"
        :size="size"
        class="w-full"
        @update:model-value="handleDetailChange"
      />
    </BaseFormField>
  </div>
</template>
