<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

/**
 * 規格群組（規格名稱 + 多個規格內容）。最多 3 組（顏色、尺寸、款式…）。
 * 一個商品可有多個群組，例：[{name:'顏色',values:['紅','藍']},{name:'尺寸',values:['S','M']}]
 */
export interface SpecGroup {
  /** 給 UI 用的暫時 id，與 LiveProduct.specs 的 id 無關 */
  id: number
  /** 規格名稱（例：顏色、尺寸） */
  name: string
  /** 規格內容（例：['紅','藍']） */
  values: string[]
}

/** 規格表單列：對應 N 群組的笛卡兒積一格 */
export interface SpecRow {
  /** 各群組對應 value，順序同 groups */
  parts: string[]
  cost: number
  originalPrice: number
  salePrice: number
  stock: number
  /** 圖片 URL（mock 環境保留欄位即可） */
  imageUrl?: string
}

export interface SpecEditorSavePayload {
  groups: SpecGroup[]
  rows: SpecRow[]
}

interface ExistingSpec {
  id?: number
  name?: string
}

interface Props {
  visible?: boolean
  /** 開啟時用來初始化 specGroups */
  initialSpecs?: ExistingSpec[]
}

const props = withDefaults(defineProps<Props>(), {
  visible: false,
  initialSpecs: () => [],
})

const emit = defineEmits<{
  'update:visible': [value: boolean]
  save: [payload: SpecEditorSavePayload]
}>()

const { t } = useI18n()

/** 規格群組上限 */
const MAX_GROUPS = 3

/** 規格名稱建議清單 */
const SPEC_NAME_SUGGESTIONS = [
  '顏色',
  '尺寸',
  '款式',
  '口味',
  '重量',
  '容量',
  '材質',
  '型號',
]

/**
 * 規格名稱對應的預設選項；選到名稱時若選項列還是空的，會把這些直接帶入。
 * 數量保守只放最常用的幾個，使用者可再點「+」加更多（從 SPEC_VALUE_SUGGESTIONS 取建議）。
 */
const SPEC_VALUE_DEFAULTS: Record<string, string[]> = {
  顏色: ['紅', '白', '黑'],
  尺寸: ['S', 'M', 'L'],
  款式: ['經典款', '限定款'],
  口味: ['巧克力', '香草', '薄荷'],
  重量: ['100g', '250g', '500g'],
  容量: ['250ml', '500ml', '1L'],
  材質: ['棉', '聚酯纖維'],
  型號: ['標準版', 'Pro 版'],
}


let rowSeq = 0
function makeGroup(name = '', values: string[] = []): SpecGroup {
  rowSeq += 1
  return { id: rowSeq, name, values: values.length > 0 ? [...values] : [''] }
}

const innerVisible = ref(props.visible)
const groups = ref<SpecGroup[]>([])

/** 用 combo key 對應 row 資料，combo key = parts.join('|') */
const rowDataMap = ref<Map<string, SpecRow>>(new Map())

function buildInitialGroups(): SpecGroup[] {
  const specs = props.initialSpecs || []
  if (specs.length === 0) return []
  const values = specs.map((s) => s.name?.trim()).filter((s): s is string => !!s)
  if (values.length === 0) return []
  return [makeGroup('', values)]
}

watch(
  () => props.visible,
  (v) => {
    innerVisible.value = v
    if (v) {
      groups.value = buildInitialGroups()
      rowDataMap.value = new Map()
    }
  },
)

function close(): void {
  innerVisible.value = false
  emit('update:visible', false)
}

function addGroup(): void {
  if (groups.value.length >= MAX_GROUPS) return
  groups.value.push(makeGroup())
}

function removeGroup(id: number): void {
  groups.value = groups.value.filter((g) => g.id !== id)
}

/** 在指定 group 末尾加一個空白選項，並聚焦到該 input */
function addValue(group: SpecGroup): void {
  group.values.push('')
  nextTick(() => {
    const refs = valueInputRefs.value[group.id]
    refs?.[refs.length - 1]?.focus()
  })
}

function removeValue(group: SpecGroup, index: number): void {
  if (group.values.length <= 1) {
    group.values[0] = ''
    return
  }
  group.values.splice(index, 1)
}

const nameSuggestionList = ref<string[]>([])
function onCompleteName(event: { query: string }): void {
  const q = (event.query || '').trim()
  nameSuggestionList.value = q
    ? SPEC_NAME_SUGGESTIONS.filter((s) => s.includes(q))
    : [...SPEC_NAME_SUGGESTIONS]
}

