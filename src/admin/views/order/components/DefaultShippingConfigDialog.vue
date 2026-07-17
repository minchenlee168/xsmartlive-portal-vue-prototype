<script setup lang="ts">
import { computed, ref, watch } from 'vue'

/**
 * 預設配送設定 Dialog。
 * 依「配送方式 × 溫層」矩陣預設對應物流商,消費者下單時自動帶入。
 *
 * - 宅配 / 7-11 / 全家 / 黑貓門市:三溫層皆可設(冷藏/冷凍部分空缺以 `—` 表示)
 * - 跨境:僅常溫
 * - 自取 / 商家自建:不分溫層,一組值即可
 */

interface Props {
  visible: boolean
}
const props = defineProps<Props>()
const emit = defineEmits<{
  'update:visible': [v: boolean]
}>()

const innerVisible = ref(props.visible)
watch(() => props.visible, v => { innerVisible.value = v })
watch(innerVisible, v => emit('update:visible', v))

// 各溫層可用物流商選項(冷藏 / 冷凍區分)
type Temp = 'warm' | 'chilled' | 'frozen'
interface CarrierOption { label: string; value: string }
const CARRIER_OPTIONS: Record<Temp, CarrierOption[]> = {
  warm: [
    { label: '黑貓宅急便',           value: 'tcat_normal' },
    { label: '黑貓宅急便(門市寄件)', value: 'tcat_handover' },
    { label: '7-11 交貨便(門市寄件)', value: 'cvs711_handover' },
    { label: '全家常溫',              value: 'fm_normal' },
    { label: '嘉里大榮常溫',          value: 'kerry_normal' },
    { label: '新竹物流',              value: 'hct' },
    { label: 'PRESCO 跨境物流',       value: 'presco' },
    { label: 'MIFFY 信義門市',        value: 'miffy_xinyi' },
  ],
  chilled: [
    { label: '黑貓宅急便',            value: 'tcat_chilled' },
    { label: '黑貓宅急便(門市寄件)',  value: 'tcat_handover_chilled' },
    { label: '7-11 B2C 冷藏到府收件', value: 'cvs711_b2c_chilled' },
  ],
  frozen: [
    { label: '黑貓宅急便',              value: 'tcat_frozen' },
    { label: '7-11 B2C 冷凍到府收件',   value: 'cvs711_b2c_frozen' },
    { label: '全家冷凍到府收件',        value: 'fm_cold_home' },
    { label: '黑貓宅急便(門市寄件)',    value: 'tcat_handover_frozen' },
    { label: '嘉里大榮低溫',            value: 'kerry_cold' },
  ],
}

// 預設值(對照附圖)
const config = ref({
  home:    { warm: 'tcat_normal',       chilled: 'tcat_chilled',           frozen: 'tcat_frozen' },
  cvs711:  { warm: 'cvs711_handover',   chilled: 'tcat_handover_chilled',  frozen: 'cvs711_b2c_frozen' },
  fm:      { warm: 'fm_normal',         chilled: null as string | null,    frozen: 'fm_cold_home' },
  tcat:    { warm: 'tcat_handover',     chilled: 'tcat_handover_chilled',  frozen: 'tcat_handover_frozen' },
  cross:   { warm: 'presco',            chilled: null,                     frozen: null },
  pickup:  'miffy_xinyi',
  self:    'auto',
})

const selfOptions: CarrierOption[] = [
  { label: '自動帶入對應設定', value: 'auto' },
  { label: '不啟用商家自建',   value: 'off' },
]
const pickupOptions: CarrierOption[] = [
  { label: 'MIFFY 信義門市', value: 'miffy_xinyi' },
  { label: 'MIFFY 東區門市', value: 'miffy_east' },
]

// 三溫層欄位設定:label + 對應 PrimeVue Tag severity（顏色 / 深淺色主題交給 Aura theme，不自訂色票）
interface TempColMeta { key: Temp; label: string; severity: 'warn' | 'info' | 'secondary' }
const TEMP_COLS: TempColMeta[] = [
  { key: 'warm',    label: '常溫', severity: 'warn' },      // 警告語意
  { key: 'chilled', label: '冷藏', severity: 'info' },      // 資訊語意
  { key: 'frozen',  label: '冷凍', severity: 'secondary' }, // 無官方冷色語意，用中性 secondary（靠文字區分）
]

