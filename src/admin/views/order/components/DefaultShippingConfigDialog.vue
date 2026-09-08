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

type Temp = 'warm' | 'chilled' | 'frozen'
interface CarrierOption { label: string; value: string }
const opt = (label: string): CarrierOption => ({ label, value: label })
/** 每個 Select 皆可選「不指定」(比照 UAT) */
const NONE: CarrierOption = { label: '— 不指定 —', value: '' }

// 三溫層欄位設定:label + 對應 PrimeVue Tag severity
interface TempColMeta { key: Temp; label: string; severity: 'warn' | 'info' | 'secondary' }
const TEMP_COLS: TempColMeta[] = [
  { key: 'warm',    label: '常溫', severity: 'warn' },
  { key: 'chilled', label: '冷藏', severity: 'info' },
  { key: 'frozen',  label: '冷凍', severity: 'secondary' },
]

/**
 * 配送方式 × 溫層矩陣;每一列(物流商群組)各溫層有「自己專屬」的物流商選項(比照 UAT,
 * 例如全家列只出現全家的服務,不會出現黑貓 / 7-11)。cells[temp] = null 代表該溫層不適用(顯示 —)。
 */
interface MatrixRow {
  key: 'home' | 'cvs711' | 'fm' | 'tcat' | 'cross'
  icon: string
  label: string
  cells: Record<Temp, CarrierOption[] | null>
}
const MATRIX_ROWS: MatrixRow[] = [
  { key: 'home', icon: 'pi pi-truck', label: '宅配', cells: {
    warm:    ['黑貓宅急便', '新竹物流', '嘉里大榮常溫', '嘉里快遞'].map(opt),
    chilled: ['黑貓宅急便', '嘉里大榮低溫'].map(opt),
    frozen:  ['黑貓宅急便', '嘉里大榮低溫', '新竹物流'].map(opt),
  } },
  { key: 'cvs711', icon: 'pi pi-shop', label: '7-11', cells: {
    warm:    ['7-11 交貨便（門市寄件）', '7-11 B2C 到府收件', '黑貓宅急便（門市寄件）'].map(opt),
    chilled: ['黑貓宅急便（門市寄件）'].map(opt),
    frozen:  ['7-11 B2C 冷凍到府收件', '黑貓宅急便（門市寄件）'].map(opt),
  } },
  { key: 'fm', icon: 'pi pi-briefcase', label: '全家', cells: {
    warm:    ['全家常溫', '全家 C2C 店到店'].map(opt),
    chilled: null,
    frozen:  ['全家冷凍到府收件'].map(opt),
  } },
  { key: 'tcat', icon: 'pi pi-shopping-bag', label: '黑貓門市', cells: {
    warm:    ['黑貓宅急便（門市寄件）'].map(opt),
    chilled: ['黑貓宅急便（門市寄件）'].map(opt),
    frozen:  ['黑貓宅急便（門市寄件）'].map(opt),
  } },
  { key: 'cross', icon: 'pi pi-globe', label: '跨境', cells: {
    warm:    ['PRESCO 跨境物流'].map(opt),
    chilled: null,
    frozen:  null,
  } },
]

// 各格預設值 = 該格第一個選項(比照 UAT 已選狀態)
const config = ref<Record<string, Partial<Record<Temp, string>>>>(
  Object.fromEntries(MATRIX_ROWS.map(r => [
    r.key,
    Object.fromEntries(
      (['warm', 'chilled', 'frozen'] as Temp[])
        .filter(t => r.cells[t])
        .map(t => [t, r.cells[t]![0].value]),
    ),
  ])),
)