/**
 * 從名稱下拉選到項目時，直接用該規格在 SPEC_VALUE_DEFAULTS 的預設選項覆蓋
 * 目前的選項列；即使已有手動輸入也會被換掉（語義：切換規格＝重新挑一組選項）。
 * 名稱不在預設表內時不動原值（例：使用者手動 typing 自訂名稱）。
 */
function onSpecNameSelect(group: SpecGroup, event: { value: string }): void {
  const picked = (event.value ?? '').trim()
  const defaults = SPEC_VALUE_DEFAULTS[picked]
  if (!defaults || defaults.length === 0) return
  group.values = [...defaults]
}

const valueInputRefs = ref<Record<number, Array<HTMLInputElement | null>>>({})
function setValueInputRef(groupId: number, index: number, el: unknown): void {
  if (!valueInputRefs.value[groupId]) valueInputRefs.value[groupId] = []
  const node =
    el && typeof el === 'object' && '$el' in el
      ? ((el as { $el: HTMLElement }).$el.querySelector('input') as HTMLInputElement | null)
      : (el as HTMLInputElement | null)
  valueInputRefs.value[groupId][index] = node
}

/**
 * 規格表的笛卡兒積：每個 group 取「非空 value 陣列」；若 group 沒有任何值，
 * 用空字串佔位讓那欄變空 cell（與圖一致：規格名稱 2/3 沒值時表仍顯示一列）。
 */
const combinations = computed<string[][]>(() => {
  if (groups.value.length === 0) return []
  return groups.value.reduce<string[][]>(
    (acc, g) => {
      const vals = g.values.map((v) => v.trim()).filter(Boolean)
      const effective = vals.length > 0 ? vals : ['']
      return acc.flatMap((combo) => effective.map((v) => [...combo, v]))
    },
    [[]],
  )
})

function comboKey(parts: string[]): string {
  return parts.join('|')
}

function getRowData(parts: string[]): SpecRow {
  const key = comboKey(parts)
  let row = rowDataMap.value.get(key)
  if (!row) {
    row = { parts: [...parts], cost: 0, originalPrice: 0, salePrice: 0, stock: 0 }
    rowDataMap.value.set(key, row)
  }
  return row
}

// 批次套用：4 欄輸入後一鍵覆寫到所有 row
const batchCost = ref<number | null>(null)
const batchOriginal = ref<number | null>(null)
const batchSale = ref<number | null>(null)
const batchStock = ref<number | null>(null)

function applyBatch(): void {
  combinations.value.forEach((parts) => {
    const row = getRowData(parts)
    if (batchCost.value !== null) row.cost = batchCost.value
    if (batchOriginal.value !== null) row.originalPrice = batchOriginal.value
    if (batchSale.value !== null) row.salePrice = batchSale.value
    if (batchStock.value !== null) row.stock = batchStock.value
  })
}

/** 儲存：過濾掉沒填值的群組，rows 只回傳 combinations 中的 */
function onSave(): void {
  const cleanedGroups = groups.value
    .map((g) => ({
      ...g,
      name: g.name?.trim() || '',
      values: (g.values || []).map((v) => String(v).trim()).filter(Boolean),
    }))
    .filter((g) => g.values.length > 0)

  const rows = combinations.value
    .filter((parts) => parts.every((p) => p.trim().length > 0))
    .map((parts) => ({ ...getRowData(parts) }))

  emit('save', { groups: cleanedGroups, rows })
  close()
}

const hasGroups = computed(() => groups.value.length > 0)
const canAddMoreGroups = computed(() => groups.value.length < MAX_GROUPS)
const hasTable = computed(() => combinations.value.length > 0)

function groupColumnHeader(g: SpecGroup, index: number): string {
  return g.name?.trim() || t('live_order.spec_editor.column.spec_name_n', { n: index + 1 })
}
</script>

