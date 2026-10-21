<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import BaseFormField from '@/admin/components/ui/BaseFormField.vue'
import { useSpecManager } from './composables/useSpecManager'
import { fetchSpecListApi, type SpecListItem, type SpecListChild } from '@/admin/api/portal-spec'
import type {
  PortalProductSpec as Spec,
  PortalProductVariant as Variant,
} from './schemas'

/**
 * 規格表元件 — 由 portal-vue 同名元件 port 過來，差異：
 * - 移除 AI 建議 chip / header-extras slot 仍保留以維持父層擴充點
 * - 移除規格圖片上傳（需要 ImageEditorDialog 與後端 uploadImageApi）
 * - 移除規格名稱模板建議（需要 fetchSpecListApi）
 */

interface Props {
  /** 是否唯讀模式 */
  readonly: boolean
  /** 初始規格數據（編輯模式使用） */
  initialSpecs?: Spec[]
  /** 初始變體數據（編輯模式使用） */
  initialVariants?: Variant[]
}

const props = withDefaults(defineProps<Props>(), {
  readonly: false,
  initialSpecs: () => [],
  initialVariants: () => [],
})

const emit = defineEmits<{
  'update:data': [data: { specs: Spec[]; variants: Variant[] }]
  'close-spec': []
}>()

const { t } = useI18n()

const specManager = useSpecManager()

const specCount = computed(() => specManager.specs.value.length)

/** 拖曳狀態 */
const dragState = ref<{
  specIndex: number
  fromIndex: number
  overIndex: number | null
} | null>(null)

watch(
  () => ({
    specs: specManager.specs.value,
    variants: specManager.variants.value,
  }),
  (newData) => {
    emit('update:data', {
      specs: newData.specs,
      variants: newData.variants,
    })
  },
  { deep: true },
)

onMounted(() => {
  if (
    props.initialSpecs &&
    props.initialSpecs.length > 0 &&
    props.initialVariants &&
    props.initialVariants.length > 0
  ) {
    specManager.importData(props.initialSpecs, props.initialVariants)
  } else {
    specManager.addSpec('')
  }
})

/**
 * 對外暴露：由父元件呼叫，將外部規格架構直接覆蓋現有規格表。
 */
function importSpecs(specs: Spec[]): void {
  specManager.importData(specs, [])
}

defineExpose({
  importSpecs,
})

function handleCancelSpec(): void {
  emit('close-spec')
}

function handleAddSpec(): void {
  if (specCount.value >= 3) return
  specManager.addSpec('')
}

function handleRemoveSpec(specIndex: number): void {
  specManager.removeSpec(specIndex)
}

function handleAddSpecChild(specIndex: number, childIndex: number): void {
  specManager.addSpecChild(specIndex, childIndex, '')
}

function handleRemoveSpecChild(specIndex: number, childIndex: number): void {
  specManager.removeSpecChild(specIndex, childIndex)
}

/**
 * 規格名稱建議來自 mock API（對齊 portal-vue 使用 `fetchSpecListApi`，未來可換真實後台）。
 * 每筆 SpecListItem 帶 children，用來下拉選到時自動帶入預設選項。
 */
const specsSuggestions = ref<SpecListItem[]>([])
const nameSuggestionList = ref<SpecListItem[]>([])

onMounted(() => {
  fetchSpecListApi().then((response) => {
    if (response.success) specsSuggestions.value = response.data
  })
})

function onCompleteSpecName(event: { query: string }): void {
  const q = (event.query || '').trim()
  nameSuggestionList.value = q
    ? specsSuggestions.value.filter((s) => s.name.includes(q))
    : [...specsSuggestions.value]
}

/**
 * AutoComplete 同時支援自由輸入（字串）與下拉選取（物件）。
 * 自由輸入時直接寫名稱；下拉選取時用該 spec 的 children 整批帶入選項。
 */
