<script setup lang="ts">
/**
 * 免運活動「新增／編輯」彈窗（薄殼）。
 * 對齊正式專案 FreeShippingFormDialog：只負責 Dialog 外殼與底部按鈕，表單主體委派 FreeShippingForm。
 */
import FreeShippingForm from './FreeShippingForm.vue'
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { FreeShippingRow } from '../types'

const props = withDefaults(defineProps<{
  mode?: 'create' | 'edit'
  row?: FreeShippingRow | null
}>(), { mode: 'create', row: null })

const emit = defineEmits<{ submit: [row: FreeShippingRow] }>()

const visible = defineModel<boolean>('visible', { default: false })

const { t } = useI18n()

const formRef = ref<InstanceType<typeof FreeShippingForm> | null>(null)

const dialogHeader = computed(() => props.mode === 'edit'
  ? t('free_shipping.form_dialog.header.edit')
  : t('free_shipping.form_dialog.header.create'))

watch(visible, (isVisible) => {
  if (isVisible) {
    // 等 FreeShippingForm 掛載後再載入資料
    nextTick(() => formRef.value?.reset())
  }
})

function handleCancel() {
  visible.value = false
}

function handleSave() {
  if (formRef.value?.submit()) {
    visible.value = false
  }
}

function onSubmit(payload: FreeShippingRow) {
  emit('submit', payload)
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :draggable="false"
    :header="dialogHeader"
    :style="{ width: 'min(720px, calc(100vw - 32px))' }"
  >
    <FreeShippingForm
      ref="formRef"
      :mode="mode"
      :row="row"
      @submit="onSubmit"
    />

    <template #footer>
      <div class="flex items-center justify-end gap-2">
        <Button
          type="button"
          severity="secondary"
          outlined
          :label="$t('free_shipping.form_dialog.button.cancel')"
          @click="handleCancel"
        />
        <Button
          type="button"
          :label="$t('free_shipping.form_dialog.button.save')"
          @click="handleSave"
        />
      </div>
    </template>
  </Dialog>
</template>
