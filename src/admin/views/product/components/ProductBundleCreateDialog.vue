<script setup lang="ts">
import { ref, computed } from 'vue'
import ProductBundleCreatePage from '../ProductBundleCreatePage.vue'
import type { BundleItem } from './BundleContentsCard.vue'
import type { ManagedProduct } from '../utils/productMock'

/**
 * 組合商品表單彈窗：reuse ProductBundleCreatePage（embedded=true）當內容。
 *
 * - 不帶 productId → 新增模式（可選擇預填 initialBundleItems）
 * - 帶 productId   → 編輯該組合商品
 */

interface Props {
  visible?: boolean
  /** 預填子商品；通常從 picker 已勾選清單轉換而來（僅新增模式有意義） */
  initialBundleItems?: BundleItem[]
  /** 帶 id = 編輯或檢視該組合商品，不帶 = 新增 */
  productId?: number
  /** 純檢視模式 */
  readonly?: boolean
}
const props = withDefaults(defineProps<Props>(), {
  visible: false,
  initialBundleItems: () => [],
  productId: undefined,
  readonly: false,
})
const emit = defineEmits<{
  'update:visible': [value: boolean]
  saved: [product: ManagedProduct]
}>()

const innerVisible = computed<boolean>({
  get: () => props.visible,
  set: (v) => emit('update:visible', v),
})

const isEditMode = computed(() => !!props.productId)
const dialogTitle = computed(() => {
  if (props.readonly) return '檢視組合商品'
  return isEditMode.value ? '編輯組合商品' : '新增組合商品'
})
const saveLabel = computed(() => isEditMode.value ? '儲存變更' : '建立組合商品')

const pageRef = ref<InstanceType<typeof ProductBundleCreatePage> | null>(null)

function onSavedFromPage(product: ManagedProduct): void {
  emit('saved', product)
  innerVisible.value = false
}
function onCancelFromPage(): void {
  innerVisible.value = false
}
function onFooterCancel(): void {
  pageRef.value?.onCancel?.()
}
function onFooterSave(): void {
  pageRef.value?.onSave?.()
}

/** 讀 page 暴露的 canSave；< 2 個子商品或無名稱時為 false → disable footer 建立按鈕 */
const canSave = computed<boolean>(() => {
  const v = pageRef.value?.canSave
  // canSave 在 page 是 ComputedRef，這裡是物件型別的 prop；用 .value 取
  return v?.value ?? false
})
</script>

<template>
  <Dialog
    v-model:visible="innerVisible"
    modal
    :draggable="false"
    :style="{ width: 'min(1200px, calc(100vw - 32px))' }"
    :pt="{
      header: { style: 'padding: 17.5px' },
      content: { style: 'padding: 0 17.5px' },
      footer: { style: 'padding: 0 17.5px 17.5px' },
    }"
  >
    <template #header>
      <span class="font-semibold text-[var(--p-text-color)]" style="font-size: 17.5px">
        {{ dialogTitle }}
      </span>
    </template>

    <!-- v-if 確保每次開 dialog 時 page 重新 mount，onMounted 重新讀 initialBundleItems / initialProductId -->
    <div class="max-h-[calc(85vh-160px)] overflow-y-auto pt-2 pb-4">
      <ProductBundleCreatePage
        v-if="innerVisible"
        ref="pageRef"
        :embedded="true"
        :initial-bundle-items="initialBundleItems"
        :initial-product-id="productId"
        :readonly="readonly"
        @saved="onSavedFromPage"
        @cancel="onCancelFromPage"
      />
    </div>

    <template #footer>
      <div v-if="readonly" class="flex items-center justify-end">
        <Button label="關閉" severity="secondary" outlined @click="onFooterCancel" />
      </div>
      <div v-else class="flex items-center justify-end gap-2">
        <Button label="取消" severity="secondary" outlined @click="onFooterCancel" />
        <Button
          :label="saveLabel"
          icon="pi pi-save"
          :disabled="!canSave"
          v-tooltip.top="canSave ? undefined : '組合商品至少需要 2 個子商品且需有名稱'"
          @click="onFooterSave"
        />
      </div>
    </template>
  </Dialog>
</template>