function onSpecNameSelect(specIndex: number, event: { value: SpecListItem | string }): void {
  if (typeof event.value === 'string') return
  const picked = event.value
  handleSpecNameChange(specIndex, picked.name)
  if (picked.children && picked.children.length > 0) {
    specManager.updateSpecChildren(
      specIndex,
      picked.children.map((c, idx) => ({ id: idx, name: c.name })),
    )
  }
}

// ── 規格圖片（第一層規格）─────────────────────────
/**
 * 規格圖片上傳：mock 環境直接讀檔轉 base64 存到 specs[0].children[i].imageUrl，
 * 不打 uploadImageApi；imageId 用負數遞減的 placeholder 避免跟後端 id 衝突。
 */
const specImageFileInputRef = ref<HTMLInputElement | null>(null)
const pendingSpecImageChildIndex = ref<number | null>(null)
const isUploadingSpecImage = ref(false)
let nextLocalImageId = -1

function handleSpecImageClick(childIndex: number): void {
  if (props.readonly || isUploadingSpecImage.value) return
  pendingSpecImageChildIndex.value = childIndex
  specImageFileInputRef.value?.click()
}

async function handleSpecImageFileChange(event: Event): Promise<void> {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  const childIndex = pendingSpecImageChildIndex.value
  target.value = ''
  if (!file || childIndex === null) return
  isUploadingSpecImage.value = true
  try {
    const base64 = await readFileAsBase64(file)
    specManager.updateSpecChildImage(0, childIndex, nextLocalImageId--, base64)
  } finally {
    isUploadingSpecImage.value = false
    pendingSpecImageChildIndex.value = null
  }
}

function handleClearSpecImage(childIndex: number): void {
  if (props.readonly) return
  specManager.clearSpecChildImage(0, childIndex)
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

function handleSpecNameChange(specIndex: number, specName: string): void {
  specManager.updateSpecName(specIndex, specName)
}

function handleDragStart(event: DragEvent, specIndex: number, childIndex: number): void {
  dragState.value = {
    specIndex,
    fromIndex: childIndex,
    overIndex: null,
  }

  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', `${specIndex}-${childIndex}`)
  }
}

function handleDragEnter(event: DragEvent, specIndex: number, childIndex: number): void {
  if (props.readonly) return
  if (!dragState.value || dragState.value.specIndex !== specIndex) return
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
  dragState.value.overIndex = childIndex
}

function handleDragOver(event: DragEvent): void {
  if (props.readonly) return
  if (!dragState.value) return
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
}

function handleDragLeave(): void {
  if (props.readonly) return
  if (!dragState.value) return
  dragState.value.overIndex = null
}

function handleDrop(event: DragEvent, specIndex: number, childIndex: number): void {
  event.preventDefault()
  event.stopPropagation()
  if (props.readonly) return

  if (!dragState.value || dragState.value.specIndex !== specIndex) {
    dragState.value = null
    return
  }

  const { fromIndex } = dragState.value
  if (fromIndex !== childIndex) {
    specManager.moveSpecChild(specIndex, fromIndex, childIndex)
  }
  dragState.value = null
}

function handleDragEnd(): void {
  dragState.value = null
}

/** 批次輸入 */
const batchInput = ref({
  cost: null as number | null,
  originalPrice: null as number | null,
  salePrice: null as number | null,
  stock: null as number | null,
})

function applyBatchInput(): void {
  const variants = specManager.variants.value

  variants.forEach((variant) => {
    if (batchInput.value.cost !== null) {
      specManager.updateVariant(variant.specIndex, 'cost', batchInput.value.cost)
    }
    if (batchInput.value.originalPrice !== null) {
      specManager.updateVariant(
        variant.specIndex,
        'originalPrice',
        batchInput.value.originalPrice,
      )
    }
    if (batchInput.value.salePrice !== null) {
      specManager.updateVariant(variant.specIndex, 'salePrice', batchInput.value.salePrice)
    }
    if (batchInput.value.stock !== null) {
      specManager.updateVariant(variant.specIndex, 'stock', batchInput.value.stock)
    }
  })

  batchInput.value = {
    cost: null,
    originalPrice: null,
    salePrice: null,
    stock: null,
  }
}

