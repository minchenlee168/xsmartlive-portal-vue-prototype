<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'

/**
 * 規格設定（簡化版，最多 2 層；無 per-variant 圖片上傳）。
 *
 * 對外為兩張 Card：
 * - 規格 Card：spec 群組 + 選項 chips；右上 X 關閉鈕回銷售設定
 * - 規格表 Card：批次套用 row + variant table（依 spec 自動 cross-product）
 *
 * v-model:specs / v-model:variants 雙向；保留既有 variant 值依 optionIds key 對應。
 */

export interface SpecOption {
  id: number
  name: string
}
export interface SpecGroup {
  id: number
  name: string
  options: SpecOption[]
}
export interface Variant {
  id: number
  /** 對應每個 spec group 的 option id 組合，長度 = specs.length */
  optionIds: number[]
  cost: number
  originalPrice: number
  salePrice: number
  stock: number
}

interface Props {
  specs: SpecGroup[]
  variants: Variant[]
  readonly?: boolean
}
const props = withDefaults(defineProps<Props>(), { readonly: false })
const emit = defineEmits<{
  'update:specs': [value: SpecGroup[]]
  'update:variants': [value: Variant[]]
  'close-spec': []
}>()

const MAX_SPEC_LEVELS = 2

const specs = computed<SpecGroup[]>({
  get: () => props.specs,
  set: (v) => emit('update:specs', v),
})
const variants = computed<Variant[]>({
  get: () => props.variants,
  set: (v) => emit('update:variants', v),
})

let nextId = Date.now()
function genId(): number { return ++nextId }

/** 依目前 specs 算出 variants cross product；已存在的 variant 依 optionIds 保留價格庫存 */
function rebuildVariants(): void {
  if (specs.value.length === 0 || specs.value.some((s) => s.options.length === 0)) {
    variants.value = []
    return
  }
  const cartesian: number[][] = specs.value.reduce<number[][]>((acc, group) => {
    const next: number[][] = []
    group.options.forEach((opt) => {
      if (acc.length === 0) next.push([opt.id])
      else acc.forEach((combo) => next.push([...combo, opt.id]))
    })
    return next
  }, [])

  const existingMap = new Map<string, Variant>()
  variants.value.forEach((v) => existingMap.set(v.optionIds.join('-'), v))

  variants.value = cartesian.map((combo) => {
    const key = combo.join('-')
    const existing = existingMap.get(key)
    if (existing) return { ...existing, optionIds: combo }
    return {
      id: genId(),
      optionIds: combo,
      cost: 0,
      originalPrice: 0,
      salePrice: 0,
      stock: 0,
    }
  })
}

watch(specs, () => rebuildVariants(), { deep: true })

function addSpecGroup(): void {
  if (specs.value.length >= MAX_SPEC_LEVELS) return
  specs.value.push({
    id: genId(),
    name: '',
    options: [{ id: genId(), name: '' }],
  })
}
function removeSpecGroup(groupId: number): void {
  specs.value = specs.value.filter((g) => g.id !== groupId)
}
function addOption(group: SpecGroup): void {
  group.options.push({ id: genId(), name: '' })
}
function removeOption(group: SpecGroup, optionId: number): void {
  group.options = group.options.filter((o) => o.id !== optionId)
}

// 批次套用：把 4 個值寫進所有 variants；0 視為不覆蓋
const bulk = ref({ cost: 0, originalPrice: 0, salePrice: 0, stock: 0 })
function applyBulk(): void {
  variants.value = variants.value.map((v) => ({
    ...v,
    cost:          bulk.value.cost          || v.cost,
    originalPrice: bulk.value.originalPrice || v.originalPrice,
    salePrice:     bulk.value.salePrice     || v.salePrice,
    stock:         bulk.value.stock         || v.stock,
  }))
}

function optionName(groupIndex: number, optionId: number): string {
  return specs.value[groupIndex]?.options.find((o) => o.id === optionId)?.name ?? ''
}

function closeSpec(): void {
  emit('close-spec')
}
</script>

