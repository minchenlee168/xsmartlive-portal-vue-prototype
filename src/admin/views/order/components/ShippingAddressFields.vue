<script setup lang="ts">
/**
 * 結構化收件地址編輯欄位的「分流器」：國別 + 郵遞區號（共用第一欄）+ 各國地址欄位。
 * 對齊正式專案 OrderRecipientFields 的職責——依國別把地址欄分流到各自元件：
 *   臺灣 → TwAddressField、菲律賓 → PhilippineAddressFields、新加坡 / 馬來西亞 → 就地欄位。
 * 透過 v-model 吐出各國標準書寫順序組合後的完整地址字串；另以 update:country 對外暴露國別。
 *
 * 供「訂單明細 › 配送資訊」與「合併編輯彈窗」共用。本元件為 write-only：自持狀態並向上 emit。
 */
import TwAddressField from '@/admin/components/address/TwAddressField.vue'
import PhilippineAddressFields from '@/admin/components/address/philippine-address/PhilippineAddressFields.vue'
import { MALAYSIA_STATE_OPTIONS } from '@/admin/components/address/malaysiaStates'
import BaseFormField from '@/admin/components/ui/BaseFormField.vue'
import { computed, ref, watch } from 'vue'

const emit = defineEmits<{ 'update:modelValue': [value: string]; 'update:country': [value: string] }>()

/** 國別僅開放：臺灣 / 新加坡 / 馬來西亞 / 菲律賓 */
const countryOptions = ['臺灣', '新加坡', '馬來西亞', '菲律賓']
/** 商家是否支援跨境配送（prototype：預設支援）。支援時國別旁顯示注記 */
const supportsCrossBorder = true

// ── state ──────────────────────────────────────────────
const shippingCountry = ref<string>('臺灣')
const shippingPostalCode = ref<string>('')
// 臺灣（城市 / 區 / 詳細收於 TwAddressField，對外為單一地址字串）
const twAddress = ref<string>('臺北市中山區')
// 新加坡 / 馬來西亞 共用詳細地址
const foreignDetail = ref<string>('')
// 馬來西亞
const malaysiaCity = ref<string>('')
const malaysiaState = ref<string | null>(null)
// 菲律賓四層（預設帶入一條完整階層）
const phRegion = ref<string | null>('Metro Manila')
const phProvince = ref<string | null>('METRO-MANILA')
const phCity = ref<string | null>('BINONDO')
const phBarangay = ref<string | null>('BARANGAY 287')
const phDetail = ref<string>('')

const isTaiwan = computed(() => shippingCountry.value === '臺灣')
const isPhilippines = computed(() => shippingCountry.value === '菲律賓')
const isSingapore = computed(() => shippingCountry.value === '新加坡')
const isMalaysia = computed(() => shippingCountry.value === '馬來西亞')

// ── 郵遞區號碼數：臺灣 3 或 6、新加坡 6、馬來西亞 5、菲律賓 4 ──
const POSTAL_MAX: Record<string, number> = { 臺灣: 6, 馬來西亞: 5, 新加坡: 6, 菲律賓: 4 }
const postalMaxLength = computed<number>(() => POSTAL_MAX[shippingCountry.value] ?? 10)
const postalPlaceholder = computed<string>(() => (isTaiwan.value ? '3 碼或 6 碼' : `${postalMaxLength.value} 碼數字`))
/** 僅允許數字並限制位數 */
function sanitizePostal(): void {
  shippingPostalCode.value = shippingPostalCode.value.replace(/\D/g, '').slice(0, postalMaxLength.value)
}

// ── 切換國別：郵遞區號清空（臺灣由 TwAddressField 依區自動帶回 3 碼） ──
watch(shippingCountry, () => {
  shippingPostalCode.value = ''
})

