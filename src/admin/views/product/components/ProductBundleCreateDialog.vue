<script setup lang="ts">
import { ref, computed } from 'vue'
import ProductBundleCreatePage from '../ProductBundleCreatePage.vue'
import type { BundleItem } from './BundleContentsCard.vue'
import type { ManagedProduct } from '../utils/productMock'

/**
 * 「新增組合商品」彈窗版：reuse ProductBundleCreatePage（embedded=true）當內容，
 * 由本元件包 Dialog header / footer。
 *
 * 給收單頁 AddProductDialog「建立組合商品」入口使用：
 * 可預填 initialBundleItems（從 picker 已勾選商品轉換而來），建好後 emit `created(p)`，
 * picker 透過 reactive bundleCatalog 自動跟上。
 */

interface Props {
  visible?: boolean
  /** 預填子商品；通常從 picker 已勾選清單轉換而來 */
  initialBundleItems?: BundleItem[]
}
const props = withDefaults(defineProps<Props>(), {
  visible: false,
  initialBundleItems: () => [],
})
const emit = defineEmits<{
  'update:visible': [value: boolean]
  created: [product: ManagedProduct]
}>()

const innerVisible = computed<boolean>({
  get: () => props.visible,
  set: (v) => emit('update:visible', v),
})

const pageRef = ref<InstanceType<typeof ProductBundleCreatePage> | null>(null)

function onSavedFromPage(product: ManagedProduct): void {
  emit('created', product)
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
    :style="{ width: '1200px' }"
    :pt="{
      header: { style: 'padding: 17.5px' },
      content: { style: 'padding: 0 17.5px' },
      footer: { style: 'padding: 0 17.5px 17.5px' },
    }"
  >
    <template #header>
      <span class="font-semibold text-[var(--p-text-color)]" style="font-size: 17.5px">
        新增組合商品
      </span>
    </template>

    <!-- v-if 確保每次開 dialog 時 page 重新 mount，onMounted 重新讀 initialBundleItems 預填 -->
    <div class="max-h-[calc(85vh-160px)] overflow-y-auto pt-2 pb-4">
      <ProductBundleCreatePage
        v-if="innerVisible"
        ref="pageRef"
        :embedded="true"
        :initial-bundle-items="initialBundleItems"
        @saved="onSavedFromPage"
        @cancel="onCancelFromPage"
      />
    </div>

    <template #footer>
      <div class="flex items-center justify-end gap-2">
        <Button label="取消" severity="secondary" outlined @click="onFooterCancel" />
        <Button label="建立組合商品" icon="pi pi-save" @click="onFooterSave" />
      </div>
    </template>
  </Dialog>
</template>
