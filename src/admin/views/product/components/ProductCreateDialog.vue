<script setup lang="ts">
import { ref, computed } from 'vue'
import ProductUpdatePage from '../ProductUpdatePage.vue'
import type { ManagedProduct } from '../utils/productMock'

/**
 * 「新增一般商品」彈窗版：直接 reuse ProductUpdatePage（embedded=true）當內容，
 * 由本元件包 Dialog header / footer / dirty 確認。
 *
 * 給收單頁 AddProductDialog 底部「+ 新增一般商品」入口使用：
 * 建好後 emit `created(p)`，picker 透過 reactive productCatalog 自動跟上。
 */

interface Props {
  visible?: boolean
}
const props = withDefaults(defineProps<Props>(), {
  visible: false,
})
const emit = defineEmits<{
  'update:visible': [value: boolean]
  created: [product: ManagedProduct]
}>()

const innerVisible = computed<boolean>({
  get: () => props.visible,
  set: (v) => emit('update:visible', v),
})

const pageRef = ref<InstanceType<typeof ProductUpdatePage> | null>(null)

function onSavedFromPage(product: ManagedProduct): void {
  emit('created', product)
  innerVisible.value = false
}
function onCancelFromPage(): void {
  innerVisible.value = false
}
function onFooterCancel(): void {
  // 直接呼叫 page 的 onCancel；embedded=true 時 page 會 emit('cancel') 走上方流程
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
        新增一般商品
      </span>
    </template>

    <!-- v-if 確保每次開 dialog 時 page 重新 mount，form 重新初始化 -->
    <div class="max-h-[calc(85vh-160px)] overflow-y-auto pt-2 pb-4">
      <ProductUpdatePage
        v-if="innerVisible"
        ref="pageRef"
        :embedded="true"
        @saved="onSavedFromPage"
        @cancel="onCancelFromPage"
      />
    </div>

    <template #footer>
      <div class="flex items-center justify-end gap-2">
        <Button label="取消" severity="secondary" outlined @click="onFooterCancel" />
        <Button label="建立商品" icon="pi pi-save" @click="onFooterSave" />
      </div>
    </template>
  </Dialog>
</template>
