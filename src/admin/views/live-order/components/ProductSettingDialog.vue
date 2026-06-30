<template>
  <Dialog
    v-model:visible="innerVisible"
    modal :draggable="false"
    :style="{ width: 'min(1100px, calc(100vw - 32px))' }"
    :pt="{
      header:  { style: 'padding: 17.5px' },
      content: { style: 'padding: 0 17.5px 17.5px' },
      footer:  { style: 'padding: 0 17.5px 17.5px' },
    }"
    @update:visible="v => emit('update:visible', v)">

    <template #header>
      <span class="font-semibold text-[var(--p-text-color)]" style="font-size:17.5px">{{ t('live_order.dialog.product_setting_header') }}</span>
    </template>

    <ProductSettingForm ref="formRef" :product="product" />

    <template #footer>
      <div class="flex justify-between gap-2">
        <button
          class="border border-[var(--p-content-border-color)] text-[var(--p-text-color)] px-[13.25px] py-[9.75px] rounded-[6px] text-[15.75px] font-medium flex items-center gap-[7px] hover:bg-[var(--p-content-hover-background)]">
          <i class="pi pi-bookmark" style="font-size:15.75px"></i>{{ t('live_order.button.add_favourite') }}
        </button>
        <button @click="onSave"
          class="bg-[var(--p-primary-color)] border border-[var(--p-primary-color)] text-white px-[13.25px] py-[9.75px] rounded-[6px] text-[15.75px] font-medium flex items-center gap-[7px] hover:bg-[var(--p-primary-hover-color)]">
          <i class="pi pi-save" style="font-size:15.75px"></i>{{ t('live_order.button.save') }}
        </button>
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import ProductSettingForm from './ProductSettingForm.vue'

const { t } = useI18n()

interface ProductLike {
  id?: number
  name?: string
  sku?: string
  keyword?: string
  cost?: number
  price?: number
  stock?: number
  [key: string]: unknown
}

interface ProductFormApi {
  validate: () => boolean
  getData: () => Record<string, unknown>
  reset: () => void
}

interface Props {
  visible?: boolean
  product?: ProductLike
}
const props = withDefaults(defineProps<Props>(), {
  visible: false,
  product: () => ({}),
})
const emit = defineEmits<{
  'update:visible': [value: boolean]
  save: [data: Record<string, unknown>]
}>()

const innerVisible = ref(props.visible)
watch(() => props.visible, v => { innerVisible.value = v })

const formRef = ref<ProductFormApi | null>(null)

/** Validate child form, emit save with the form data and close dialog. */
function onSave(): void {
  if (!formRef.value?.validate()) return
  emit('save', formRef.value.getData())
  innerVisible.value = false
  emit('update:visible', false)
}
</script>