/**
 * 合併後完整地址（依各國標準書寫順序）：
 * - 臺灣：郵遞 地址（縣市區＋詳細）
 * - 新加坡：詳細 國別 郵遞
 * - 馬來西亞：詳細 郵遞 城市 州 國別
 * - 菲律賓：詳細 村里 市 省 大區 郵遞 國別
 */
const combined = computed<string>(() => {
  if (isTaiwan.value) {
    return [shippingPostalCode.value, twAddress.value].filter(Boolean).join(' ')
  }
  if (isSingapore.value) {
    return [foreignDetail.value, shippingCountry.value, shippingPostalCode.value].filter(Boolean).join(' ')
  }
  if (isMalaysia.value) {
    return [foreignDetail.value, shippingPostalCode.value, malaysiaCity.value, malaysiaState.value, shippingCountry.value].filter(Boolean).join(' ')
  }
  // 菲律賓
  return [phDetail.value, phBarangay.value, phCity.value, phProvince.value, phRegion.value, shippingPostalCode.value, shippingCountry.value].filter(Boolean).join(' ')
})
watch(combined, (v) => emit('update:modelValue', v), { immediate: true })
/** 對外暴露目前選的國別（供收件人電話國碼自動帶入） */
watch(shippingCountry, (c) => emit('update:country', c), { immediate: true })
</script>

<template>
  <div class="flex flex-col gap-4 max-w-[320px]">
    <!-- 國別（跨境注記走 hint） -->
    <BaseFormField
      label="國別"
      required
      :hint="supportsCrossBorder ? '支援跨境配送' : ''"
      class-name="max-w-none"
    >
      <Select v-model="shippingCountry" :options="countryOptions" placeholder="請選擇國別" class="w-full" size="small" />
    </BaseFormField>

    <!-- 郵遞區號：國別下第一欄；菲律賓非必填，其餘國家必填 -->
    <BaseFormField label="郵遞區號" :required="!isPhilippines" class-name="max-w-none">
      <InputText
        v-model="shippingPostalCode"
        :placeholder="postalPlaceholder"
        :maxlength="postalMaxLength"
        inputmode="numeric"
        class="w-full"
        size="small"
        @input="sanitizePostal"
      />
    </BaseFormField>

    <!-- 臺灣：城市 / 區（連動）+ 詳細收件地址 -->
    <TwAddressField v-if="isTaiwan" v-model="twAddress" v-model:post="shippingPostalCode" />

    <!-- 菲律賓：大區 → 省 → 市 → 村里（四層連動）+ 詳細收件地址 -->
    <PhilippineAddressFields
      v-else-if="isPhilippines"
      v-model:region="phRegion"
      v-model:province="phProvince"
      v-model:city="phCity"
      v-model:barangay="phBarangay"
      v-model:detail="phDetail"
    />

    <!-- 新加坡：只有詳細收件地址 -->
    <template v-else-if="isSingapore">
      <BaseFormField label="詳細收件地址" required class-name="max-w-none">
        <InputText v-model="foreignDetail" placeholder="無城市、無州省，直接填詳細地址" class="w-full" size="small" />
      </BaseFormField>
    </template>

    <!-- 馬來西亞：城市（自由輸入）+ 州/省/地區（下拉）+ 詳細收件地址 -->
    <template v-else>
      <BaseFormField label="城市" required class-name="max-w-none">
        <InputText v-model="malaysiaCity" placeholder="城市" class="w-full" size="small" />
      </BaseFormField>
      <BaseFormField label="州/省/地區" required class-name="max-w-none">
        <Select v-model="malaysiaState" :options="MALAYSIA_STATE_OPTIONS" placeholder="請選擇州/省/地區" class="w-full" size="small" show-clear />
      </BaseFormField>
      <BaseFormField label="詳細收件地址" required class-name="max-w-none">
        <InputText v-model="foreignDetail" placeholder="詳細收件地址" class="w-full" size="small" />
      </BaseFormField>
    </template>
  </div>
</template>
