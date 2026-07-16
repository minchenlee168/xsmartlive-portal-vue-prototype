<script setup lang="ts">
import { ref, computed } from 'vue'
import ProductUpdatePage from '../ProductUpdatePage.vue'
import type { ManagedProduct } from '../utils/productMock'

/**
 * 一般商品表單彈窗：reuse ProductUpdatePage（embedded=true）當內容。
 *
 * - 不帶 productId → 新增模式（dialog title「新增一般商品」、按鈕「建立商品」）
 * - 帶 productId   → 編輯該 MP（dialog title「編輯商品」、按鈕「儲存變更」）
 *
 * 儲存成功後 emit `saved(p)`，父層自行決定 toast / 關閉等行為。
 */

interface Props {
  visible?: boolean
  /** 帶 id = 編輯或檢視該商品；不帶 = 新增 */
  productId?: number
  /** 純檢視模式（input 全鎖、footer 只剩關閉） */
  readonly?: boolean
}
const props = withDefaults(defineProps<Props>(), {
  visible: false,
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
  if (props.readonly) return '檢視商品'
  return isEditMode.value ? '編輯商品' : '新增一般商品'
})
const saveLabel = computed(() => isEditMode.value ? '儲存變更' : '建立商品')

const pageRef = ref<InstanceType<typeof ProductUpdatePage> | null>(null)

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

    <!-- v-if 確保每次開 dialog 時 page 重新 mount，form 重新初始化 -->
    <div class="max-h-[calc(85vh-160px)] overflow-y-auto pt-2 pb-4">
      <ProductUpdatePage
        v-if="innerVisible"
        ref="pageRef"
        :embedded="true"
        :initial-product-id="productId"
        :readonly="readonly"
        @saved="onSavedFromPage"
        @cancel="onCancelFromPage"
      />
    </div>

    <template #footer>
      <!-- 檢視模式只剩「關閉」；其他模式照常顯示取消 + 儲存 -->
      <div v-if="readonly" class="flex items-center justify-end">
        <Button label="關閉" severity="secondary" outlined @click="onFooterCancel" />
      </div>
      <div v-else class="flex items-center justify-end gap-2">
        <Button label="取消" severity="secondary" outlined @click="onFooterCancel" />
        <Button :label="saveLabel" @click="onFooterSave" />
      </div>
    </template>
  </Dialog>
</template>