function getSpecValueRowspan(specIndex: number): number | undefined {
  const specs = specManager.specs.value
  if (specIndex >= specs.length - 1) return undefined

  let rowspan = 1
  for (let i = specIndex + 1; i < specs.length; i++) {
    rowspan *= specs[i].children.length
  }

  return rowspan > 1 ? rowspan : undefined
}

function shouldShowSpecValue(rowIndex: number, specIndex: number): boolean {
  const rowspan = getSpecValueRowspan(specIndex)
  if (!rowspan) return true
  return rowIndex % rowspan === 0
}

function handleTableKeyNav(
  event: KeyboardEvent,
  rowIndex: number,
  field: 'cost' | 'originalPrice' | 'salePrice' | 'stock',
): void {
  const key = event.key
  if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) return

  event.preventDefault()
  event.stopPropagation()

  let targetRow = rowIndex
  let targetField = field
  const flatList = specManager.flatVariants.value

  const fieldOrder: Array<'cost' | 'originalPrice' | 'salePrice' | 'stock'> = [
    'cost',
    'originalPrice',
    'salePrice',
    'stock',
  ]

  if (key === 'ArrowUp' && targetRow > 0) {
    targetRow--
  } else if (key === 'ArrowDown' && targetRow < flatList.length - 1) {
    targetRow++
  } else if (key === 'ArrowLeft') {
    const currentFieldIndex = fieldOrder.indexOf(field)
    if (currentFieldIndex > 0) targetField = fieldOrder[currentFieldIndex - 1]
  } else if (key === 'ArrowRight') {
    const currentFieldIndex = fieldOrder.indexOf(field)
    if (currentFieldIndex < fieldOrder.length - 1) {
      targetField = fieldOrder[currentFieldIndex + 1]
    }
  }

  focusTableCell(targetRow, targetField)
}

function focusTableCell(
  rowIndex: number,
  field: 'cost' | 'originalPrice' | 'salePrice' | 'stock',
): void {
  nextTick(() => {
    const selector = `[data-cell="${field}-${rowIndex}"]`
    const element = document.querySelector(selector) as HTMLElement | null
    if (element) {
      const input = element.querySelector('input') as HTMLInputElement | null
      if (input) {
        input.focus()
        input.select()
      }
    }
  })
}
</script>

