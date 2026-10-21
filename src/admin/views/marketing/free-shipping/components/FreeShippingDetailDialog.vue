<script setup lang="ts">
/**
 * 免運活動「檢視」彈窗（薄殼，唯讀）。
 * 對齊正式專案 FreeShippingDetailDialog：與新增／編輯分離的檢視入口，同樣委派 FreeShippingForm（view 模式）。
 */
import FreeShippingForm from './FreeShippingForm.vue'
import { nextTick, ref, watch } from 'vue'
import type { FreeShippingRow } from '../types'

defineProps<{ row?: FreeShippingRow | null }>()

const visible = defineModel<boolean>('visible', { default: false })

const formRef = ref<InstanceType<typeof FreeShippingForm> | null>(null)

watch(visible, (isVisible) => {
  if (isVisible) {
    nextTick(() => formRef.value?.reset())
  }
})

function handleClose() {
  visible.value = false
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :draggable="false"
    :header="$t('free_shipping.form_dialog.header.view')"
    :style="{ width: 'min(720px, calc(100vw - 32px))' }"
  >
    <FreeShippingForm
      ref="formRef"
      mode="view"
      :row="row"
    />

    <template #footer>
      <div class="flex items-center justify-end gap-2">
        <Button
          type="button"
          severity="secondary"
          outlined
          :label="$t('free_shipping.form_dialog.button.close')"
          @click="handleClose"
        />
      </div>
    </template>
  </Dialog>
</template>