<template>
  <!-- 規格定義 Card -->
  <Card class="relative">
    <template #title>
      <div class="flex items-center justify-between">
        <span>規格</span>
        <Button
          v-if="!readonly"
          v-tooltip.left="'關閉規格'"
          icon="pi pi-times"
          severity="secondary"
          rounded
          text
          @click="closeSpec"
        />
      </div>
    </template>
    <template #content>
      <div class="flex flex-col gap-4">
        <div
          v-for="(group, gi) in specs"
          :key="group.id"
          class="flex flex-col gap-2"
          :class="gi > 0 ? 'pt-4 border-t border-surface' : ''"
        >
          <span class="text-sm font-bold text-color">規格群組 {{ gi + 1 }}</span>

          <!-- 規格名稱列：InputText + 下拉箭頭 + 刪除；最後一組才有 新增 -->
          <div class="flex flex-wrap items-center gap-2">
            <div class="inline-flex">
              <InputText
                v-model="group.name"
                placeholder="請輸入規格名稱，例如：顏色、尺寸"
                class="!w-[260px] !rounded-r-none"
                :disabled="readonly"
              />
              <button
                type="button"
                class="px-3 border border-l-0 border-[var(--p-content-border-color)] rounded-r-md bg-white hover:bg-surface-50 text-color-secondary"
                :disabled="readonly"
              >
                <i class="pi pi-chevron-down" style="font-size: 12px"></i>
              </button>
            </div>
            <Button
              v-if="!readonly"
              label="刪除"
              icon="pi pi-trash"
              severity="danger"
              variant="outlined"
              size="small"
              @click="removeSpecGroup(group.id)"
            />
            <Button
              v-if="!readonly && gi === specs.length - 1 && specs.length < MAX_SPEC_LEVELS"
              label="新增"
              icon="pi pi-plus"
              variant="outlined"
              size="small"
              @click="addSpecGroup"
            />
          </div>

          <!-- 選項列：每個 option = 拖曳手柄 + name input + 紅色 − 移除；末尾再放一顆灰色 + 新增 -->
          <div class="flex flex-wrap items-center gap-2">
            <div
              v-for="opt in group.options"
              :key="opt.id"
              class="inline-flex items-center gap-1"
            >
              <i class="pi pi-bars text-color-secondary cursor-grab mr-1" style="font-size: 14px"></i>
              <div class="inline-flex">
                <InputText
                  v-model="opt.name"
                  placeholder="請輸入選項"
                  :invalid="!opt.name.trim()"
                  class="!w-[140px] !rounded-r-none"
                  :disabled="readonly"
                />
                <button
                  v-if="!readonly"
                  type="button"
                  v-tooltip.top="'移除選項'"
                  class="px-3 border border-l-0 rounded-r-md bg-white text-red-500 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  :class="!opt.name.trim() ? 'border-red-400' : 'border-[var(--p-content-border-color)]'"
                  :disabled="group.options.length <= 1"
                  @click="removeOption(group, opt.id)"
                >
                  <i class="pi pi-minus" style="font-size: 11px"></i>
                </button>
              </div>
            </div>
            <button
              v-if="!readonly"
              type="button"
              v-tooltip.top="'新增選項'"
              class="px-3 py-2 border border-[var(--p-content-border-color)] rounded-md bg-surface-50 text-color-secondary hover:bg-surface-100"
              @click="addOption(group)"
            >
              <i class="pi pi-plus" style="font-size: 12px"></i>
            </button>
          </div>
        </div>
      </div>
    </template>
  </Card>

  <!-- 規格表 Card -->
  <Card>
    <template #title>規格表</template>
    <template #content>
      <!-- 批次套用 row -->
      <div v-if="!readonly && variants.length > 0" class="flex flex-wrap items-center gap-2 mb-4">
        <InputNumber
          v-model="bulk.cost"
          mode="currency"
          currency="TWD"
          locale="zh-TW"
          :min="0"
          placeholder="成本價"
          class="!w-[140px]"
        />
        <InputNumber
          v-model="bulk.originalPrice"
          mode="currency"
          currency="TWD"
          locale="zh-TW"
          :min="0"
          placeholder="原價"
          class="!w-[140px]"
        />
        <InputNumber
          v-model="bulk.salePrice"
          mode="currency"
          currency="TWD"
          locale="zh-TW"
          :min="0"
          placeholder="售價"
          class="!w-[140px]"
        />
        <InputNumber v-model="bulk.stock" :min="0" placeholder="庫存" class="!w-[140px]" />
        <Button
          label="套用"
          icon="pi pi-check"
          severity="secondary"
          variant="outlined"
          @click="applyBulk"
        />
      </div>

      <!-- variants 表 -->
      <DataTable
        v-if="variants.length > 0"
        :value="variants"
        data-key="id"
        class="w-full"
        :pt="{
          column: {
            headerCell: { style: 'background:transparent;font-size:14px;font-weight:600' },
            bodyCell:   { style: 'font-size:14px' },
          },
        }"
      >
        <Column header="圖片" style="width: 80px">
          <template #body>
            <button
              type="button"
              v-tooltip.top="'上傳規格圖片'"
              class="size-[48px] rounded-md border border-dashed border-surface flex items-center justify-center text-color-secondary hover:border-primary hover:text-primary"
            >
              <i class="pi pi-image" style="font-size: 18px"></i>
            </button>
          </template>
        </Column>
        <Column
          v-for="(group, gi) in specs"
          :key="group.id"
          :header="group.name || `規格名稱 ${gi + 1}`"
          style="min-width: 120px"
        >
          <template #body="{ data }">
            {{ optionName(gi, data.optionIds[gi]) || '—' }}
          </template>
        </Column>
        <Column header="成本價" style="width: 150px">
          <template #body="{ data }">
            <InputNumber v-model="data.cost" mode="currency" currency="TWD" locale="zh-TW" :min="0" :disabled="readonly" class="w-full" />
          </template>
        </Column>
        <Column header="原價" style="width: 150px">
          <template #body="{ data }">
            <InputNumber v-model="data.originalPrice" mode="currency" currency="TWD" locale="zh-TW" :min="0" :disabled="readonly" class="w-full" />
          </template>
        </Column>
        <Column header="售價" style="width: 150px">
          <template #body="{ data }">
            <InputNumber v-model="data.salePrice" mode="currency" currency="TWD" locale="zh-TW" :min="0" :disabled="readonly" class="w-full" />
          </template>
        </Column>
        <Column header="庫存" style="width: 120px">
          <template #body="{ data }">
            <InputNumber v-model="data.stock" :min="0" :disabled="readonly" class="w-full" />
          </template>
        </Column>
      </DataTable>

      <p v-else class="py-6 text-center text-sm text-color-secondary">
        每個規格至少填一個選項才會產生規格組合。
      </p>
    </template>
  </Card>
</template>
