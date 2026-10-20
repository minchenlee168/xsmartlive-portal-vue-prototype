<script setup lang="ts">
/**
 * 結構化收件地址編輯欄位（國別 + 郵遞區號 + 城市/區 等）。
 * 與訂單明細彈窗的配送資訊地址格式一致，供合併訂單彈窗等處共用。
 * 透過 v-model 對外吐出合併後的完整地址字串。
 */
import { computed, ref, watch } from 'vue'

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

/** 國別僅開放：臺灣 / 新加坡 / 馬來西亞 / 菲律賓 */
const countryOptions = ['臺灣', '新加坡', '馬來西亞', '菲律賓']
/** 商家是否支援跨境配送(prototype：預設支援)。支援時國別旁顯示注記 */
const supportsCrossBorder = true
const cityOptions = ['臺北市', '新北市', '桃園市', '臺中市', '臺南市', '高雄市']
const districtMap: Record<string, string[]> = {
  臺北市: ['中正區', '大同區', '中山區', '松山區', '大安區', '萬華區', '信義區', '士林區', '北投區', '內湖區', '南港區', '文山區'],
  新北市: ['板橋區', '三重區', '中和區', '永和區', '新莊區', '新店區', '土城區', '蘆洲區'],
  桃園市: ['桃園區', '中壢區', '平鎮區', '八德區', '龜山區', '龍潭區'],
  臺中市: ['中區', '東區', '西區', '南區', '北區', '西屯區', '北屯區', '南屯區'],
  臺南市: ['中西區', '東區', '南區', '北區', '安平區', '安南區', '永康區'],
  高雄市: ['楠梓區', '左營區', '鼓山區', '三民區', '新興區', '前金區', '苓雅區', '前鎮區', '鳳山區'],
}
/** 菲律賓專用：大區 / 省 / 市 / 村里（Barangay） */
const phRegionOptions = ['Metro Manila', 'Calabarzon', 'Central Luzon', 'Central Visayas', 'Davao Region']
const phProvinceOptions = ['METRO-MANILA', 'CEBU', 'DAVAO', 'LAGUNA', 'CAVITE']
const phCityOptions = ['BINONDO', 'MAKATI', 'QUEZON CITY', 'MANILA', 'TAGUIG']
const phBarangayOptions = ['BARANGAY 287', 'BARANGAY 288', 'BARANGAY 289', 'BARANGAY 290']

const shippingCountry = ref<string>('臺灣')
const shippingPostalCode = ref<string>('')
const shippingCity = ref<string>('臺北市')
const shippingDistrict = ref<string | null>('中山區')
const shippingDetail = ref<string>('')
const shippingForeignCity = ref<string>('')
const shippingState = ref<string>('')
const phRegion = ref<string | null>('Metro Manila')
const phProvince = ref<string | null>('METRO-MANILA')
const phCity = ref<string | null>('BINONDO')
const phBarangay = ref<string | null>('BARANGAY 287')

const isTaiwan = computed(() => shippingCountry.value === '臺灣')
const isPhilippines = computed(() => shippingCountry.value === '菲律賓')
const isSingapore = computed(() => shippingCountry.value === '新加坡')
const districtOptions = computed<string[]>(() => districtMap[shippingCity.value] ?? [])

/** 各國郵遞區號位數(皆純數字)：臺灣/馬來西亞 5 碼、新加坡 6 碼、菲律賓 4 碼 */
const POSTAL_MAX: Record<string, number> = { 臺灣: 5, 馬來西亞: 5, 新加坡: 6, 菲律賓: 4 }
const postalMaxLength = computed<number>(() => POSTAL_MAX[shippingCountry.value] ?? 10)
const postalPlaceholder = computed<string>(() => (isTaiwan.value ? '請填寫郵遞區號' : `${postalMaxLength.value} 碼數字`))
/** 僅允許數字並限制位數 */
function sanitizePostal(): void {
  shippingPostalCode.value = shippingPostalCode.value.replace(/\D/g, '').slice(0, postalMaxLength.value)
}
/** 切換國別時，依新國別位數重新截斷郵遞區號 */
watch(shippingCountry, sanitizePostal)

/** 切換城市時清掉不屬於新城市的區域 */
watch(shippingCity, (city) => {
  if (shippingDistrict.value && !(districtMap[city] ?? []).includes(shippingDistrict.value)) {
    shippingDistrict.value = null
  }
})

/** 合併後完整地址：臺灣＝郵遞區號 城市區 詳細；菲律賓＝村里, 市, 省, 大區 郵遞, 國別；其他＝詳細, 城市, 州省 郵遞, 國別 */
const combined = computed<string>(() => {
  if (isTaiwan.value) {
    const tw = `${shippingCity.value}${shippingDistrict.value ?? ''}${shippingDetail.value}`
    return shippingPostalCode.value ? `${shippingPostalCode.value} ${tw}` : tw
  }
  if (isPhilippines.value) {
    return [
      phBarangay.value,
      phCity.value,
      phProvince.value,
      [phRegion.value, shippingPostalCode.value].filter(Boolean).join(' '),
      shippingCountry.value,
    ].filter(Boolean).join(', ')
  }
  return [
    shippingDetail.value,
    shippingForeignCity.value,
    [shippingState.value, shippingPostalCode.value].filter(Boolean).join(' '),
    shippingCountry.value,
  ].filter(Boolean).join(', ')
})
watch(combined, (v) => emit('update:modelValue', v), { immediate: true })
</script>

