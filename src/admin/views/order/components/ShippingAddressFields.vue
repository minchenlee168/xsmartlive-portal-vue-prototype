<script setup lang="ts">
/**
 * 結構化收件地址編輯欄位（國別 + 郵遞區號 + 各國地址欄位）。
 * 依各國標準地址規格：欄位組成、必填、連動自動帶入、儲存組合格式皆依國別切換。
 * 供「訂單明細 › 配送資訊」與「合併編輯彈窗」共用；透過 v-model 吐出合併後完整地址字串。
 */
import { computed, ref, watch } from 'vue'

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

/** 國別僅開放：臺灣 / 新加坡 / 馬來西亞 / 菲律賓 */
const countryOptions = ['臺灣', '新加坡', '馬來西亞', '菲律賓']
/** 商家是否支援跨境配送(prototype：預設支援)。支援時國別旁顯示注記 */
const supportsCrossBorder = true

// ── 臺灣：城市 / 區（連動）＋ 區對應 3 碼郵遞前綴 ──────────────
const cityOptions = ['臺北市', '新北市', '桃園市', '臺中市', '臺南市', '高雄市']
/** 區 → 郵遞區號 3 碼前綴（prototype：涵蓋現有城市清單的主要行政區） */
const districtPostalMap: Record<string, Record<string, string>> = {
  臺北市: { 中正區: '100', 大同區: '103', 中山區: '104', 松山區: '105', 大安區: '106', 萬華區: '108', 信義區: '110', 士林區: '111', 北投區: '112', 內湖區: '114', 南港區: '115', 文山區: '116' },
  新北市: { 板橋區: '220', 三重區: '241', 中和區: '235', 永和區: '234', 新莊區: '242', 新店區: '231', 土城區: '236', 蘆洲區: '247' },
  桃園市: { 桃園區: '330', 中壢區: '320', 平鎮區: '324', 八德區: '334', 龜山區: '333', 龍潭區: '325' },
  臺中市: { 中區: '400', 東區: '401', 西區: '403', 南區: '402', 北區: '404', 西屯區: '407', 北屯區: '406', 南屯區: '408' },
  臺南市: { 中西區: '700', 東區: '701', 南區: '702', 北區: '704', 安平區: '708', 安南區: '709', 永康區: '710' },
  高雄市: { 楠梓區: '811', 左營區: '813', 鼓山區: '804', 三民區: '807', 新興區: '800', 前金區: '801', 苓雅區: '802', 前鎮區: '806', 鳳山區: '830' },
}

// ── 馬來西亞：州 / 省 / 地區（16 州 + 聯邦直轄區） ──────────────
const malaysiaStateOptions = ['Johor', 'Kedah', 'Kelantan', 'Melaka', 'Negeri Sembilan', 'Pahang', 'Perak', 'Perlis', 'Pulau Pinang', 'Sabah', 'Sarawak', 'Selangor', 'Terengganu', 'Kuala Lumpur', 'Labuan', 'Putrajaya']

// ── 菲律賓：大區 → 省 → 市 → 村里 四層階層資料（prototype 示意） ──
const phData: Record<string, Record<string, Record<string, string[]>>> = {
  'Metro Manila': {
    'METRO-MANILA': {
      BINONDO: ['BARANGAY 287', 'BARANGAY 288', 'BARANGAY 289'],
      MAKATI: ['Poblacion', 'Bel-Air', 'San Lorenzo'],
      'QUEZON CITY': ['Diliman', 'Cubao', 'Novaliches'],
      MANILA: ['Malate', 'Ermita', 'Tondo'],
    },
  },
  Calabarzon: {
    CAVITE: { Bacoor: ['Molino', 'Zapote'], Imus: ['Anabu', 'Bucandala'] },
    LAGUNA: { Calamba: ['Parian', 'Real'], 'Santa Rosa': ['Balibago', 'Malitlit'] },
  },
  'Central Luzon': {
    PAMPANGA: { 'Angeles City': ['Balibago', 'Pampang'], 'San Fernando': ['Dolores', 'Sindalan'] },
  },
  'Central Visayas': {
    CEBU: { 'Cebu City': ['Lahug', 'Mabolo'], 'Mandaue City': ['Centro', 'Guizo'] },
  },
  'Davao Region': {
    'DAVAO DEL SUR': { 'Davao City': ['Poblacion', 'Buhangin'] },
  },
}
const phRegionOptions = Object.keys(phData)