// 自取 / 商家自建:不分溫層,各一組專屬選項
const pickupOptions: CarrierOption[] = ['MIFFY 信義門市', 'MIFFY 內湖門市'].map(opt)
const selfOptions: CarrierOption[] = ['自動帶入對應設定'].map(opt)
const pickup = ref('MIFFY 信義門市')
const self = ref('自動帶入對應設定')

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
    :style="{ width: 'min(960px, calc(100vw - 32px))' }"
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
      <!-- 桌機(md+):三溫層矩陣;依彈窗寬度自適應,不用橫向捲軸 -->
      <div class="hidden md:grid gap-x-2 gap-y-3 items-center" style="grid-template-columns: 96px minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)">
        <!-- 溫層 header 列(左上角空、其餘三格為溫層 Tag) -->
        <div></div>
        <div v-for="t in TEMP_COLS" :key="t.key" class="flex justify-center">
          <!-- 冷凍:比照 UAT 用冷色系(cyan)+ 雪花,與冷藏藍色區隔 -->
          <Tag v-if="t.key === 'frozen'" :style="{ background: '#cffafe', color: '#0e7490' }">
            <span class="inline-flex items-center gap-1">❄ {{ t.label }}</span>
          </Tag>
          <Tag v-else :value="t.label" :severity="t.severity" />
        </div>

        <!-- 配送方式 rows -->
        <template v-for="row in MATRIX_ROWS" :key="row.key">
          <div class="flex items-center gap-2 text-sm text-[var(--p-text-color)]">
            <i :class="row.icon" style="font-size: 14px; color: var(--p-primary-color)"></i>
            <span>{{ row.label }}</span>
          </div>
          <template v-for="t in TEMP_COLS" :key="`${row.key}-${t.key}`">
            <Select
              v-if="row.cells[t.key]"
              v-model="config[row.key][t.key]"
              :options="[NONE, ...row.cells[t.key]!]"
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
          v-model="pickup"
          :options="[NONE, ...pickupOptions]"
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
          v-model="self"
          :options="[NONE, ...selfOptions]"
          option-label="label"
          option-value="value"
          class="col-span-3 w-full"
          aria-label="商家自建 物流商"
        />
      </div>

      <!-- 手機(md 以下):每個配送方式底下,常溫 / 冷藏 / 冷凍各自一行 -->
      <div class="flex flex-col gap-5 md:hidden">
        <div v-for="row in MATRIX_ROWS" :key="`m-${row.key}`" class="flex flex-col gap-2">
          <div class="flex items-center gap-2 text-sm font-medium text-[var(--p-text-color)]">
            <i :class="row.icon" style="font-size: 14px; color: var(--p-primary-color)"></i>
            <span>{{ row.label }}</span>
          </div>
          <div v-for="t in TEMP_COLS" :key="`m-${row.key}-${t.key}`" class="flex items-center gap-2">
            <Tag v-if="t.key === 'frozen'" :style="{ background: '#cffafe', color: '#0e7490' }" class="!min-w-[56px] justify-center shrink-0">
              <span class="inline-flex items-center gap-1">❄ {{ t.label }}</span>
            </Tag>
            <Tag v-else :value="t.label" :severity="t.severity" class="!min-w-[56px] justify-center shrink-0" />
            <Select
              v-if="row.cells[t.key]"
              v-model="config[row.key][t.key]"
              :options="[NONE, ...row.cells[t.key]!]"
              option-label="label"
              option-value="value"
              class="flex-1"
              scroll-height="auto"
              :aria-label="`${row.label} ${t.label} 物流商`"
            />
            <div v-else class="flex-1 min-h-[44px] flex items-center justify-center rounded-md bg-[var(--p-content-hover-background)] text-[var(--p-text-muted-color)] text-sm">—</div>
          </div>
        </div>
        <!-- 自取 / 商家自建:不分溫層 -->
        <div class="flex flex-col gap-2">
          <div class="flex items-center gap-2 text-sm font-medium text-[var(--p-text-color)]">
            <i class="pi pi-map-marker" style="font-size: 14px; color: var(--p-primary-color)"></i>
            <span>自取</span>
          </div>
          <Select v-model="pickup" :options="[NONE, ...pickupOptions]" option-label="label" option-value="value" class="w-full" aria-label="自取 物流商" />
        </div>
        <div class="flex flex-col gap-2">
          <div class="flex items-center gap-2 text-sm font-medium text-[var(--p-text-color)]">
            <i class="pi pi-building" style="font-size: 14px; color: var(--p-primary-color)"></i>
            <span>商家自建</span>
          </div>
          <Select v-model="self" :options="[NONE, ...selfOptions]" option-label="label" option-value="value" class="w-full" aria-label="商家自建 物流商" />
        </div>
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