// 上半區 6 個 row(配送方式 × 3 溫層);跨境冷藏/冷凍留白 —
interface MatrixRow {
  key: 'home' | 'cvs711' | 'fm' | 'tcat' | 'cross'
  icon: string
  label: string
  /** 每個溫層是否有可選項;null 顯示 `—` 灰底 Select disabled */
  availability: Record<Temp, boolean>
}
const MATRIX_ROWS: MatrixRow[] = [
  { key: 'home',   icon: 'pi pi-truck',              label: '宅配',       availability: { warm: true,  chilled: true,  frozen: true  } },
  { key: 'cvs711', icon: 'pi pi-shop',               label: '7-11',       availability: { warm: true,  chilled: true,  frozen: true  } },
  { key: 'fm',     icon: 'pi pi-briefcase',          label: '全家',       availability: { warm: true,  chilled: false, frozen: true  } },
  { key: 'tcat',   icon: 'pi pi-shopping-bag',       label: '黑貓門市',   availability: { warm: true,  chilled: true,  frozen: true  } },
  { key: 'cross',  icon: 'pi pi-globe',              label: '跨境',       availability: { warm: true,  chilled: false, frozen: false } },
]

function onSave(): void {
  emit('update:visible', false)
}
function onCancel(): void {
  emit('update:visible', false)
}
</script>

<template>
  <Dialog
    v-model:visible="innerVisible"
    modal
    :draggable="false"
    :style="{ width: 'min(880px, calc(100vw - 32px))' }"
    :pt="{ content: { style: 'padding: 0' } }"
  >
    <template #header>
      <div class="flex flex-col gap-1">
        <span class="text-lg font-bold text-[var(--p-text-color)]">預設配送設定</span>
        <span class="text-xs text-[var(--p-text-muted-color)]">
          依有啟用的物流商快速帶入設定,在消費者下單時自動帶入。
        </span>
      </div>
    </template>

    <div class="flex flex-col gap-4 p-6">
      <!-- 三溫層 grid：依彈窗寬度自適應，不用橫向捲軸 -->
      <div class="grid grid-cols-[120px_1fr_1fr_1fr] gap-x-2 gap-y-3 items-center">
        <!-- 溫層 header 列(左上角空、其餘三格為溫層 Tag) -->
        <div></div>
        <div v-for="t in TEMP_COLS" :key="t.key" class="flex justify-center">
          <Tag :value="t.label" :severity="t.severity" />
        </div>

        <!-- 配送方式 rows -->
        <template v-for="row in MATRIX_ROWS" :key="row.key">
          <div class="flex items-center gap-2 text-sm text-[var(--p-text-color)]">
            <i :class="row.icon" style="font-size: 14px; color: var(--p-primary-color)"></i>
            <span>{{ row.label }}</span>
          </div>
          <template v-for="t in TEMP_COLS" :key="`${row.key}-${t.key}`">
            <Select
              v-if="row.availability[t.key]"
              v-model="config[row.key][t.key]"
              :options="CARRIER_OPTIONS[t.key]"
              option-label="label"
              option-value="value"
              class="w-full"
              scroll-height="auto"
              :aria-label="`${row.label} ${t.label} 物流商`"
            />
            <div
              v-else
              class="min-h-[44px] flex items-center justify-center rounded-md bg-[var(--p-content-hover-background)] text-[var(--p-text-muted-color)] text-sm"
            >
              —
            </div>
          </template>
        </template>

        <!-- 自取 / 商家自建：併入同一矩陣、label 在左；不分溫層 → Select 橫跨三個溫層欄 -->
        <div class="flex items-center gap-2 text-sm text-[var(--p-text-color)]">
          <i class="pi pi-map-marker" style="font-size: 14px; color: var(--p-primary-color)"></i>
          <span>自取</span>
        </div>
        <Select
          v-model="config.pickup"
          :options="pickupOptions"
          option-label="label"
          option-value="value"
          class="col-span-3 w-full"
          aria-label="自取 物流商"
        />
        <div class="flex items-center gap-2 text-sm text-[var(--p-text-color)]">
          <i class="pi pi-building" style="font-size: 14px; color: var(--p-primary-color)"></i>
          <span>商家自建</span>
        </div>
        <Select
          v-model="config.self"
          :options="selfOptions"
          option-label="label"
          option-value="value"
          class="col-span-3 w-full"
          aria-label="商家自建 物流商"
        />
      </div>

      <!-- 資訊 banner：改用 PrimeVue Message（顏色 / 深淺色主題交給 Aura theme） -->
      <Message severity="info" :closable="false">
        <span class="text-xs leading-relaxed">
          下單時依配送方式與溫層自動帶入對應的預設物流商;跨境僅常溫;自取 / 商家自建不分溫層。商家可於訂單管理逐筆調整。
        </span>
      </Message>
    </div>

    <template #footer>
      <div class="flex items-center justify-end gap-2">
        <Button label="取消" severity="secondary" variant="outlined" @click="onCancel" />
        <Button label="儲存設定" @click="onSave" />
      </div>
    </template>
  </Dialog>
</template>