// ── state ──────────────────────────────────────────────
const shippingCountry = ref<string>('臺灣')
const shippingPostalCode = ref<string>('')
const shippingDetail = ref<string>('')
// 臺灣
const shippingCity = ref<string | null>('臺北市')
const shippingDistrict = ref<string | null>('中山區')
// 馬來西亞
const shippingForeignCity = ref<string>('')
const shippingState = ref<string | null>(null)
// 菲律賓（預設帶入一條完整階層）
const phRegion = ref<string | null>('Metro Manila')
const phProvince = ref<string | null>('METRO-MANILA')
const phCity = ref<string | null>('BINONDO')
const phBarangay = ref<string | null>('BARANGAY 287')

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

// ── 臺灣連動：城市/區/郵遞 ──────────────────────────────
const districtOptions = computed<string[]>(() => Object.keys(districtPostalMap[shippingCity.value ?? ''] ?? {}))
/** 選城市 → 區下拉重設；郵遞清空 */
watch(shippingCity, () => {
  shippingDistrict.value = null
  shippingPostalCode.value = ''
})
/** 選區 → 郵遞區號自動帶入該區 3 碼前綴（使用者可續補成 6 碼） */
watch(shippingDistrict, (district) => {
  if (!isTaiwan.value || !district) return
  const prefix = districtPostalMap[shippingCity.value ?? '']?.[district]
  if (prefix) shippingPostalCode.value = prefix
})

// ── 菲律賓連動：大區 → 省 → 市 → 村里（上層變動清空下層） ──
const phProvinceOptions = computed<string[]>(() => Object.keys(phData[phRegion.value ?? ''] ?? {}))
const phCityOptions = computed<string[]>(() => Object.keys(phData[phRegion.value ?? '']?.[phProvince.value ?? ''] ?? {}))
const phBarangayOptions = computed<string[]>(() => phData[phRegion.value ?? '']?.[phProvince.value ?? '']?.[phCity.value ?? ''] ?? [])
watch(phRegion, () => { phProvince.value = null; phCity.value = null; phBarangay.value = null })
watch(phProvince, () => { phCity.value = null; phBarangay.value = null })
watch(phCity, () => { phBarangay.value = null })

// ── 切換國別：郵遞區號清空，臺灣帶入預設區碼 ──────────────
watch(shippingCountry, () => {
  shippingPostalCode.value = ''
  if (isTaiwan.value) {
    const prefix = districtPostalMap[shippingCity.value ?? '']?.[shippingDistrict.value ?? '']
    if (prefix) shippingPostalCode.value = prefix
  }
})

/**
 * 合併後完整地址（依各國標準書寫順序）：
 * - 臺灣：郵遞 縣市區 詳細
 * - 新加坡：詳細 國別 郵遞
 * - 馬來西亞：詳細 郵遞 城市 州 國別
 * - 菲律賓：詳細 村里 市 省 大區 郵遞 國別
 */
const combined = computed<string>(() => {
  if (isTaiwan.value) {
    return [shippingPostalCode.value, `${shippingCity.value ?? ''}${shippingDistrict.value ?? ''}`, shippingDetail.value].filter(Boolean).join(' ')
  }
  if (isSingapore.value) {
    return [shippingDetail.value, shippingCountry.value, shippingPostalCode.value].filter(Boolean).join(' ')
  }
  if (isMalaysia.value) {
    return [shippingDetail.value, shippingPostalCode.value, shippingForeignCity.value, shippingState.value, shippingCountry.value].filter(Boolean).join(' ')
  }
  // 菲律賓
  return [shippingDetail.value, phBarangay.value, phCity.value, phProvince.value, phRegion.value, shippingPostalCode.value, shippingCountry.value].filter(Boolean).join(' ')
})
watch(combined, (v) => emit('update:modelValue', v), { immediate: true })
</script>