<template>
  <div class="flex flex-col gap-3">
    <!-- 國別 -->
    <div class="flex flex-col gap-1">
      <label class="text-xs text-[var(--p-text-muted-color)] flex items-center gap-1 flex-wrap">
        國別
        <!-- 注記：商家支援跨境配送時才顯示 -->
        <span v-if="supportsCrossBorder" class="inline-flex items-center gap-1 text-[var(--p-primary-color)]">
          <i class="pi pi-globe" style="font-size: 11px"></i>支援跨境配送
        </span>
      </label>
      <Select
        v-model="shippingCountry"
        :options="countryOptions"
        placeholder="請選擇國別"
        class="w-full sm:!w-[320px]"
        size="small"
      />
    </div>
    <!-- 郵遞區號：菲律賓非必填，其餘國家必填 -->
    <div class="flex flex-col gap-1">
      <label class="text-xs text-[var(--p-text-muted-color)]">
        郵遞區號 <span v-if="!isPhilippines && !isTaiwan" class="text-[var(--p-red-500)]">*</span>
      </label>
      <InputText
        v-model="shippingPostalCode"
        :placeholder="postalPlaceholder"
        :maxlength="postalMaxLength"
        inputmode="numeric"
        class="w-full sm:!w-[320px]"
        size="small"
        @input="sanitizePostal"
      />
    </div>
    <!-- 臺灣：城市 / 區 下拉 + 詳細收件地址 -->
    <template v-if="isTaiwan">
      <div class="flex flex-col gap-1">
        <label class="text-xs text-[var(--p-text-muted-color)]">
          城市 / 區 <span class="text-[var(--p-red-500)]">*</span>
        </label>
        <div class="flex gap-2 sm:!w-[320px]">
          <Select
            v-model="shippingCity"
            :options="cityOptions"
            placeholder="請選擇城市"
            class="w-full"
            size="small"
          />
          <Select
            v-model="shippingDistrict"
            :options="districtOptions"
            placeholder="請選擇區域"
            class="w-full"
            size="small"
            show-clear
          />
        </div>
      </div>
      <div class="flex flex-col gap-1">
        <label class="text-xs text-[var(--p-text-muted-color)]">
          詳細收件地址 <span class="text-[var(--p-red-500)]">*</span>
        </label>
        <InputText v-model="shippingDetail" placeholder="例：中山二路10號" class="w-full" size="small" />
      </div>
    </template>
    <!-- 其他國家 -->
    <template v-else>
      <!-- 菲律賓：大區 / 省 / 市 / 村里（Barangay）皆下拉、皆必填 -->
      <template v-if="isPhilippines">
        <div class="flex flex-col gap-1">
          <label class="text-xs text-[var(--p-text-muted-color)]">
            大區 <span class="text-[var(--p-red-500)]">*</span>
          </label>
          <Select v-model="phRegion" :options="phRegionOptions" placeholder="請選擇大區" class="w-full sm:!w-[320px]" size="small" show-clear />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-xs text-[var(--p-text-muted-color)]">
            省 <span class="text-[var(--p-red-500)]">*</span>
          </label>
          <Select v-model="phProvince" :options="phProvinceOptions" placeholder="請選擇省" class="w-full sm:!w-[320px]" size="small" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-xs text-[var(--p-text-muted-color)]">
            市 <span class="text-[var(--p-red-500)]">*</span>
          </label>
          <Select v-model="phCity" :options="phCityOptions" placeholder="請選擇市" class="w-full sm:!w-[320px]" size="small" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-xs text-[var(--p-text-muted-color)]">
            村里（Barangay） <span class="text-[var(--p-red-500)]">*</span>
          </label>
          <Select v-model="phBarangay" :options="phBarangayOptions" placeholder="請選擇村里" class="w-full sm:!w-[320px]" size="small" />
        </div>
      </template>
      <!-- 其他國家：城市 / 州省地區 / 詳細收件地址 皆自由輸入(新加坡只留詳細地址) -->
      <template v-else>
        <div v-if="!isSingapore" class="flex flex-col gap-1">
          <label class="text-xs text-[var(--p-text-muted-color)]">城市</label>
          <InputText v-model="shippingForeignCity" placeholder="城市" class="w-full sm:!w-[320px]" size="small" />
        </div>
        <div v-if="!isSingapore" class="flex flex-col gap-1">
          <label class="text-xs text-[var(--p-text-muted-color)]">州/省/地區</label>
          <InputText v-model="shippingState" placeholder="州/省/地區" class="w-full sm:!w-[320px]" size="small" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-xs text-[var(--p-text-muted-color)]">
            詳細收件地址 <span class="text-[var(--p-red-500)]">*</span>
          </label>
          <InputText v-model="shippingDetail" placeholder="詳細收件地址" class="w-full" size="small" />
        </div>
      </template>
    </template>
  </div>
</template>
