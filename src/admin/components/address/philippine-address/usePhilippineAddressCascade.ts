import { PH_ADDRESS_DATA, PH_REGION_OPTIONS } from './phAddressData'
import { computed, type Ref } from 'vue'

/** 菲律賓地址四層的選值 ref（`null` / 空字串＝沒選）。 */
export interface UsePhilippineAddressCascadeOptions {
  region: Ref<string | null>
  province: Ref<string | null>
  city: Ref<string | null>
  /** barangay（村里）。 */
  barangay: Ref<string | null>
}

/**
 * 菲律賓地址四層下拉的選項與連動。
 *
 * 對齊正式專案 libs/philippine-address 的 usePhilippineAddressCascade：選上層才有下層選項，
 * 換上層清掉下層。正式版為 API 載入 + 錯誤 toast，此處改讀本地靜態資料、同步計算。
 *
 * @param options - 四層選值的 ref（元件的 `defineModel`）
 * @returns 四層選項（computed）與換大區 / 省 / 市的處理函式
 */
export function usePhilippineAddressCascade(options: UsePhilippineAddressCascadeOptions) {
  const { region, province, city, barangay } = options

  const regionOptions = computed(() => PH_REGION_OPTIONS)
  const provinceOptions = computed(() => Object.keys(PH_ADDRESS_DATA[region.value ?? ''] ?? {}))
  const cityOptions = computed(() => Object.keys(PH_ADDRESS_DATA[region.value ?? '']?.[province.value ?? ''] ?? {}))
  const barangayOptions = computed(
    () => PH_ADDRESS_DATA[region.value ?? '']?.[province.value ?? '']?.[city.value ?? ''] ?? [],
  )

  /** 換大區：省、市、村里都要重選。 */
  function selectRegion(value: string | null): void {
    region.value = value ?? null
    province.value = null
    city.value = null
    barangay.value = null
  }

  /** 換省：市、村里要重選。 */
  function selectProvince(value: string | null): void {
    province.value = value ?? null
    city.value = null
    barangay.value = null
  }

  /** 換市：村里要重選。 */
  function selectCity(value: string | null): void {
    city.value = value ?? null
    barangay.value = null
  }

  return {
    regionOptions,
    provinceOptions,
    cityOptions,
    barangayOptions,
    selectRegion,
    selectProvince,
    selectCity,
  }
}