<template>
  <section class="border-b border-[var(--p-content-border-color)] pb-5">
    <div class="flex items-center justify-between gap-3 mb-4">
      <div class="flex flex-1 flex-wrap items-center gap-3">
        <h3 class="text-base font-semibold text-[var(--p-text-color)]">
          {{ t('portal_product.spec_table.section.specs') }}
        </h3>
        <slot name="header-extras" />
      </div>
      <Button
        :label="t('portal_product.button.remove_spec')"
        severity="secondary"
        variant="outlined"
        size="small"
        icon="pi pi-trash"
        @click="handleCancelSpec"
      />
    </div>
      <div class="flex flex-col">
        <div
          v-for="(spec, specIndex) in specManager.specs.value"
          :key="specIndex"
          class="space-y-2"
        >
          <BaseFormField
            :label="`${t('portal_product.spec_table.label.spec_group')} ${specIndex + 1}`"
            class-name="w-full"
          >
            <div class="flex items-center gap-2">
              <AutoComplete
                :id="`spec_${specIndex + 1}`"
                :model-value="spec.name"
                :suggestions="nameSuggestionList"
                :disabled="readonly"
                :placeholder="t('portal_product.spec_table.placeholder.spec_name')"
                :name="`spec_${specIndex + 1}-name`"
                field="name"
                dropdown
                class="w-80"
                input-class="w-full"
                @complete="onCompleteSpecName"
                @update:model-value="(val) =>
                  handleSpecNameChange(
                    specIndex,
                    typeof val === 'string' ? val : ((val as SpecListItem | null)?.name ?? ''),
                  )
                "
                @item-select="(e) => onSpecNameSelect(specIndex, e)"
              >
                <template #option="{ option }">
                  <div class="flex flex-col">
                    <span>{{ option.name }}</span>
                    <div
                      v-if="option.children && option.children.length > 0"
                      class="text-xs text-[var(--p-text-muted-color)]"
                    >
                      {{ option.children.map((c: SpecListChild) => c.name).join(', ') }}
                    </div>
                  </div>
                </template>
              </AutoComplete>

              <Button
                v-if="!readonly && specManager.specs.value.length > 1"
                outlined
                severity="danger"
                tabindex="-1"
                :label="t('portal_product.button.delete')"
                @click="handleRemoveSpec(specIndex)"
              >
                <template #icon>
                  <i class="pi pi-trash" />
                </template>
              </Button>

              <Button
                v-if="!readonly && specIndex === specManager.specs.value.length - 1 && specCount < 3"
                outlined
                tabindex="-1"
                :label="t('portal_product.button.add')"
                @click="handleAddSpec"
              >
                <template #icon>
                  <i class="pi pi-plus" />
                </template>
              </Button>
            </div>
          </BaseFormField>

          <div>
            <div class="flex items-center gap-2 flex-wrap">
              <div
                v-for="(child, childIndex) in spec.children"
                :key="childIndex"
                class="flex items-center gap-1 w-40"
                @dragstart="handleDragStart($event, specIndex, childIndex)"
                @dragenter="handleDragEnter($event, specIndex, childIndex)"
                @dragover="handleDragOver"
                @dragleave="handleDragLeave"
                @drop="handleDrop($event, specIndex, childIndex)"
                @dragend="handleDragEnd"
              >
                <div
                  draggable="true"
                  class="cursor-move shrink-0 text-[var(--p-text-muted-color)]"
                >
                  <i class="pi pi-bars" />
                </div>
                <div class="flex-1 min-w-0 relative">
                  <InputText
                    :model-value="child.name"
                    :disabled="readonly"
                    :name="`spec_${specIndex + 1}-option_${childIndex + 1}`"
                    :invalid="!child.name"
                    :placeholder="t('portal_product.spec_table.placeholder.spec_option')"
                    class="w-full pr-7"
                    @update:model-value="(val) => specManager.updateSpecChildName(specIndex, childIndex, (val as string) ?? '')"
                  />
                  <button
                    v-if="!readonly && spec.children.length > 1"
                    type="button"
                    tabindex="-1"
                    class="absolute top-1/2 right-1 -translate-y-1/2 w-5 h-5 rounded-full bg-[var(--p-content-hover-background)] hover:bg-[var(--p-content-border-color)] flex items-center justify-center text-[var(--p-text-color)]"
                    @click="handleRemoveSpecChild(specIndex, childIndex)"
                  >
                    <i class="pi pi-minus" style="font-size: 10px" />
                  </button>
                </div>
              </div>

              <Button
                v-if="!readonly"
                severity="secondary"
                tabindex="-1"
                @click="handleAddSpecChild(specIndex, spec.children.length)"
              >
                <template #icon>
                  <i class="pi pi-plus" />
                </template>
              </Button>
            </div>
          </div>

          <Divider v-if="specIndex < specManager.specs.value.length - 1" />
        </div>
      </div>
  </section>

  <section class="border-b border-[var(--p-content-border-color)] pb-5">
    <h3 class="text-base font-semibold text-[var(--p-text-color)] mb-4">
      {{ t('portal_product.spec_table.section.variant_details') }}
    </h3>
      <div
        v-if="!readonly"
        class="mb-3"
      >
        <div class="flex items-center gap-4">
          <div class="w-40">
            <InputNumber
              v-model="batchInput.cost"
              name="spec-batch-input-cost"
              mode="currency"
              currency="TWD"
              :min="0"
              :placeholder="t('portal_product.form.field.cost_price')"
              input-class="w-full"
            />
          </div>

          <div class="w-40">
            <InputNumber
              v-model="batchInput.originalPrice"
              name="spec-batch-input-original-price"
              mode="currency"
              currency="TWD"
              :min="0"
              :placeholder="t('portal_product.form.field.original_price')"
              input-class="w-full"
            />
          </div>

          <div class="w-40">
            <InputNumber
              v-model="batchInput.salePrice"
              name="spec-batch-input-sale-price"
              mode="currency"
              currency="TWD"
              :min="0"
              :placeholder="t('portal_product.form.field.sale_price')"
              input-class="w-full"
            />
          </div>

          <div class="w-40">
            <InputNumber
              v-model="batchInput.stock"
              name="spec-batch-input-stock"
              :min="0"
              :placeholder="t('portal_product.form.field.stock')"
              input-class="w-full"
            />
          </div>

          <Button
            :label="t('portal_product.button.apply')"
            severity="secondary"
            @click="applyBatchInput"
          >
            <template #icon>
              <i class="pi pi-check" />
            </template>
          </Button>
        </div>
      </div>

      <input
        ref="specImageFileInputRef"
        type="file"
        accept="image/*"
        class="hidden"
        @change="handleSpecImageFileChange"
      >
      <div v-if="specManager.flatVariants.value.length > 0">
        <table class="table-fixed border-collapse w-full">
          <thead>
            <tr>
              <th class="border border-gray-200 p-2 text-left font-medium dark:border-gray-600 w-20">
                <span class="text-sm font-medium">{{ t('portal_product.form.field.spec_image') }}</span>
              </th>
              <th
                v-for="(spec, index) in specManager.specs.value"
                :key="`spec-header-${index}`"
                class="border border-gray-200 p-2 text-left font-medium dark:border-gray-600"
              >
                <span class="text-sm font-medium">{{
                  spec.name || `${t('portal_product.spec_table.field.name')} ${index + 1}`
                }}</span>
              </th>
              <th class="border border-gray-200 p-2 text-left font-medium dark:border-gray-600">
                <span class="text-sm font-medium">{{ t('portal_product.form.field.cost_price') }}</span>
              </th>
              <th class="border border-gray-200 p-2 text-left font-medium dark:border-gray-600">
                <span class="text-sm font-medium">{{ t('portal_product.form.field.original_price') }}</span>
              </th>
              <th class="border border-gray-200 p-2 text-left font-medium dark:border-gray-600">
                <span class="text-sm font-medium">{{ t('portal_product.form.field.sale_price') }}</span>
              </th>
              <th class="border border-gray-200 p-2 text-left font-medium dark:border-gray-600">
                <span class="text-sm font-medium">{{ t('portal_product.form.field.stock') }}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(variant, rowIndex) in specManager.flatVariants.value"
              :key="`variant-${rowIndex}`"
            >
              <!-- 規格圖片欄：配對第一層規格，rowspan 與 specs[0] 相同 -->
              <td
                v-if="shouldShowSpecValue(rowIndex, 0)"
                :rowspan="getSpecValueRowspan(0)"
                class="border border-gray-200 p-2 text-center align-middle dark:border-gray-600"
              >
                <div class="flex flex-col items-center gap-2 relative">
                  <template v-if="variant.specImage?.url">
                    <img
                      :src="variant.specImage.url"
                      :alt="specManager.specs.value[0]?.children[variant.specIndex[0]]?.name"
                      class="h-16 w-16 rounded object-cover"
                    >
                    <div
                      v-if="!readonly"
                      class="absolute inset-x-0 bottom-0 flex h-7 items-center bg-gray-700/95 text-white rounded-b"
                    >
                      <button
                        type="button"
                        class="flex h-full flex-1 cursor-pointer items-center justify-center transition hover:bg-black/20 disabled:cursor-not-allowed disabled:opacity-50"
                        :disabled="isUploadingSpecImage"
                        :title="t('common.button.cancel')"
                        @click="handleSpecImageClick(variant.specIndex[0])"
                      >
                        <i class="pi pi-pencil text-xs" />
                      </button>
                      <span class="h-4 w-px bg-white/50" />
                      <button
                        type="button"
                        class="flex h-full flex-1 cursor-pointer items-center justify-center transition hover:bg-black/20 disabled:cursor-not-allowed disabled:opacity-50"
                        :disabled="isUploadingSpecImage"
                        :title="t('common.button.delete')"
                        @click="handleClearSpecImage(variant.specIndex[0])"
                      >
                        <i class="pi pi-trash text-xs" />
                      </button>
                    </div>
                  </template>
                  <button
                    v-else-if="!readonly"
                    type="button"
                    class="size-16 text-xl border-2 border-dashed border-gray-400 dark:border-gray-600 rounded flex items-center justify-center text-gray-500 hover:border-[var(--p-primary-color)] hover:text-[var(--p-primary-color)]"
                    :disabled="isUploadingSpecImage"
                    :title="t('portal_product.spec_table.hint.image_upload')"
                    @click="handleSpecImageClick(variant.specIndex[0])"
                  >
                    <i class="pi pi-image" />
                  </button>
                  <span v-else class="text-gray-400">-</span>
                </div>
              </td>

              <template
                v-for="(specName, specIdx) in variant.specNames"
                :key="`spec-${rowIndex}-${specIdx}`"
              >
                <td
                  v-if="shouldShowSpecValue(rowIndex, specIdx)"
                  :rowspan="getSpecValueRowspan(specIdx)"
                  class="border border-gray-200 p-2 text-left align-top dark:border-gray-600"
                >
                  <span>{{ specName }}</span>
                </td>
              </template>

              <td class="border border-gray-200 p-2 text-left dark:border-gray-600">
                <div :data-cell="`cost-${rowIndex}`">
                  <InputNumber
                    :model-value="variant.cost"
                    :disabled="readonly"
                    :name="`spec-variant-${rowIndex}-cost`"
                    mode="currency"
                    currency="TWD"
                    :min="0"
                    input-class="w-full"
                    @keydown.capture="(e: KeyboardEvent) => handleTableKeyNav(e, rowIndex, 'cost')"
                    @update:model-value="(val) => specManager.updateVariant(variant.specIndex, 'cost', val ?? 0)"
                  />
                </div>
              </td>

              <td class="border border-gray-200 p-2 text-left dark:border-gray-600">
                <div :data-cell="`originalPrice-${rowIndex}`">
                  <InputNumber
                    :model-value="variant.originalPrice"
                    :disabled="readonly"
                    :name="`spec-variant-${rowIndex}-original-price`"
                    mode="currency"
                    currency="TWD"
                    :min="0"
                    input-class="w-full"
                    @keydown.capture="(e: KeyboardEvent) => handleTableKeyNav(e, rowIndex, 'originalPrice')"
                    @update:model-value="(val) => specManager.updateVariant(variant.specIndex, 'originalPrice', val ?? 0)"
                  />
                </div>
              </td>

              <td class="border border-gray-200 p-2 text-left dark:border-gray-600">
                <div :data-cell="`salePrice-${rowIndex}`">
                  <InputNumber
                    :model-value="variant.salePrice"
                    :disabled="readonly"
                    :name="`spec-variant-${rowIndex}-sale-price`"
                    mode="currency"
                    currency="TWD"
                    :min="0"
                    input-class="w-full"
                    @keydown.capture="(e: KeyboardEvent) => handleTableKeyNav(e, rowIndex, 'salePrice')"
                    @update:model-value="(val) => specManager.updateVariant(variant.specIndex, 'salePrice', val ?? 0)"
                  />
                </div>
              </td>

              <td class="border border-gray-200 p-2 text-left dark:border-gray-600">
                <div :data-cell="`stock-${rowIndex}`">
                  <InputNumber
                    :model-value="variant.stock"
                    :disabled="readonly"
                    :name="`spec-variant-${rowIndex}-stock`"
                    :min="0"
                    input-class="w-full"
                    @keydown.capture="(e: KeyboardEvent) => handleTableKeyNav(e, rowIndex, 'stock')"
                    @update:model-value="(val) => specManager.updateVariant(variant.specIndex, 'stock', val ?? 0)"
                  />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
  </section>
</template>