<template>
  <Dialog
    v-model:visible="innerVisible"
    modal
    :draggable="false"
    :style="{ width: 'min(1080px, calc(100vw - 32px))' }"
    :pt="{
      header: { style: 'padding: 17.5px' },
      content: { style: 'padding: 0 17.5px 17.5px' },
      footer: { style: 'padding: 0 17.5px 17.5px' },
    }"
    @update:visible="(v) => emit('update:visible', v)"
  >
    <template #header>
      <span class="font-semibold text-[var(--p-text-color)]" style="font-size: 17.5px">
        {{ t('live_order.dialog.spec_editor_header') }}
      </span>
    </template>

    <div class="flex flex-col gap-4 pt-2">
      <!-- 空狀態 -->
      <div v-if="!hasGroups" class="flex flex-col items-center gap-3 py-8 text-center">
        <span class="text-[14px] text-[var(--p-text-muted-color)]">
          {{ t('live_order.spec_editor.empty') }}
        </span>
        <Button
          :label="t('live_order.spec_editor.button.add_group')"
          icon="pi pi-plus"
          severity="secondary"
          variant="outlined"
          @click="addGroup"
        />
      </div>

      <!-- 規格群組（最多 3 組） -->
      <div v-else class="flex flex-col gap-5">
        <div
          v-for="(group, groupIndex) in groups"
          :key="group.id"
          class="flex flex-col gap-3"
        >
          <span class="text-[14px] font-semibold text-[var(--p-text-color)]">
            {{ t('live_order.spec_editor.label.group_title', { index: groupIndex + 1 }) }}
          </span>

          <div class="flex items-center gap-2">
            <AutoComplete
              v-model="group.name"
              :suggestions="nameSuggestionList"
              :placeholder="t('live_order.spec_editor.placeholder.name')"
              dropdown
              force-selection-on-blur="false"
              class="flex-1"
              input-class="w-full"
              @complete="onCompleteName"
              @item-select="(e) => onSpecNameSelect(group, e)"
            >
              <template #option="{ option }">
                <div class="flex items-baseline gap-2">
                  <span class="font-medium text-[var(--p-text-color)]">{{ option }}</span>
                  <span
                    v-if="SPEC_VALUE_DEFAULTS[option]?.length"
                    class="text-[12px] text-[var(--p-text-muted-color)]"
                  >
                    - {{ SPEC_VALUE_DEFAULTS[option].join('、') }}
                  </span>
                </div>
              </template>
            </AutoComplete>
            <Button
              :label="t('live_order.spec_editor.button.remove')"
              icon="pi pi-trash"
              severity="danger"
              variant="outlined"
              size="small"
              @click="removeGroup(group.id)"
            />
            <Button
              v-if="groupIndex === groups.length - 1 && canAddMoreGroups"
              :label="t('live_order.spec_editor.button.add_group_inline')"
              icon="pi pi-plus"
              size="small"
              @click="addGroup"
            />
          </div>

          <div class="flex items-center gap-2 flex-wrap">
            <i
              class="pi pi-bars text-[var(--p-text-muted-color)] shrink-0"
              style="font-size: 14px"
              :title="t('live_order.spec_editor.field.values')"
            ></i>
            <div
              v-for="(_v, valueIndex) in group.values"
              :key="`${group.id}-${valueIndex}`"
              class="relative group/value"
            >
              <InputText
                v-model="group.values[valueIndex]"
                :ref="(el) => setValueInputRef(group.id, valueIndex, el)"
                :placeholder="t('live_order.spec_editor.placeholder.values')"
                :class="[
                  '!w-[100px]',
                  !group.values[valueIndex]?.trim() ? 'placeholder:text-red-500' : '',
                ]"
                size="small"
                @keyup.enter="addValue(group)"
              />
              <button
                v-if="group.values.length > 1"
                v-tooltip.top="t('live_order.spec_editor.button.remove')"
                class="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-[var(--p-text-muted-color)] text-white text-[10px] flex items-center justify-center opacity-0 group-hover/value:opacity-100 transition-opacity"
                @click="removeValue(group, valueIndex)"
              >
                <i class="pi pi-times" style="font-size: 8px"></i>
              </button>
            </div>
            <Button
              v-tooltip.top="t('live_order.spec_editor.button.add_value')"
              icon="pi pi-plus"
              severity="secondary"
              variant="outlined"
              size="small"
              @click="addValue(group)"
            />
          </div>
        </div>
      </div>

      <!-- 規格表 -->
      <div
        v-if="hasTable"
        class="flex flex-col gap-3 pt-4 border-t border-[var(--p-content-border-color)]"
      >
        <span class="text-[15px] font-semibold text-[var(--p-text-color)]">
          {{ t('live_order.spec_editor.section.spec_table') }}
        </span>

        <!-- 批次套用列 -->
        <div class="flex items-center gap-2 flex-wrap">
          <InputNumber
            v-model="batchCost"
            :placeholder="t('live_order.spec_editor.field.cost_price')"
            :min="0"
            :use-grouping="false"
            input-class="!w-[120px]"
            size="small"
          />
          <InputNumber
            v-model="batchOriginal"
            :placeholder="t('live_order.spec_editor.field.original_price')"
            :min="0"
            :use-grouping="false"
            input-class="!w-[120px]"
            size="small"
          />
          <InputNumber
            v-model="batchSale"
            :placeholder="t('live_order.spec_editor.field.sale_price')"
            :min="0"
            :use-grouping="false"
            input-class="!w-[120px]"
            size="small"
          />
          <InputNumber
            v-model="batchStock"
            :placeholder="t('live_order.spec_editor.field.stock')"
            :min="0"
            :use-grouping="false"
            input-class="!w-[120px]"
            size="small"
          />
          <Button
            :label="t('live_order.spec_editor.button.apply')"
            icon="pi pi-check"
            severity="secondary"
            size="small"
            @click="applyBatch"
          />
        </div>

        <!-- 表頭 -->
        <div
          class="grid border-b border-[var(--p-content-border-color)] text-[13px] font-semibold text-[var(--p-text-color)]"
          :style="`grid-template-columns: 80px repeat(${groups.length}, minmax(120px, 1fr)) 120px 120px 120px 120px;`"
        >
          <div class="px-2 py-2">{{ t('live_order.spec_editor.column.image') }}</div>
          <div v-for="(g, i) in groups" :key="g.id" class="px-2 py-2">
            {{ groupColumnHeader(g, i) }}
          </div>
          <div class="px-2 py-2">{{ t('live_order.spec_editor.field.cost_price') }}</div>
          <div class="px-2 py-2">{{ t('live_order.spec_editor.field.original_price') }}</div>
          <div class="px-2 py-2">{{ t('live_order.spec_editor.field.sale_price') }}</div>
          <div class="px-2 py-2">{{ t('live_order.spec_editor.field.stock') }}</div>
        </div>

        <!-- 表身 -->
        <div
          v-for="(parts, rowIndex) in combinations"
          :key="comboKey(parts) + '-' + rowIndex"
          class="grid items-center border-b border-[var(--p-content-border-color)] last:border-b-0 text-[14px]"
          :style="`grid-template-columns: 80px repeat(${groups.length}, minmax(120px, 1fr)) 120px 120px 120px 120px;`"
        >
          <div class="px-2 py-2">
            <button
              class="w-[48px] h-[48px] border-2 border-dashed border-[var(--p-content-border-color)] rounded-[6px] bg-[var(--p-content-hover-background)] flex items-center justify-center hover:border-[var(--p-primary-color)] relative"
            >
              <i class="pi pi-image text-[var(--p-text-muted-color)]" style="font-size: 16px"></i>
              <i
                class="pi pi-plus-circle text-[var(--p-primary-color)] absolute -bottom-1 -right-1 bg-[var(--p-content-background)] rounded-full"
                style="font-size: 12px"
              ></i>
            </button>
          </div>
          <div
            v-for="(part, partIndex) in parts"
            :key="partIndex"
            class="px-2 py-2 text-[var(--p-text-color)] truncate"
          >
            {{ part }}
          </div>
          <div class="px-2 py-2">
            <InputNumber
              v-model="getRowData(parts).cost"
              :min="0"
              :use-grouping="false"
              :placeholder="'$0.00'"
              input-class="!w-full"
              size="small"
              class="w-full"
            />
          </div>
          <div class="px-2 py-2">
            <InputNumber
              v-model="getRowData(parts).originalPrice"
              :min="0"
              :use-grouping="false"
              :placeholder="'$0.00'"
              input-class="!w-full"
              size="small"
              class="w-full"
            />
          </div>
          <div class="px-2 py-2">
            <InputNumber
              v-model="getRowData(parts).salePrice"
              :min="0"
              :use-grouping="false"
              :placeholder="'$0.00'"
              input-class="!w-full"
              size="small"
              class="w-full"
            />
          </div>
          <div class="px-2 py-2">
            <InputNumber
              v-model="getRowData(parts).stock"
              :min="0"
              :use-grouping="false"
              :placeholder="'0'"
              input-class="!w-full"
              size="small"
              class="w-full"
            />
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="flex justify-end gap-2">
        <Button
          :label="t('live_order.button.cancel')"
          severity="secondary"
          variant="outlined"
          @click="close"
        />
        <Button :label="t('common.button.confirm')" icon="pi pi-check" @click="onSave" />
      </div>
    </template>
  </Dialog>
</template>