<template>
  <div class="flex flex-col gap-3">
    <!-- 國別 -->
    <div class="flex flex-col gap-1">
      <label class="text-xs text-[var(--p-text-muted-color)] flex items-center gap-1 flex-wrap">
        國別
        <span v-if="supportsCrossBorder" class="inline-flex items-center gap-1 text-[var(--p-primary-color)]">
          <i class="pi pi-globe" style="font-size: 11px"></i>支援跨境配送
        </span>
      </label>
      <Select v-model="shippingCountry" :options="countryOptions" placeholder="請選擇國別" class="w-full sm:!w-[320px]" size="small" />
    </div>

    <!-- 郵遞區號：菲律賓非必填，其餘國家必填 -->
    <div class="flex flex-col gap-1">
      <label class="text-xs text-[var(--p-text-muted-color)]">
        郵遞區號 <span v-if="!isPhilippines" class="text-[var(--p-red-500)]">*</span>
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

    <!-- 臺灣：城市 / 區（連動） + 詳細收件地址 -->
    <template v-if="isTaiwan">
      <div class="flex flex-col gap-1">
        <label class="text-xs text-[var(--p-text-muted-color)]">城市 / 區 <span class="text-[var(--p-red-500)]">*</span></label>
        <div class="flex gap-2 sm:!w-[320px]">
          <Select v-model="shippingCity" :options="cityOptions" placeholder="請選擇城市" class="w-full" size="small" />
          <Select v-model="shippingDistrict" :options="districtOptions" placeholder="請選擇區" class="w-full" size="small" show-clear />
        </div>
      </div>
      <div class="flex flex-col gap-1">
        <label class="text-xs text-[var(--p-text-muted-color)]">詳細收件地址 <span class="text-[var(--p-red-500)]">*</span></label>
        <InputText v-model="shippingDetail" placeholder="街道、門牌、樓層" class="w-full" size="small" />
      </div>
    </template>

    <!-- 菲律賓：大區 → 省 → 市 → 村里（四層連動） + 詳細收件地址 -->
    <template v-else-if="isPhilippines">
      <div class="flex flex-col gap-1">
        <label class="text-xs text-[var(--p-text-muted-color)]">大區（Region） <span class="text-[var(--p-red-500)]">*</span></label>
        <Select v-model="phRegion" :options="phRegionOptions" placeholder="請選擇大區" class="w-full sm:!w-[320px]" size="small" />
      </div>
      <div class="flex flex-col gap-1">
        <label class="text-xs text-[var(--p-text-muted-color)]">省（Province） <span class="text-[var(--p-red-500)]">*</span></label>
        <Select v-model="phProvince" :options="phProvinceOptions" placeholder="請選擇省" class="w-full sm:!w-[320px]" size="small" />
      </div>
      <div class="flex flex-col gap-1">
        <label class="text-xs text-[var(--p-text-muted-color)]">市（City） <span class="text-[var(--p-red-500)]">*</span></label>
        <Select v-model="phCity" :options="phCityOptions" placeholder="請選擇市" class="w-full sm:!w-[320px]" size="small" />
      </div>
      <div class="flex flex-col gap-1">
        <label class="text-xs text-[var(--p-text-muted-color)]">村里（Barangay） <span class="text-[var(--p-red-500)]">*</span></label>
        <Select v-model="phBarangay" :options="phBarangayOptions" placeholder="請選擇村里" class="w-full sm:!w-[320px]" size="small" />
      </div>
      <div class="flex flex-col gap-1">
        <label class="text-xs text-[var(--p-text-muted-color)]">詳細收件地址 <span class="text-[var(--p-red-500)]">*</span></label>
        <InputText v-model="shippingDetail" placeholder="詳細收件地址" class="w-full" size="small" />
      </div>
    </template>

    <!-- 新加坡：只有詳細收件地址 -->
    <template v-else-if="isSingapore">
      <div class="flex flex-col gap-1">
        <label class="text-xs text-[var(--p-text-muted-color)]">詳細收件地址 <span class="text-[var(--p-red-500)]">*</span></label>
        <InputText v-model="shippingDetail" placeholder="無城市、無州省，直接填詳細地址" class="w-full" size="small" />
      </div>
    </template>

    <!-- 馬來西亞：城市（自由輸入） + 州/省/地區（下拉） + 詳細收件地址 -->
    <template v-else>
      <div class="flex flex-col gap-1">
        <label class="text-xs text-[var(--p-text-muted-color)]">城市 <span class="text-[var(--p-red-500)]">*</span></label>
        <InputText v-model="shippingForeignCity" placeholder="城市" class="w-full sm:!w-[320px]" size="small" />
      </div>
      <div class="flex flex-col gap-1">
        <label class="text-xs text-[var(--p-text-muted-color)]">州/省/地區 <span class="text-[var(--p-red-500)]">*</span></label>
        <Select v-model="shippingState" :options="malaysiaStateOptions" placeholder="請選擇州/省/地區" class="w-full sm:!w-[320px]" size="small" show-clear />
      </div>
      <div class="flex flex-col gap-1">
        <label class="text-xs text-[var(--p-text-muted-color)]">詳細收件地址 <span class="text-[var(--p-red-500)]">*</span></label>
        <InputText v-model="shippingDetail" placeholder="詳細收件地址" class="w-full" size="small" />
      </div>
    </template>
  </div>
</template>
